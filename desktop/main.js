const { app, BrowserWindow, Menu, clipboard, ipcMain, safeStorage, screen, shell } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");
const { parseAurafarmLink } = require("./links");
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
const { closeFrontWindow, readFrontBrowser } = require("./front-browser");
const { readPetConfig } = require("./config");
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
const PANEL_HEIGHT = 345;
const PANEL_COLLAPSED_HEIGHT = 309;

let panelWindow = null;
let panelOpen = false;
let debugWindow = null;
let bubbleHost = "";
let finishing = false;
let study = null;
let frontTimer = null;
let studyClock = null;
let frontPoll = null;
let appQuitting = false;
let state = {
  petType: "baby_slime",
  level: 1,
  status: "Paste a session token.",
  panelOpen: false,
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
  for (const win of [panelWindow, debugWindow]) {
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
  if (state.panelOpen === panelOpen) return;
  state = { ...state, panelOpen };
  publish();
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
  if (state.remainingLabel !== label || state.timerProgress !== progress) {
    state = { ...state, remainingLabel: label, timerProgress: progress };
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
  for (const win of [panelWindow, debugWindow]) {
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
      if (saved.url) await shell.openExternal(saved.url);
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
    if (result.url) await shell.openExternal(result.url);
    if (study !== current) return;
    stopFrontWatch();
    focusPanel();
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
    current.closeBlocked = true;
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
    if (decision.close) {
      showBubble(decision.host);
      const closed = await closeFrontWindow(reading.app);
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
      placeDebugWindow();
    });
    openPanel();
    openDebugWindow();
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
