const { app, BrowserWindow, Menu, clipboard, ipcMain, safeStorage, screen, shell } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { parseAurafarmLink } = require("./links");
const {
  CLOSE_AFTER_MS,
  createCloseWatch,
  createFrontLog,
  describeCloseDebug,
  describeFrontRead,
  closeCountdownStatus,
  deskHostFromOrigin,
  nextCloseWatch,
  nextFrontLog,
  noteCloseAttempt,
  hostnameFromUrl,
} = require("./frontmost");
const { browserAppName, closeFrontWindow, readFrontAppName, readFrontBrowser, readFrontWindowBounds, readScoreBrowser, scoreBrowserName } = require("./front-browser");
const { readPetConfig } = require("./config");
const { clampPetOrigin, parseWindowBounds, petOriginForTabStrip } = require("./pet-move");
const { finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("./score");
const { formatStudyClock, remainingStudyMs, studyProgress } = require("./study-clock");
const { updateOffer } = require("./version");
const { version: PET_VERSION } = require("./package.json");

loadPublicEnv(path.join(__dirname, "..", ".env.local"));

const API_ORIGIN = usableApiOrigin([
  process.env.AURAFARM_API_ORIGIN,
  require("./bundled-origin"),
  "http://localhost:3000",
]);
const DESK_HOST = deskHostFromOrigin(API_ORIGIN);
const PET_REFRESH_MS = 10_000;
const FRONT_POLL_MS = 2_000;

let supabase = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

function createSupabase(url, key) {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
}

async function loadRemoteConfig() {
  if (supabase) return;
  try {
    const response = await fetch(`${API_ORIGIN}/api/pet/config`);
    if (!response.ok) return;
    const parsed = readPetConfig(await response.json());
    if (!parsed) return;
    supabase = createSupabase(parsed.url, parsed.key);
  } catch {
    // The desk can be down. A local .env.local still works for npm start.
  }
}

const PANEL_COLLAPSED_WIDTH = 24;
const PANEL_EXPANDED_WIDTH = 320;
const PANEL_HEIGHT = 275;
const PANEL_COLLAPSED_HEIGHT = 239;
const PET_SIZE = 70;

let panelWindow = null;
let panelOpen = false;
let petWindow = null;
let petVisible = true;
let petAnimating = false;
let bubbleHost = "";
let finishing = false;
let study = null;
let lastBrowserApp = "";
let lastSeenFront = "";
let notingFront = false;
let frontTimer = null;
let studyClock = null;
let frontPoll = null;
let appQuitting = false;
let state = {
  petType: "baby_slime",
  level: 1,
  status: "Paste a session token.",
  panelOpen: false,
  petVisible: true,
  petPose: "idle",
  petFlip: false,
};
const pendingLinks = [];

function loadPublicEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    if (
      key !== "AURAFARM_API_ORIGIN" &&
      key !== "NEXT_PUBLIC_SUPABASE_URL" &&
      key !== "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" &&
      key !== "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ) {
      continue;
    }
    if (process.env[key]) continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value || value.startsWith("#")) continue;
    process.env[key] = value;
  }
}

function secretPath(name) {
  return path.join(app.getPath("userData"), name);
}

function writeSecret(name, value) {
  const encoded = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value).toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  fs.writeFileSync(secretPath(name), encoded);
}

function readSecret(name) {
  const file = secretPath(name);
  if (!fs.existsSync(file)) return "";
  const encoded = fs.readFileSync(file, "utf8");
  const buffer = Buffer.from(encoded, "base64");
  if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buffer);
  return buffer.toString("utf8");
}

let lastPetLog = "";

function petLog(line) {
  if (line === lastPetLog) return;
  lastPetLog = line;
  console.log(line);
}

