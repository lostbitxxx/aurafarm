const { app, BrowserWindow, Menu, ipcMain, safeStorage, screen, shell, systemPreferences } = require("electron");
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
const { browserAppName, closeFrontWindow, readFrontAppName, readFrontBrowser, readFrontWindowBounds, readScoreBrowser, scoreBrowserName, supportedFrontBrowser } = require("./front-browser");
const { readPetConfig } = require("./config");
const { clampPetOrigin, parseWindowBounds, petOriginForTabStrip } = require("./pet-move");
const {
  DEFAULTS: DOCK_DEFAULTS,
  nearestEdge,
  overlayLayout,
  petOriginBesidePanel,
  snapOverlay,
} = require("./dock");
const { petDisplayProgress } = require("./xp");
const { finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("./score");
const { remainingStudyMs, studyProgress } = require("./study-clock");
const { updateOffer } = require("./version");
const { version: PET_VERSION } = require("./package.json");
const { chatBubbleCopy, chatBubbleLines, pickChatLineIndex } = require("./chat-bubble");

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

const PANEL_COLLAPSED_WIDTH = DOCK_DEFAULTS.barThickness;
const PANEL_EXPANDED_WIDTH = DOCK_DEFAULTS.panelSpan;
const PANEL_HEIGHT = DOCK_DEFAULTS.panelLength;
const PANEL_COLLAPSED_HEIGHT = DOCK_DEFAULTS.barLength;
const PET_SIZE = DOCK_DEFAULTS.petSize;
/** Extra window height above the sprite for the chat bubble. */
const PET_CHAT_PAD = 64;
/** Pet window width so multi-line chat fits; sprite stays on the rail side. */
const PET_CHAT_WIDTH = 168;
const DOCK_INSET = DOCK_DEFAULTS.inset;
const DOCK_INSET_BOTTOM = DOCK_DEFAULTS.insetBottom;

let panelWindow = null;
let panelOpen = false;
let petWindow = null;
let petAnimating = false;
/** True while the pet is walking to close a distracted tab. */
let petClosing = false;
/** Last known “on blocklist host” for chat copy between polls. */
let onDistractedHost = false;
/** Rotates multi-line chat while the same scenario stays up. */
let chatLineIndex = 0;
let chatLineTick = 0;
let chatLineScenario = "";
const CHAT_LINE_TICKS = 3;
let finishing = false;
let study = null;
let lastBrowserApp = "";
let lastSeenFront = "";
let notingFront = false;
let frontTimer = null;
let studyClock = null;
let frontPoll = null;
let appQuitting = false;
/** @type {{ edge: "left"|"right"|"top", offset: number }} */
let dock = { edge: "right", offset: 0 };
/** @type {null | { grabX: number, grabY: number, width: number, height: number }} */
let dockDrag = null;
let panelToggleSeq = 0;
/** @type {string | null} */
let statsPetId = null;
let statsRefreshSeq = 0;
let state = {
  petType: "baby_slime",
  level: null,
  statsPetId: null,
  sessionProgress: 0,
  status: "Let's study together!",
  panelOpen: false,
  panelPetVisible: false,
  petPose: "idle",
  petFlip: false,
  dockEdge: "right",
  chatBubble: "",
  chatBubbleScope: "none",
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

function everDistractedThisSession() {
  if (!study) return false;
  if (study.log?.blockedCount > 0) return true;
  return Array.isArray(study.distractedHosts) && study.distractedHosts.length > 0;
}

function chatScenarioKey() {
  const host = onDistractedHost ? String(study?.closeWatch?.host || "") : "";
  return [
    Boolean(study?.token),
    petClosing,
    onDistractedHost,
    everDistractedThisSession(),
    panelOpen,
    host,
  ].join("|");
}

function chatBubbleInput() {
  return {
    sessionActive: Boolean(study?.token),
    closing: petClosing,
    onDistracted: onDistractedHost,
    everDistracted: everDistractedThisSession(),
    panelOpen,
    host: onDistractedHost ? study?.closeWatch?.host || "" : "",
  };
}

function syncChatBubble(options = {}) {
  if (typeof options.onDistracted === "boolean") onDistractedHost = options.onDistracted;
  const scenario = chatScenarioKey();
  if (scenario !== chatLineScenario) {
    const wasOpen = chatLineScenario.split("|")[4] === "true";
    chatLineScenario = scenario;
    chatLineTick = 0;
    const preview = chatBubbleLines(chatBubbleInput());
    const openingBarLines = panelOpen && !wasOpen && preview.scope === "panel";
    chatLineIndex = openingBarLines ? pickChatLineIndex(preview.lines.length) : 0;
  }
  const copy = chatBubbleCopy({
    ...chatBubbleInput(),
    lineIndex: chatLineIndex,
  });
  const panelPetVisible = panelOpen && !petAnimating;
  if (
    state.chatBubble === copy.text &&
    state.chatBubbleScope === copy.scope &&
    state.panelPetVisible === panelPetVisible
  ) {
    return false;
  }
  state = {
    ...state,
    chatBubble: copy.text,
    chatBubbleScope: copy.scope,
    panelPetVisible,
  };
  return true;
}

function publish() {
  petLog(`[pet] showing ${state.petType || "baby_slime"} level ${state.level}`);
  syncChatBubble();
  const payload = {
    ...state,
    assetOrigin: API_ORIGIN,
    finishLabel: study?.token ? finishLabel(study.log.blockedCount) : "",
    panelPetVisible: panelOpen && !petAnimating,
  };
  for (const win of [panelWindow, petWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send("state", payload);
  }
}

/**
 * Pet BrowserWindow around a fixed sprite origin.
 * Sprite stays put beside the rail; the wider chat extends away from the dock edge.
 */
function petWindowRect(spriteOrigin, edge = dock.edge) {
  const overhang = Math.max(0, PET_CHAT_WIDTH - PET_SIZE);
  let x;
  let y = Math.round(spriteOrigin.y - PET_CHAT_PAD);
  let height = PET_SIZE + PET_CHAT_PAD;
  if (edge === "right") {
    // Sprite on the right (toward the rail); chat grows left.
    x = Math.round(spriteOrigin.x - overhang);
  } else if (edge === "left") {
    // Sprite on the left (toward the rail); chat grows right.
    x = Math.round(spriteOrigin.x);
  } else if (edge === "top") {
    // Keep the sprite under the rail; put chat beside it (no pad above into the bar).
    x = Math.round(spriteOrigin.x - overhang);
    y = Math.round(spriteOrigin.y);
    height = PET_SIZE;
  } else {
    x = Math.round(spriteOrigin.x - overhang / 2);
  }
  return {
    x,
    y,
    width: PET_CHAT_WIDTH,
    height,
  };
}

function friendlyStatus(status) {
  const text = String(status ?? "");
  if (/refresh token/i.test(text)) return "Let's study together!";
  return text;
}

function setStatus(status, extra = {}) {
  state = { ...state, ...extra, status: friendlyStatus(status) };
  publish();
}

function setDebug(debug) {
  const line = String(debug || "");
  if (state.debug === line) return;
  state = { ...state, debug: line };
  console.log(line);
  publish();
}

function dockOptions() {
  return {
    inset: DOCK_INSET,
    insetBottom: DOCK_INSET_BOTTOM,
    petSize: PET_SIZE,
    barThickness: PANEL_COLLAPSED_WIDTH,
    barLength: PANEL_COLLAPSED_HEIGHT,
    panelSpan: PANEL_EXPANDED_WIDTH,
    panelLength: PANEL_HEIGHT,
    handleSize: DOCK_DEFAULTS.handleSize,
    levelSize: 0,
    chromePad: DOCK_DEFAULTS.chromePad,
  };
}

function applyEquippedPetStats(row) {
  const display = petDisplayProgress(row);
  const petType = typeof row?.pet_type === "string" && row.pet_type ? row.pet_type : state.petType;
  statsPetId = display.petId;
  state = {
    ...state,
    petType,
    level: display.level,
    statsPetId: display.petId,
  };
}

function setSessionProgress(progress) {
  const next =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : 0;
  if (Math.abs((state.sessionProgress || 0) - next) < 0.002) return false;
  state = { ...state, sessionProgress: next };
  return true;
}

function syncSessionProgress(now = Date.now()) {
  if (!study) return setSessionProgress(0);
  const progress = studyProgress(study, now);
  if (progress === null) return setSessionProgress(0);
  return setSessionProgress(progress);
}

function prefersReducedMotion() {
  try {
    if (typeof systemPreferences.getAnimationSettings === "function") {
      const settings = systemPreferences.getAnimationSettings();
      if (settings && settings.shouldRenderRichAnimation === false) return true;
    }
  } catch {
    // Fall through to no preference.
  }
  return false;
}

function syncPanelOpenState() {
  if (state.panelOpen === panelOpen) {
    publish();
    return;
  }
  state = { ...state, panelOpen };
  publish();
}

/** Content fade in/out — keep in sync with `#panel-body` opacity transition. */
const PANEL_SURFACE_MS = 200;
/** Native macOS `setBounds(..., true)` window morph duration. */
const PANEL_BOUNDS_MS = 280;

/**
 * Resize the cream shell. Prefer native animated bounds on macOS; skip pet moves mid-morph
 * so the sprite does not jump to the destination before the window finishes expanding.
 */
function applyPanelBounds(mode, { animate = false, movePet = true } = {}) {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  const useAnimate = Boolean(animate) && !prefersReducedMotion();
  win.setBounds(panelBounds(mode), useAnimate);
  if (movePet) placePet();
}

function dockWorkArea(point) {
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    return screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) }).workArea;
  }
  if (panelWindow && !panelWindow.isDestroyed()) {
    const bounds = panelWindow.getBounds();
    return screen.getDisplayNearestPoint({
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
    }).workArea;
  }
  return screen.getPrimaryDisplay().workArea;
}

