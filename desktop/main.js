const { app, BrowserWindow, Menu, ipcMain, safeStorage, screen } = require("electron");
const { createClient } = require("@supabase/supabase-js");
const fs = require("node:fs");
const path = require("node:path");
const { step } = require("./walk");
const { parseAurafarmLink } = require("./links");
const { createFrontLog, deskHostFromOrigin, nextFrontLog } = require("./frontmost");
const { readFrontBrowserUrl } = require("./front-browser");

loadPublicEnv(path.join(__dirname, "..", ".env.local"));

const WINDOW = { x: 128, y: 128 };
const API_ORIGIN = process.env.AURAFARM_API_ORIGIN || "http://localhost:3000";
const DESK_HOST = deskHostFromOrigin(API_ORIGIN);
const HEARTBEAT_MS = 10_000;
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
let velocity = { x: 2, y: 0 };
let deviceToken = "";
let study = null;
let frontTimer = null;
let frontPoll = null;
let state = {
  petType: "baby_slime",
  level: 1,
  status: "Sign in to show the equipped pet.",
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
  for (const win of [spriteWindow, panelWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send("state", state);
  }
}

function setStatus(status, extra = {}) {
  state = { ...state, ...extra, status };
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
    setStatus("Sign in to show the equipped pet.");
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

async function sendHeartbeat() {
  if (!deviceToken) return;
  await fetch(`${API_ORIGIN}/api/pet/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${deviceToken}` },
  }).catch(() => null);
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
    log: createFrontLog(),
  };
  if (body.pet_type) {
    state = {
      ...state,
      petType: body.pet_type,
      level: typeof body.level === "number" ? body.level : state.level,
    };
  }
  publishWatch();
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
}

function publishWatch() {
  if (!study) return;
  const count = study.log.blockedCount;
  const hosts = study.log.blockedHosts.join(", ");
  setStatus(
    count === 0 ? "Watching. Nothing on the blocklist is in front." : `Watching. Blocked ${count}: ${hosts}`,
  );
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
  if (error) return true;
  return data?.status === "active";
}

async function pollFront() {
  if (!study || frontPoll) return;
  const current = study;
  frontPoll = current;
  try {
    const active = await studyStillActive(current.id);
    if (study !== current) return;
    if (!active) {
      stopFrontWatch();
      setStatus("Study session ended.");
      return;
    }
    const url = await readFrontBrowserUrl();
    if (study !== current) return;
    current.log = nextFrontLog(true, current.log, url, current.blocklist, DESK_HOST);
    publishWatch();
  } finally {
    if (frontPoll === current) frontPoll = null;
  }
}

function rememberDevice(token) {
  deviceToken = token;
  writeSecret("device-token.txt", token);
  setStatus("Paired.");
  void sendHeartbeat();
}

async function handleLink(link) {
  if (!link) return;
  if (link.kind === "pair") rememberDevice(link.token);
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
    deviceToken = readSecret("device-token.txt");
    await restoreSession();
    if (deviceToken) void sendHeartbeat();
    for (const arg of [...process.argv, ...pendingLinks]) {
      if (arg.startsWith("aurafarm://")) await handleLink(parseAurafarmLink(arg));
    }
    setInterval(walk, 32);
    setInterval(() => {
      void sendHeartbeat();
      void refreshPet();
    }, HEARTBEAT_MS);
  });
}