function publish() {
  petLog(`[pet] showing ${state.petType || "baby_slime"} level ${state.level}`);
  const payload = {
    ...state,
    assetOrigin: API_ORIGIN,
    finishLabel: study?.token ? finishLabel(study.log.blockedCount) : "",
  };
  for (const win of [panelWindow, petWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send("state", payload);
  }
}

function setStatus(status, extra = {}) {
  state = { ...state, ...extra, status };
  publish();
}

function setDebug(debug) {
  const line = String(debug || "");
  if (state.debug === line) return;
  state = { ...state, debug: line };
  console.log(line);
  publish();
}

function panelBounds(open) {
  const area = screen.getPrimaryDisplay().workArea;
  const width = open ? PANEL_EXPANDED_WIDTH : PANEL_COLLAPSED_WIDTH;
  const height = Math.min(open ? PANEL_HEIGHT : PANEL_COLLAPSED_HEIGHT, area.height);
  return {
    x: area.x + area.width - width,
    y: area.y + area.height - height,
    width,
    height,
  };
}

function placePanel() {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  win.setHasShadow(true);
  win.setBounds(panelBounds(panelOpen), true);
}

function setPanelOpen(open) {
  panelOpen = Boolean(open);
  placePanel();
  placePet();
  if (state.panelOpen === panelOpen) return;
  state = { ...state, panelOpen };
  publish();
}

function petBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const panel = panelBounds(panelOpen);
  const width = PET_SIZE;
  const height = Math.min(PET_SIZE, area.height);
  const x = Math.max(area.x, panel.x - width);
  const y = area.y + area.height - height;
  return {
    x: Math.min(x, area.x + Math.max(0, area.width - width)),
    y,
    width,
    height,
  };
}

function placePet() {
  if (petAnimating) return;
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  win.setBounds(petBounds(), true);
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setPetPose(pose, flip) {
  const nextFlip = Boolean(flip);
  if (state.petPose === pose && state.petFlip === nextFlip) return;
  state = { ...state, petPose: pose, petFlip: nextFlip };
  publish();
}

async function walkPetTo(x, y) {
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  const from = win.getBounds();
  const faceLeft = x < from.x - 1;
  const steps = 16;
  for (let i = 1; i <= steps; i += 1) {
    if (!petWindow || petWindow.isDestroyed()) return;
    const t = 1 - Math.pow(1 - i / steps, 2);
    petWindow.setPosition(
      Math.round(from.x + (x - from.x) * t),
      Math.round(from.y + (y - from.y) * t),
    );
    setPetPose(i % 4 < 2 ? "walk1" : "walk2", faceLeft);
    await waitMs(40);
  }
  if (petWindow && !petWindow.isDestroyed()) petWindow.setPosition(Math.round(x), Math.round(y));
}

async function jumpPet() {
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  const start = win.getBounds();
  setPetPose("idle", state.petFlip);
  for (const dy of [0, -14, -28, -36, -22, -6, 0, -10, -18, -8, 0]) {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.setPosition(start.x, start.y + dy);
    await waitMs(32);
  }
}

async function returnPetHome() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const home = petBounds();
  await walkPetTo(home.x, home.y);
  setPetPose("idle", false);
}

async function finishPetApproach() {
  try {
    await returnPetHome();
  } finally {
    petAnimating = false;
    setPetPose("idle", false);
    placePet();
  }
}

async function closeFrontTab(appName, host) {
  let animated = false;
  if (petVisible && petWindow && !petWindow.isDestroyed()) {
    const bounds = await readFrontWindowBounds(appName);
    const parsed = bounds.ok ? parseWindowBounds(bounds.value) : null;
    if (parsed) {
      petAnimating = true;
      animated = true;
      try {
        const origin = petOriginForTabStrip(parsed, PET_SIZE);
        const display = screen.getDisplayNearestPoint({
          x: origin.x + PET_SIZE / 2,
          y: origin.y + PET_SIZE / 2,
        });
        const aim = clampPetOrigin(origin, PET_SIZE, display.bounds);
        await walkPetTo(aim.x, aim.y);
        await jumpPet();
      } catch {
        await finishPetApproach();
        return { ok: false, error: "", skipped: true };
      }
    }
  }
  if (animated) {
    const still = await readFrontBrowser();
    if (hostnameFromUrl(still.url || "") !== host) {
      await finishPetApproach();
      return { ok: false, error: "", skipped: true };
    }
  }
  const result = await closeFrontWindow(appName);
  if (animated) await finishPetApproach();
  return result;
}