function currentOverlay(open = panelOpen, point) {
  const area = dockWorkArea(point);
  const mode = open === true ? "open" : open === false ? "closed" : open;
  return overlayLayout(dock.edge, dock.offset, mode, area, dockOptions());
}

function panelBounds(open) {
  return currentOverlay(open).panel;
}

function placePanel() {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  // Native + CSS shadows stacked a ghost frame around the transparent pad.
  win.setHasShadow(false);
  win.setBounds(panelBounds(panelOpen), true);
}

function setDockEdgeState(edge) {
  if (state.dockEdge === edge) return;
  state = { ...state, dockEdge: edge };
  publish();
}

function setPanelOpen(open) {
  const next = Boolean(open);
  if (next === panelOpen && !dockDrag) {
    placePanel();
    placePet();
    syncPanelOpenState();
    return;
  }
  const seq = ++panelToggleSeq;
  const reduced = prefersReducedMotion();
  if (next) {
    // One smooth widen/grow (sides widen; top grows down). Fade content after the shell settles.
    void (async () => {
      applyPanelBounds("open", { animate: !reduced, movePet: false });
      if (!reduced) {
        await waitMs(PANEL_BOUNDS_MS);
        if (seq !== panelToggleSeq) return;
      }
      panelOpen = true;
      placePet();
      syncPanelOpenState();
    })();
    return;
  }
  // Fade content out, then smoothly collapse the shell; pet returns beside the rail.
  panelOpen = false;
  placePet();
  syncPanelOpenState();
  void (async () => {
    if (!reduced) {
      await waitMs(PANEL_SURFACE_MS);
      if (seq !== panelToggleSeq) return;
    }
    applyPanelBounds("closed", { animate: !reduced, movePet: false });
    if (!reduced) {
      await waitMs(PANEL_BOUNDS_MS);
      if (seq !== panelToggleSeq) return;
    }
    placePet();
  })();
}

