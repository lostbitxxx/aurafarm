const { app, BrowserWindow, Menu, ipcMain, safeStorage, screen, shell } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");
const { step } = require("./walk");
const { parseAurafarmLink, sessionCodeFromPaste } = require("./links");
const {
  CLOSE_AFTER_MS,
  createCloseWatch,
  createFrontLog,
  describeCloseDebug,
  describeFrontRead,
  deskHostFromOrigin,
  nextCloseWatch,
  nextFrontLog,
  noteCloseAttempt,
} = require("./frontmost");
const { closeFrontTab, readFrontBrowser } = require("./front-browser");
const { readPetConfig } = require("./config");
const { distractionSeconds, finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("./score");
const { updateOffer } = require("./version");
const { version: PET_VERSION } = require("./package.json");

loadPublicEnv(path.join(__dirname, "..", ".env.local"));

const WINDOW = { x: 128, y: 128 };
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

let spriteWindow = null;
let panelWindow = null;
let finishWindow = null;
let bubbleWindow = null;
let debugWindow = null;
let bubbleHost = "";
let finishing = false;
let velocity = { x: 2, y: 0 };
let petShown = false;
let study = null;
let frontTimer = null;
let studyClock = null;
let frontPoll = null;
let appQuitting = false;
let state = {
  petType: "baby_slime",
  level: 1,
  status: "Paste a session code to show the pet.",
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
    finishLabel: study?.token ? finishLabel(study.log.blockedCount) : "",
  };
  for (const win of [spriteWindow, panelWindow, finishWindow, bubbleWindow, debugWindow]) {
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

function usableRects() {
  return screen.getAllDisplays().map((display) => display.workArea);
}

function placeOnScreen() {
  if (!spriteWindow) return;
  const area = screen.getPrimaryDisplay().workArea;
  const origin = { x: area.x + 80, y: area.y + 80 };
  spriteWindow.setPosition(origin.x, origin.y);
}

function walk() {
  if (!spriteWindow || spriteWindow.isDestroyed()) return;
  placeFinishWindow();
  placeBubbleWindow();
  placeDebugWindow();
  // A hidden always-on-top window comes back if macOS is asked to move it.
  if (!petShown) return;
  const [x, y] = spriteWindow.getPosition();
  const next = step({ x, y }, velocity, WINDOW, usableRects());
  velocity = next.velocity;
  spriteWindow.setPosition(next.position.x, next.position.y);
}

function createSprite() {
  spriteWindow = new BrowserWindow({
    width: WINDOW.x,
    height: WINDOW.y,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  spriteWindow.setAlwaysOnTop(true, "screen-saver");
  spriteWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  spriteWindow.setIgnoreMouseEvents(true, { forward: true });
  spriteWindow.loadFile(path.join(__dirname, "sprite.html"));
  spriteWindow.on("closed", () => {
    spriteWindow = null;
  });
  spriteWindow.webContents.once("did-finish-load", publish);
  placeOnScreen();
}

function showPet() {
  const win = spriteWindow;
  if (!win || win.isDestroyed()) return;
  petShown = true;
  win.setOpacity(1);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (!win.isVisible()) win.show();
}

function hidePet() {
  const win = spriteWindow;
  if (!win || win.isDestroyed()) return;
  petShown = false;
  // hide() is ignored on macOS while the window is visible on every workspace.
  win.setVisibleOnAllWorkspaces(false);
  win.setOpacity(0);
  win.hide();
  if (!panelWindow || panelWindow.isDestroyed()) openPanel();
}

function togglePanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    panelWindow = null;
    return;
  }
  openPanel();
}

function enableTextPaste(win) {
  win.webContents.on("context-menu", (_event, params) => {
    if (win.isDestroyed()) return;
    Menu.buildFromTemplate([
      { role: "undo", enabled: params.editFlags.canUndo },
      { role: "redo", enabled: params.editFlags.canRedo },
      { type: "separator" },
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll" },
    ]).popup({ window: win });
  });
}

function openPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.show();
    return;
  }
  const anchor = spriteWindow ? spriteWindow.getBounds() : { x: 80, y: 80 };
  panelWindow = new BrowserWindow({
    width: 320,
    height: 420,
    x: anchor.x + WINDOW.x + 12,
    y: anchor.y,
    resizable: false,
    alwaysOnTop: true,
    title: "Aurafarm",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  panelWindow.loadFile(path.join(__dirname, "panel.html"));
  enableTextPaste(panelWindow);
  panelWindow.on("closed", () => {
    panelWindow = null;
    if (!appQuitting && spriteWindow && !spriteWindow.isDestroyed() && !spriteWindow.isVisible()) {
      setImmediate(() => openPanel());
    }
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
    setStatus("Paste a session code to show the pet.");
  }
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
    if (!study) setStatus("No pet is equipped on the desk.");
    return;
  }
  petLog(
    `[pet] equipped ${data.pet_type} level ${data.level} for ${sessionData.session.user?.id ?? "unknown"}`,
  );
  if (study) {
    state = { ...state, petType: data.pet_type, level: data.level };
    publish();
    return;
  }
  setStatus(`${data.pet_type} is on the desktop.`, {
    petType: data.pet_type,
    level: data.level,
  });
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

async function claim(code) {
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
  beginFrontWatch(body);
  showPet();
  return { error: "" };
}

function readSessionToken(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { error: "A session code is required." };
  const launchCode = sessionCodeFromPaste(trimmed);
  if (launchCode) return { launchCode };
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
  showPet();
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
  const watched = study && study.id === sessionId ? distractionSeconds(study, Date.now()) : null;
  const { error } = await supabase.rpc("cancel_study_session", {
    target_session_id: sessionId,
    distraction_seconds: watched,
  });
  if (error) {
    console.log(`[score] cancel ${sessionId} rejected: ${error.message}`);
    return { error: error.message };
  }
  if (study) stopFrontWatch();
  hidePet();
  setStatus("Study session cancelled. No experience was added.");
  return { error: "" };
}

function remainingStudyMs(current, now) {
  const planned = Number(current?.plannedSeconds);
  const started = Number(current?.startedAtMs);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(started)) return null;
  return started + planned * 1000 - now;
}

function startStudyClock() {
  if (studyClock) clearInterval(studyClock);
  studyClock = setInterval(() => {
    if (!study || finishing) return;
    const remaining = remainingStudyMs(study, Date.now());
    if (remaining !== null && remaining <= 0) void finishSession();
  }, 1000);
}

function stopStudyClock() {
  if (!studyClock) return;
  clearInterval(studyClock);
  studyClock = null;
}

function beginFrontWatch(body) {
  stopFrontWatch();
  study = {
    id: String(body.session_id),
    // Held in memory for the later score submit. It is not written to disk.
    token: typeof body.token === "string" ? body.token : "",
    blocklist: body.blocklist.filter((host) => typeof host === "string"),
    closeBlocked: true,
    closeWatch: createCloseWatch(),
    log: createFrontLog(),
    distractedHosts: [],
    plannedSeconds: Number(body.planned_seconds),
    startedAtMs: Number.isFinite(Date.parse(body.started_at)) ? Date.parse(body.started_at) : Date.now(),
    startedAt: Date.now(),
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
  openFinishWindow();
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
  closeFinishWindow();
  hideBubble();
  setDebug(describeCloseDebug({ session: false }));
}

function openFinishWindow() {
  if (finishWindow && !finishWindow.isDestroyed()) return;
  const win = new BrowserWindow({
    width: 280,
    height: 120,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  finishWindow = win;
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, "finish.html"));
  win.on("closed", () => {
    if (finishWindow === win) finishWindow = null;
  });
  win.webContents.once("did-finish-load", publish);
  placeFinishWindow();
}

function closeFinishWindow() {
  const win = finishWindow;
  finishWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

function placeFinishWindow() {
  if (!finishWindow || finishWindow.isDestroyed() || !spriteWindow || spriteWindow.isDestroyed()) return;
  const [x, y] = spriteWindow.getPosition();
  finishWindow.setPosition(x, y + WINDOW.y + 6);
}

function openBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    placeBubbleWindow();
    return;
  }
  const win = new BrowserWindow({
    width: 260,
    height: 48,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  bubbleWindow = win;
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "bubble.html"));
  win.on("closed", () => {
    if (bubbleWindow === win) bubbleWindow = null;
  });
  win.webContents.once("did-finish-load", publish);
  placeBubbleWindow();
}

function closeBubbleWindow() {
  const win = bubbleWindow;
  bubbleWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

function placeBubbleWindow() {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !spriteWindow || spriteWindow.isDestroyed()) return;
  const [x, y] = spriteWindow.getPosition();
  bubbleWindow.setPosition(x + Math.round((WINDOW.x - 260) / 2), y - 56);
}

function showBubble(host) {
  bubbleHost = host;
  state = { ...state, bubble: `Closing ${host}` };
  openBubbleWindow();
  publish();
}

function hideBubble() {
  bubbleHost = "";
  if (!state.bubble && !(bubbleWindow && !bubbleWindow.isDestroyed())) return;
  state = { ...state, bubble: "" };
  closeBubbleWindow();
  publish();
}

function openDebugWindow() {
  if (debugWindow && !debugWindow.isDestroyed()) return;
  const win = new BrowserWindow({
    width: 460,
    height: 96,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  debugWindow = win;
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "debug.html"));
  win.on("closed", () => {
    if (debugWindow === win) debugWindow = null;
  });
  win.webContents.once("did-finish-load", publish);
  placeDebugWindow();
}

function placeDebugWindow() {
  if (!debugWindow || debugWindow.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  debugWindow.setPosition(area.x + 16, area.y + 16);
}

function setPetLevel(level) {
  for (const win of [spriteWindow, panelWindow, finishWindow, bubbleWindow, debugWindow]) {
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
    const routeSaved = response && (response.status === 200 || response.status === 409);
    if (!routeSaved) {
      const saved = await submitScoreDirect(
        current,
        body,
        postError || `HTTP ${response ? response.status : "none"} ${payload?.error || ""}`.trim(),
      );
      if (study !== current) return;
      if (!saved.ok) {
        setStatus(saved.message, { finishNote: saved.message });
        return;
      }
      if (saved.url) await shell.openExternal(saved.url);
      if (study !== current) return;
      stopFrontWatch();
      hidePet();
      setStatus(saved.message, { finishNote: "" });
      return;
    }
    const result = interpretScoreResponse(response.status, payload, API_ORIGIN, current.id);
    if (!result.clearToken) {
      setStatus(result.message, { finishNote: result.message });
      return;
    }
    if (result.url) await shell.openExternal(result.url);
    if (study !== current) return;
    stopFrontWatch();
    hidePet();
    setStatus(result.message, { finishNote: "" });
  } finally {
    finishing = false;
  }
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
    distraction_seconds: body.distraction_seconds,
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
    if (/study time has not finished/i.test(error.message)) {
      return {
        ok: false,
        url: "",
        message: "Run migration 0027 in Supabase, then click Finish again.",
      };
    }
    if (/distraction_seconds/i.test(error.message)) {
      return {
        ok: false,
        url: "",
        message: "Run migration 0028 in Supabase, then click Finish again.",
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
    const now = Date.now();
    if (reading.url) {
      current.log = nextFrontLog(true, current.log, reading.url, current.blocklist, DESK_HOST, now);
    }
    const preference = await readCloseBlocked();
    if (study !== current) return;
    current.closeBlocked = true;
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
    if (decision.close) {
      showPet();
      showBubble(decision.host);
      const closed = await closeFrontTab(reading.app);
      if (study !== current) return;
      current.closeWatch = noteCloseAttempt(current.closeWatch);
      if (!closed.ok) {
        hideBubble();
        closeError = closed.error || "osascript failed";
        closeNote = `Could not close ${decision.host}. The browser asked you to confirm.`;
      }
    } else if (bubbleHost && (!reading.url || decision.host !== bubbleHost)) {
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
      hidePet();
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
    const result = await claim(link.code);
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

ipcMain.on("pointer-inside", (event, inside) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (inside) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on("toggle-panel", () => {
  togglePanel();
});

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

  app.on("before-quit", () => {
    appQuitting = true;
    stopFrontWatch();
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
    createSprite();
    openPanel();
    openDebugWindow();
    setDebug(describeCloseDebug({ session: false }));
    await loadRemoteConfig();
    await restoreSession();
    void checkForUpdate();
    for (const arg of [...process.argv, ...pendingLinks]) {
      if (arg.startsWith("aurafarm://")) await handleLink(parseAurafarmLink(arg));
    }
    setInterval(walk, 32);
    setInterval(() => {
      void refreshPet();
    }, PET_REFRESH_MS);
  });
}