function setPetVisible(visible) {
  petVisible = Boolean(visible);
  if (petVisible) openPet();
  else if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
  if (state.petVisible === petVisible) return;
  state = { ...state, petVisible };
  publish();
}

function openPet() {
  if (petWindow && !petWindow.isDestroyed()) {
    placePet();
    if (petVisible) petWindow.showInactive();
    return;
  }
  const bounds = petBounds();
  petWindow = new BrowserWindow({
    ...bounds,
    show: petVisible,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Aurafarm pet",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, "pet.html"));
  petWindow.on("closed", () => {
    petWindow = null;
    if (!appQuitting && petVisible) setImmediate(() => openPet());
  });
  petWindow.webContents.once("did-finish-load", publish);
}

function focusPanel() {
  openPanel();
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  setPanelOpen(true);
  win.show();
  win.focus();
}

function pasteSessionCode(win) {
  const text = clipboard.readText().trim();
  if (!text || !win || win.isDestroyed()) return;
  const script = `(() => {
    const field = document.querySelector("#session-token textarea");
    if (!field) return;
    field.value = ${JSON.stringify(text)};
    field.focus();
  })()`;
  void win.webContents.executeJavaScript(script);
}

function openPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.show();
    return;
  }
  const bounds = panelBounds(panelOpen);
  panelWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    title: "Aurafarm",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  panelWindow.loadFile(path.join(__dirname, "panel.html"));
  panelWindow.webContents.on("context-menu", (_event, params) => {
    const win = panelWindow;
    if (!win || win.isDestroyed()) return;
    const inField = params.isEditable;
    Menu.buildFromTemplate([
      { role: "cut", enabled: inField && params.editFlags.canCut },
      { role: "copy", enabled: inField && params.editFlags.canCopy },
      inField
        ? { role: "paste", enabled: params.editFlags.canPaste }
        : { label: "Paste", click: () => pasteSessionCode(win) },
      { type: "separator" },
      { role: "selectAll" },
    ]).popup({ window: win });
  });
  panelWindow.on("closed", () => {
    panelWindow = null;
    if (!appQuitting) setImmediate(() => openPanel());
  });
  panelWindow.webContents.once("did-finish-load", publish);
}

async function restoreSession() {
  if (!supabase) {
    setStatus("Add the public Supabase keys to .env.local, then restart the pet.");
    return;
  }
  const raw = readSecret("session.json");
  if (!raw) {
    petLog(`[pet] no saved sign-in at ${secretPath("session.json")}.`);
    return;
  }
  try {
    const saved = JSON.parse(raw);
    const { error } = await supabase.auth.setSession(saved);
    if (error) {
      petLog(`[pet] saved sign-in rejected: ${error.message}`);
      setStatus(error.message);
      return;
    }
    await refreshPet();
  } catch {
    petLog("[pet] saved sign-in could not be read.");
    setStatus("Paste a session token.");
  }
}

async function touchPetPresence(present) {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  const { error } = await supabase.rpc("touch_social_presence", {
    source: "pet",
    present,
  });
  if (error) petLog(`[pet] presence update failed: ${error.message}`);
}

async function refreshPet() {
  if (!supabase) {
    petLog("[pet] no Supabase client. .env.local needs NEXT_PUBLIC_SUPABASE_URL and the publishable key.");
    return;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    petLog("[pet] no signed-in pet session, so the equipped row is not read. The character stays baby_slime until a launch code is claimed.");
    return;
  }
  await touchPetPresence(true);
  const { data, error } = await supabase
    .from("user_pets")
    .select("pet_type, level")
    .eq("is_desktop_active", true)
    .maybeSingle();
  if (error) {
    petLog(`[pet] equipped pet query failed: ${error.message}`);
    setStatus(error.message);
    return;
  }
  if (!data) {
    petLog("[pet] signed in, but no user_pets row has is_desktop_active = true.");
    return;
  }
  petLog(
    `[pet] equipped ${data.pet_type} level ${data.level} for ${sessionData.session.user?.id ?? "unknown"}`,
  );
  state = { ...state, petType: data.pet_type, level: data.level };
  publish();
}