function petBounds() {
  return currentOverlay(panelOpen).pet;
}

function placePet() {
  if (petAnimating || dockDrag) return;
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  // Open bar hosts the pet inside the cream shell; keep the external window for closed / walk-away.
  if (panelOpen) {
    win.hide();
    return;
  }
  if (panelWindow && !panelWindow.isDestroyed()) {
    const panelRect = panelWindow.getBounds();
    const area = dockWorkArea({
      x: panelRect.x + panelRect.width / 2,
      y: panelRect.y + panelRect.height / 2,
    });
    const origin = petOriginBesidePanel(dock.edge, panelRect, PET_SIZE, area, dockOptions());
    win.setBounds(petWindowRect(origin), false);
    hardenOverlayWindow(win);
    win.showInactive();
    return;
  }
  win.setBounds(petWindowRect(petBounds()), true);
  hardenOverlayWindow(win);
  win.showInactive();
}

function placeOverlayFloating(panelRect, pointer) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.setBounds(
      {
        x: Math.round(panelRect.x),
        y: Math.round(panelRect.y),
        width: Math.round(panelRect.width),
        height: Math.round(panelRect.height),
      },
      false,
    );
  }
  if (!petWindow || petWindow.isDestroyed() || petAnimating || panelOpen) return;
  const cx = Number.isFinite(pointer?.x) ? pointer.x : panelRect.x + panelRect.width / 2;
  const cy = Number.isFinite(pointer?.y) ? pointer.y : panelRect.y + panelRect.height / 2;
  const area = dockWorkArea({ x: cx, y: cy });
  const edge = nearestEdge(cx, cy, area);
  const origin = petOriginBesidePanel(edge, panelRect, PET_SIZE, area, dockOptions());
  petWindow.setBounds(petWindowRect(origin), false);
}

