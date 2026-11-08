const { app, BrowserWindow, Menu, ipcMain, safeStorage, screen, shell } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");
const { step } = require("./walk");
const { parseAurafarmLink } = require("./links");
const {
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
const { finishLabel, interpretScoreResponse, scoreRequestBody } = require("./score");
const { updateOffer } = require("./version");
const { version: PET_VERSION } = require("./package.json");

loadPublicEnv(path.join(__dirname, "..", ".env.local"));

const WINDOW = { x: 128, y: 128 };
const API_ORIGIN = process.env.AURAFARM_API_ORIGIN || "http://localhost:3000";
const DESK_HOST = deskHostFromOrigin(API_ORIGIN);
const PET_REFRESH_MS = 10_000;
const FRONT_POLL_MS = 2_000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: true },
      })
    : null;

let spriteWindow = null;
let panelWindow = null;
let finishWindow = null;
let bubbleWindow = null;
let debugWindow = null;
let bubbleHost = "";
let finishing = false;
let velocity = { x: 2, y: 0 };
let study = null;
let frontTimer = null;
let frontPoll = null;
let state = {
  petType: "baby_slime",
  level: 1,
  status: "Paste the launch code from the desk.",
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

function publish() {
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
  const [x, y] = spriteWindow.getPosition();
  const next = step({ x, y }, velocity, WINDOW, usableRects());
  velocity = next.velocity;
  spriteWindow.setPosition(next.position.x, next.position.y);
  placeFinishWindow();
  placeBubbleWindow();
  placeDebugWindow();
}

function createSprite() {
  spriteWindow = new BrowserWindow({
    width: WINDOW.x,
    height: WINDOW.y,
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
  placeOnScreen();
}

function togglePanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.close();
    panelWindow = null;
    return;
  }
  const anchor = spriteWindow ? spriteWindow.getBounds() : { x: 80, y: 80 };
  panelWindow = new BrowserWindow({
    width: 320,
    height: 280,
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
  panelWindow.on("closed", () => {
    panelWindow = null;
  });
  panelWindow.webContents.once("did-finish-load", publish);
}

async function restoreSession() {
  if (!supabase) {
    setStatus("Add the public Supabase keys to .env.local, then restart the pet.");
    return;
  }
  const raw = readSecret("session.json");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    const { error } = await supabase.auth.setSession(saved);
    if (error) {
      setStatus(error.message);
      return;
    }
    await refreshPet();
  } catch {
    setStatus("Paste the launch code from the desk.");
  }
}

async function refreshPet() {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  const { data, error } = await supabase
    .from("user_pets")
    .select("pet_type, level")
    .eq("is_desktop_active", true)
    .maybeSingle();
  if (error) {
    setStatus(error.message);
    return;
  }
  if (!data) {
    if (!study) setStatus("No pet is equipped on the desk.");
    return;
  }
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
  return { error: "" };
}

function beginFrontWatch(body) {
  stopFrontWatch();
  study = {
    id: String(body.session_id),
    // Held in memory for the later score submit. It is not written to disk.
    token: typeof body.token === "string" ? body.token : "",
    blocklist: body.blocklist.filter((host) => typeof host === "string"),
    closeBlocked: body.close_blocked === true,
    closeWatch: createCloseWatch(),
    log: createFrontLog(),
    startedAt: Date.now(),
  };
  if (body.pet_type) {
    state = {
      ...state,
      petType: body.pet_type,
      level: typeof body.level === "number" ? body.level : state.level,
    };
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
  void pollFront();
}

function stopFrontWatch() {
  if (frontTimer) clearInterval(frontTimer);
  frontTimer = null;
  frontPoll = null;
  study = null;
  closeFinishWindow();
  hideBubble();
  setDebug(describeCloseDebug({ session: false }));
}

function openFinishWindow() {
  if (finishWindow && !finishWindow.isDestroyed()) return;
  const win = new BrowserWindow({
    width: 240,
    height: 72,
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
  try {
    const response = await fetch(`${API_ORIGIN}/api/sessions/${current.id}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scoreRequestBody(current, Date.now())),
    });
    const payload = await response.json().catch(() => null);
    console.log(`[score] POST ${current.id} -> ${response.status} ${payload?.error || payload?.url || ""}`);
    if (study !== current) return;
    const result = interpretScoreResponse(response.status, payload, API_ORIGIN, current.id);
    if (!result.clearToken) {
      setStatus(result.message, { finishNote: result.message });
      return;
    }
    if (result.url) await shell.openExternal(result.url);
    if (study !== current) return;
    stopFrontWatch();
    setStatus(result.message, { finishNote: "" });
  } catch {
    if (study === current) {
      setStatus("Could not submit the score. Try again.", {
        finishNote: "Could not submit the score. Try again.",
      });
    }
  } finally {
    finishing = false;
  }
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
    if (preference.value !== null) current.closeBlocked = preference.value;
    const now = Date.now();
    const decision = nextCloseWatch(current.closeWatch, {
      enabled: current.closeBlocked,
      rawUrl: reading.url || "",
      blocklist: current.blocklist,
      deskHost: DESK_HOST,
      now,
    });
    current.closeWatch = decision;
    let closeNote = "";
    let closeError = "";
    if (decision.close) {
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
ipcMain.handle("claim", (_event, code) => claim(String(code ?? "")));
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
      ]),
    );
    createSprite();
    openDebugWindow();
    setDebug(describeCloseDebug({ session: false }));
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