async function signIn(email, password) {
  if (!supabase) return { error: "Supabase is not configured." };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) return { error: error?.message ?? "Could not sign in." };
  writeSecret(
    "session.json",
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }),
  );
  await refreshPet();
  return { error: "" };
}

async function claim(code, browser = "") {
  const remembered = lastBrowserApp || scoreBrowserName(browser) || (await readScoreBrowser(DESK_HOST));
  const response = await fetch(`${API_ORIGIN}/api/sessions/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) return { error: body?.error ?? "Claim rejected." };
  if (!body?.session_id || !Array.isArray(body.blocklist)) {
    return { error: "Claim rejected." };
  }
  beginFrontWatch(body, remembered);
  return { error: "" };
}

function readSessionToken(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { error: "A session token is required." };
  if (!trimmed.startsWith("{")) return { launchCode: trimmed };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { error: "That session token is not valid." };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.access_token !== "string" ||
    parsed.access_token.length === 0 ||
    typeof parsed.refresh_token !== "string" ||
    parsed.refresh_token.length === 0
  ) {
    return { error: "That session token is not valid." };
  }
  return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
}

async function useToken(raw) {
  const parsed = readSessionToken(raw);
  if (parsed.error) return { error: parsed.error };
  if (parsed.launchCode) return claim(parsed.launchCode);
  if (!supabase) return { error: "Supabase is not configured." };
  const { data, error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });
  if (error || !data.session) return { error: error?.message ?? "That session token is not valid." };
  writeSecret(
    "session.json",
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }),
  );
  await refreshPet();
  focusPanel();
  setStatus("Session token accepted.");
  return { error: "" };
}

async function cancelStudy() {
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { error: "Paste a session token before cancelling." };
  let sessionId = study?.id || "";
  if (!sessionId) {
    const { data, error: findError } = await supabase
      .from("study_sessions")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    if (findError) return { error: findError.message };
    sessionId = data?.id || "";
  }
  if (!sessionId) return { error: "No study session is running." };
  console.log(`[score] cancel ${sessionId} stops the session and does not change experience`);
  const { error } = await supabase.rpc("cancel_study_session", {
    target_session_id: sessionId,
  });
  if (error) {
    console.log(`[score] cancel ${sessionId} rejected: ${error.message}`);
    return { error: error.message };
  }
  if (study) stopFrontWatch();
  focusPanel();
  setStatus("Study session cancelled. No experience was added.");
  return { error: "" };
}

function tickStudyClock() {
  if (!study || finishing) return;
  const now = Date.now();
  const remaining = remainingStudyMs(study, now);
  const label = remaining === null ? "" : formatStudyClock(remaining);
  const progress = studyProgress(study, now) ?? 0;
  const countdown = study.closeBlocked ? closeCountdownStatus(study.closeWatch, now) : "";
  const clockChanged = state.remainingLabel !== label || state.timerProgress !== progress;
  const countdownChanged = Boolean(countdown) && state.status !== countdown;
  if (clockChanged || countdownChanged) {
    state = {
      ...state,
      remainingLabel: label,
      timerProgress: progress,
      ...(countdownChanged ? { status: countdown } : {}),
    };
    publish();
  }
  if (remaining !== null && remaining <= 0) void finishSession();
}

function startStudyClock() {
  if (studyClock) clearInterval(studyClock);
  tickStudyClock();
  studyClock = setInterval(tickStudyClock, 1000);
}

function stopStudyClock() {
  if (!studyClock) return;
  clearInterval(studyClock);
  studyClock = null;
}

function beginFrontWatch(body, browser = "") {
  stopFrontWatch();
  study = {
    id: String(body.session_id),
    // Held in memory for the later score submit. It is not written to disk.
    token: typeof body.token === "string" ? body.token : "",
    blocklist: body.blocklist.filter((host) => typeof host === "string"),
    closeBlocked: body.close_blocked === true,
    closeWatch: createCloseWatch(),
    log: createFrontLog(),
    distractedHosts: [],
    plannedSeconds: Number(body.planned_seconds),
    startedAtMs: Number.isFinite(Date.parse(body.started_at)) ? Date.parse(body.started_at) : Date.now(),
    startedAt: Date.now(),
    browser: scoreBrowserName(browser),
  };
  if (body.pet_type) {
    petLog(
      `[pet] claim equipped ${body.pet_type} level ${typeof body.level === "number" ? body.level : state.level}`,
    );
    state = {
      ...state,
      petType: body.pet_type,
      level: typeof body.level === "number" ? body.level : state.level,
    };
  } else {
    petLog("[pet] claim returned no pet_type, so the character stays as it is.");
  }
  state = { ...state, finishNote: "" };
  setDebug(
    describeCloseDebug({
      session: true,
      closeBlocked: study.closeBlocked,
      preferenceError: "",
    }),
  );
  publishWatch();
  focusPanel();
  frontTimer = setInterval(() => {
    void pollFront();
  }, FRONT_POLL_MS);
  startStudyClock();
  void pollFront();
}

function stopFrontWatch() {
  if (frontTimer) clearInterval(frontTimer);
  frontTimer = null;
  stopStudyClock();
  frontPoll = null;
  study = null;
  hideBubble();
  state = { ...state, remainingLabel: "", timerProgress: 0 };
  const debugBefore = state.debug;
  setDebug(describeCloseDebug({ session: false }));
  if (state.debug === debugBefore) publish();
}

function showBubble(host) {
  bubbleHost = host;
  state = { ...state, bubble: `Closing ${host}` };
  publish();
}

function hideBubble() {
  bubbleHost = "";
  if (!state.bubble) return;
  state = { ...state, bubble: "" };
  publish();
}

function setPetLevel(level) {
  for (const win of [panelWindow, petWindow]) {
    if (win && !win.isDestroyed()) win.setAlwaysOnTop(true, level);
  }
}

async function finishSession() {
  if (!study?.token || finishing) return;
  const current = study;
  finishing = true;
  const desk = `origin=${API_ORIGIN} supabase=${supabase ? "yes" : "no"}`;
  try {
    const body = scoreRequestBody(current, Date.now());
    scoreDebug(`[score] finish ${current.id} ${desk}`);
    let response = null;
    let payload = null;
    let postError = "";
    try {
      response = await fetch(`${API_ORIGIN}/api/sessions/${current.id}/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      payload = await response.json().catch(() => null);
      scoreDebug(`[score] POST ${current.id} -> ${response.status} ${payload?.error || payload?.url || "no body"} ${desk}`);
    } catch (error) {
      postError = error instanceof Error ? error.message : "network";
      scoreDebug(`[score] POST ${current.id} failed: ${postError} ${desk}`);
    }
    if (study !== current) return;
    const reachedScoreRoute = response && (response.status === 200 || response.status === 403 || response.status === 409);
    if (!reachedScoreRoute) {
      const saved = await submitScoreDirect(current, body, postError || `HTTP ${response ? response.status : "none"}`);
      if (study !== current) return;
      if (!saved.ok) {
        setStatus(saved.message, { finishNote: saved.message });
        return;
      }
      if (saved.url) await openScorePage(saved.url, lastBrowserApp || current.browser);
      if (study !== current) return;
      stopFrontWatch();
      focusPanel();
      setStatus(saved.message, { finishNote: "" });
      return;
    }
    const result = interpretScoreResponse(response.status, payload, API_ORIGIN, current.id);
    if (!result.clearToken) {
      setStatus(result.message, { finishNote: result.message });
      return;
    }
    if (result.url) await openScorePage(result.url, lastBrowserApp || current.browser);
    if (study !== current) return;
    stopFrontWatch();
    focusPanel();
    setStatus(result.message, { finishNote: "" });
  } finally {
    finishing = false;
  }
}