function beginDockDrag(screenX, screenY) {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
  const bounds = win.getBounds();
  dockDrag = {
    grabX: screenX - bounds.x,
    grabY: screenY - bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function moveDockDrag(screenX, screenY) {
  if (!dockDrag) return;
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
  const x = Math.round(screenX - dockDrag.grabX);
  const y = Math.round(screenY - dockDrag.grabY);
  placeOverlayFloating({ x, y, width: dockDrag.width, height: dockDrag.height }, { x: screenX, y: screenY });
}

function endDockDrag(screenX, screenY) {
  if (!dockDrag) return;
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    cancelDockDrag();
    return;
  }
  const floating = {
    x: Math.round(screenX - dockDrag.grabX),
    y: Math.round(screenY - dockDrag.grabY),
    width: dockDrag.width,
    height: dockDrag.height,
  };
  dockDrag = null;
  const area = dockWorkArea({ x: screenX, y: screenY });
  const snapped = snapOverlay(floating, { x: screenX, y: screenY }, area, panelOpen, dockOptions());
  dock = { edge: snapped.edge, offset: snapped.offset };
  setDockEdgeState(snapped.edge);
  placePanel();
  placePet();
}

function cancelDockDrag() {
  if (!dockDrag) return;
  dockDrag = null;
  placePanel();
  placePet();
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
  const home = petWindowRect(petBounds());
  await walkPetTo(home.x, home.y);
  setPetPose("idle", false);
}

async function finishPetApproach() {
  try {
    await returnPetHome();
  } finally {
    petClosing = false;
    petAnimating = false;
    setPetPose("idle", false);
    placePet();
    publish();
  }
}

async function closeFrontTab(appName, host) {
  let animated = false;
  if (petWindow && !petWindow.isDestroyed()) {
    const bounds = await readFrontWindowBounds(appName);
    const parsed = bounds.ok ? parseWindowBounds(bounds.value) : null;
    if (parsed) {
      petClosing = true;
      petAnimating = true;
      animated = true;
      publish();
      try {
        // Leave the open bar and appear at the dock home before walking to the tab strip.
        const home = petWindowRect(petBounds());
        petWindow.setBounds(home, false);
        hardenOverlayWindow(petWindow);
        petWindow.showInactive();
        const origin = petOriginForTabStrip(parsed, PET_SIZE);
        const display = screen.getDisplayNearestPoint({
          x: origin.x + PET_SIZE / 2,
          y: origin.y + PET_SIZE / 2,
        });
        const aim = clampPetOrigin(origin, PET_SIZE, display.bounds);
        const target = petWindowRect(aim);
        await walkPetTo(target.x, target.y);
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

function hardenOverlayWindow(win) {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function openPet() {
  if (petWindow && !petWindow.isDestroyed()) {
    placePet();
    return;
  }
  const bounds = petWindowRect(petBounds());
  petWindow = new BrowserWindow({
    ...bounds,
    show: !panelOpen,
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
  hardenOverlayWindow(petWindow);
  // Forward hits so the sprite can opt into drag without blocking the desktop.
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, "pet.html"));
  petWindow.on("closed", () => {
    petWindow = null;
    if (!appQuitting) setImmediate(() => openPet());
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

function openPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    hardenOverlayWindow(panelWindow);
    panelWindow.show();
    return;
  }
  const bounds = panelBounds(panelOpen);
  panelWindow = new BrowserWindow({
    ...bounds,
    show: true,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Aurafarm",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  hardenOverlayWindow(panelWindow);
  panelWindow.loadFile(path.join(__dirname, "panel.html"));
  panelWindow.on("closed", () => {
    panelWindow = null;
    if (!appQuitting) setImmediate(() => openPanel());
  });
  panelWindow.webContents.once("did-finish-load", () => {
    hardenOverlayWindow(panelWindow);
    if (panelWindow && !panelWindow.isDestroyed()) panelWindow.show();
    publish();
  });
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
    setStatus("Let's study together!");
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
  const refreshSeq = ++statsRefreshSeq;
  const { data, error } = await supabase
    .from("user_pets")
    .select("id, pet_type, level, xp")
    .eq("is_desktop_active", true)
    .maybeSingle();
  if (refreshSeq !== statsRefreshSeq) return;
  if (error) {
    petLog(`[pet] equipped pet query failed: ${error.message}`);
    setStatus(error.message);
    return;
  }
  if (!data) {
    petLog("[pet] signed in, but no user_pets row has is_desktop_active = true.");
    return;
  }
  applyEquippedPetStats(data);
  petLog(
    `[pet] equipped ${state.petType} level ${state.level ?? "?"} for ${sessionData.session.user?.id ?? "unknown"}`,
  );
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

async function cancelStudy() {
  if (!supabase) return { error: "Supabase is not configured." };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { error: "No signed-in pet session." };
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
  const progressChanged = syncSessionProgress(now);
  const countdown = study.closeBlocked ? closeCountdownStatus(study.closeWatch, now) : "";
  const statusChanged = Boolean(countdown && state.status !== countdown);
  if (statusChanged) state = { ...state, status: countdown };
  if (progressChanged || statusChanged) publish();
  advanceChatLine();
  // Countdown UI lives on the desk site; the pet only auto-finishes when time is up.
  if (remaining !== null && remaining <= 0) {
    setSessionProgress(1);
    publish();
    void finishSession();
  }
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

function advanceChatLine() {
  chatLineTick += 1;
  if (chatLineTick < CHAT_LINE_TICKS) return;
  chatLineTick = 0;
  chatLineIndex += 1;
  if (syncChatBubble()) publish();
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
      `[pet] claim equipped ${body.pet_type} level ${typeof body.level === "number" ? body.level : state.level ?? "?"}`,
    );
    // Sprite type can update immediately; level waits for refreshPet.
    state = { ...state, petType: body.pet_type };
  } else {
    petLog("[pet] claim returned no pet_type, so the character stays as it is.");
  }
  state = { ...state, finishNote: "" };
  syncSessionProgress(Date.now());
  void refreshPet();
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
  petClosing = false;
  onDistractedHost = false;
  chatLineIndex = 0;
  chatLineTick = 0;
  chatLineScenario = "";
  state = { ...state, chatBubble: "", chatBubbleScope: "none", sessionProgress: 0 };
  const debugBefore = state.debug;
  setDebug(describeCloseDebug({ session: false }));
  if (state.debug === debugBefore) publish();
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
    const leftBrowser = Boolean(reading.app) && !reading.error && !supportedFrontBrowser(reading.app);
    const decision = nextCloseWatch(current.closeWatch, {
      enabled: true,
      rawUrl: reading.url || "",
      blocklist: current.blocklist,
      deskHost: DESK_HOST,
      now,
      leftBrowser,
    });
    current.closeWatch = decision;
    if (decision.host && decision.since > 0 && now - decision.since >= CLOSE_AFTER_MS) {
      if (!current.distractedHosts.includes(decision.host)) {
        current.distractedHosts = [...current.distractedHosts, decision.host];
      }
    }
    let closeNote = "";
    let closeError = "";
    const onDistracted = Boolean(decision.host);
    syncChatBubble({ onDistracted });
    if (decision.close && current.closeBlocked) {
      const closed = await closeFrontTab(reading.app, decision.host);
      if (study !== current) return;
      if (closed.skipped) {
        syncChatBubble({ onDistracted: Boolean(decision.host) });
      } else {
        current.closeWatch = noteCloseAttempt(current.closeWatch);
        if (!closed.ok) {
          syncChatBubble({ onDistracted: Boolean(decision.host) });
          closeError = closed.error || "osascript failed";
          closeNote = `Could not close ${decision.host}. The browser asked you to confirm.`;
        }
      }
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
ipcMain.on("pet-ignore-mouse", (_event, ignore) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (ignore) petWindow.setIgnoreMouseEvents(true, { forward: true });
  else petWindow.setIgnoreMouseEvents(false);
});
ipcMain.on("dock-drag-start", (_event, point) => {
  beginDockDrag(Number(point?.x), Number(point?.y));
});
ipcMain.on("dock-drag-move", (_event, point) => {
  moveDockDrag(Number(point?.x), Number(point?.y));
});
ipcMain.on("dock-drag-end", (_event, point) => {
  endDockDrag(Number(point?.x), Number(point?.y));
});
ipcMain.on("dock-drag-cancel", () => {
  cancelDockDrag();
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
      if (dockDrag) cancelDockDrag();
      const area = dockWorkArea();
      const layout = overlayLayout(dock.edge, dock.offset, panelOpen, area, dockOptions());
      dock = { edge: layout.edge, offset: layout.offset };
      setDockEdgeState(layout.edge);
      placePanel();
      placePet();
    });
    {
      const display = screen.getPrimaryDisplay();
      const area = display.workArea;
      console.log(
        `[pet] display bounds=${JSON.stringify(display.bounds)} workArea=${JSON.stringify(area)} scale=${display.scaleFactor}`,
      );
      const bottomRight = overlayLayout("right", Number.MAX_SAFE_INTEGER, false, area, dockOptions());
      dock = { edge: "right", offset: bottomRight.offset };
      state = { ...state, dockEdge: "right" };
      console.log(`[pet] dock panel=${JSON.stringify(bottomRight.panel)} pet=${JSON.stringify(bottomRight.pet)}`);
    }
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