async function noteFrontApp() {
  if (notingFront || process.platform !== "darwin") return;
  notingFront = true;
  try {
    const reading = await readFrontAppName();
    if (!reading.ok || reading.name === lastSeenFront) return;
    lastSeenFront = reading.name;
    const browser = browserAppName(reading.name, "");
    if (browser) lastBrowserApp = browser;
  } finally {
    notingFront = false;
  }
}

function openScorePage(url, browser) {
  if (process.platform === "darwin" && typeof browser === "string" && browser) {
    return new Promise((resolve) => {
      execFile("open", ["-a", browser, url], (error) => {
        if (error) {
          void shell.openExternal(url).finally(() => resolve());
          return;
        }
        resolve();
      });
    });
  }
  return shell.openExternal(url);
}

function scoreDebug(line) {
  console.log(line);
  setDebug(line);
}

async function submitScoreDirect(current, body, postFailure) {
  const desk = `origin=${API_ORIGIN} supabase=${supabase ? "yes" : "no"} post=${postFailure}`;
  if (!supabase) {
    const message = `Could not submit the score. ${desk}`;
    scoreDebug(`[score] rpc skipped ${current.id} ${desk}`);
    return { ok: false, url: "", message };
  }
  const { data, error } = await supabase.rpc("submit_study_score", {
    target_session_id: current.id,
    raw_token: body.token,
    duration_seconds: body.duration_seconds,
    blocked_count: body.blocked_count,
    blocked_hosts: body.blocked_hosts,
    local_day: body.local_day ?? null,
  });
  if (error) {
    scoreDebug(`[score] rpc ${current.id} rejected: ${error.message} ${desk}`);
    if (/already submitted/i.test(error.message)) {
      return {
        ok: true,
        url: `${API_ORIGIN}/dashboard/sessions/${current.id}`,
        message: "That session was already scored.",
      };
    }
    return { ok: false, url: "", message: `Could not submit the score. ${error.message} ${desk}` };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.xp !== "number") {
    const seen = row ? JSON.stringify(row) : "empty";
    scoreDebug(`[score] rpc ${current.id} returned ${seen} ${desk}`);
    return { ok: false, url: "", message: `Could not submit the score. Database returned ${seen}. ${desk}` };
  }
  scoreDebug(`[score] rpc ${current.id} saved ${row.xp} xp ${desk}`);
  return {
    ok: true,
    url: `${API_ORIGIN}/dashboard/sessions/${current.id}`,
    message: "Score sent.",
  };
}

function publishWatch(reading) {
  if (!study) return;
  const countdown = study.closeBlocked ? closeCountdownStatus(study.closeWatch, Date.now()) : "";
  if (countdown) {
    setStatus(countdown);
    return;
  }
  if (!reading) {
    setStatus("Watching. Nothing on the blocklist is in front.");
    return;
  }
  setStatus(describeFrontRead(reading, study.log));
}

async function studyStillActive(sessionId) {
  if (!supabase) return true;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return true;
  const { data, error } = await supabase
    .from("study_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    console.log(`[score] status read failed for ${sessionId}: ${error.message}`);
    return true;
  }
  if (data?.status === "active") return true;
  console.log(`[score] session ${sessionId} is ${data?.status ?? "missing"}, so the pet stops watching`);
  return false;
}

async function readCloseBlocked() {
  if (!supabase) return { value: null, error: "Pet has no Supabase keys." };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return { value: null, error: "Pet is not signed in, so it is using the toggle from claim." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("close_blocked")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { value: null, error: error.message };
  if (!data) return { value: null, error: "No profile row for this sign-in." };
  return { value: data.close_blocked === true, error: "" };
}

async function pollFront() {
  if (!study || frontPoll) return;
  const current = study;
  frontPoll = current;
  try {
    setPetLevel("floating");
    const reading = await readFrontBrowser();
    if (study !== current) return;
    if (reading.url) {
      current.log = nextFrontLog(true, current.log, reading.url, current.blocklist, DESK_HOST);
    }
    const preference = await readCloseBlocked();
    if (study !== current) return;
    if (typeof preference.value === "boolean") current.closeBlocked = preference.value;
    const now = Date.now();
    const decision = nextCloseWatch(current.closeWatch, {
      enabled: true,
      rawUrl: reading.url || "",
      blocklist: current.blocklist,
      deskHost: DESK_HOST,
      now,
    });
    current.closeWatch = decision;
    if (decision.host && decision.since > 0 && now - decision.since >= CLOSE_AFTER_MS) {
      if (!current.distractedHosts.includes(decision.host)) {
        current.distractedHosts = [...current.distractedHosts, decision.host];
      }
    }
    let closeNote = "";
    let closeError = "";
    if (decision.close && current.closeBlocked) {
      showBubble(decision.host);
      const closed = await closeFrontTab(reading.app, decision.host);
      if (study !== current) return;
      if (closed.skipped) {
        hideBubble();
      } else {
        current.closeWatch = noteCloseAttempt(current.closeWatch);
        if (!closed.ok) {
          hideBubble();
          closeError = closed.error || "osascript failed";
          closeNote = `Could not close ${decision.host}. The browser asked you to confirm.`;
        }
      }
    } else if (bubbleHost && (!current.closeBlocked || !reading.url || decision.host !== bubbleHost)) {
      hideBubble();
    }
    if (study !== current) return;
    setDebug(
      describeCloseDebug({
        session: true,
        closeBlocked: current.closeBlocked,
        preferenceError: preference.error,
        reading,
        decision,
        now,
        closeError,
      }),
    );
    publishWatch(reading);
    if (closeNote) setStatus(closeNote);
    const active = await studyStillActive(current.id);
    if (study !== current) return;
    if (!active) {
      stopFrontWatch();
      focusPanel();
      setStatus("Study session ended.");
    }
  } finally {
    setPetLevel("screen-saver");
    if (frontPoll === current) frontPoll = null;
  }
}

async function handleLink(link) {
  if (!link) return;
  if (link.kind === "session") {
    const browser = await readScoreBrowser(DESK_HOST);
    const result = await claim(link.code, browser);
    if (result.error) setStatus(result.error);
  }
}

function registerMacProtocol() {
  if (process.platform !== "darwin") return;
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("aurafarm", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("aurafarm");
  }
}

ipcMain.handle("sign-in", (_event, body) => signIn(body?.email ?? "", body?.password ?? ""));
ipcMain.handle("use-token", (_event, token) => useToken(String(token ?? "")));
ipcMain.handle("claim", (_event, code) => claim(String(code ?? "")));
ipcMain.handle("cancel-study", () => cancelStudy());
ipcMain.on("finish-session", () => {
  void finishSession();
});
ipcMain.on("open-update", () => {
  if (typeof state.updateUrl === "string" && state.updateUrl) void shell.openExternal(state.updateUrl);
});
ipcMain.on("quit-app", () => {
  app.quit();
});
ipcMain.on("set-panel-open", (_event, open) => {
  setPanelOpen(open);
});
ipcMain.on("set-pet-visible", (_event, visible) => {
  setPetVisible(visible);
});

async function checkForUpdate() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/pet/version`);
    if (!response.ok) return;
    const offer = updateOffer(PET_VERSION, await response.json());
    if (!offer) return;
    state = {
      ...state,
      updateLabel: `Version ${offer.version} is available.`,
      updateUrl: offer.url,
    };
    publish();
  } catch {
    // The desk can be down. The running pet stays as it is.
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    for (const arg of argv) {
      if (arg.startsWith("aurafarm://")) void handleLink(parseAurafarmLink(arg));
    }
  });

  let petPresenceReleased = false;
  app.on("before-quit", (event) => {
    appQuitting = true;
    stopFrontWatch();
    if (petPresenceReleased) return;
    event.preventDefault();
    const release = touchPetPresence(false);
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    void Promise.race([release, timeout]).finally(() => {
      petPresenceReleased = true;
      app.quit();
    });
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) void handleLink(parseAurafarmLink(url));
    else pendingLinks.push(url);
  });

  app.whenReady().then(async () => {
    registerMacProtocol();
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "Aurafarm",
          submenu: [{ role: "quit" }],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
      ]),
    );
    screen.on("display-metrics-changed", () => {
      placePanel();
      placePet();
    });
    openPanel();
    openPet();
    void noteFrontApp();
    setInterval(() => {
      void noteFrontApp();
    }, 1000);
    setDebug(describeCloseDebug({ session: false }));
    await loadRemoteConfig();
    await restoreSession();
    void checkForUpdate();
    for (const arg of [...process.argv, ...pendingLinks]) {
      if (arg.startsWith("aurafarm://")) await handleLink(parseAurafarmLink(arg));
    }
    setInterval(() => {
      void refreshPet();
    }, PET_REFRESH_MS);
  });
}
