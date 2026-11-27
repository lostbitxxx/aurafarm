const { app, BrowserWindow, Menu, ipcMain, net, protocol, safeStorage, screen, shell, systemPreferences } = require("electron");
const { pathToFileURL } = require("node:url");
const { createClient } = require("@supabase/supabase-js");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { launchLinksFromArgs, parseAurafarmLink } = require("./links");
const { ensureDevProtocolHandler, pendingLaunchFile, takePendingLaunchLinks } = require("./dev-protocol-app");
const {
  CLOSE_AFTER_MS,
  createCloseWatch,
  createFrontLog,
  describeCloseDebug,
  describeFrontRead,
  closeCountdownStatus,
  deskHostFromOrigin,
  distractionPhase,
  nextCloseWatch,
  nextFrontLog,
  noteCloseAttempt,
  hostnameFromUrl,
} = require("./frontmost");
const { browserAppName, closeFrontWindow, readFrontAppName, readFrontBrowser, readFrontWindowBounds, readScoreBrowser, scoreBrowserName, supportedFrontBrowser } = require("./front-browser");
const { readPetConfig } = require("./config");
const { clampPetOrigin, parseWindowBounds, petOriginForTabStrip } = require("./pet-move");
const { parseWeekdays, restingPetPose } = require("./pet-art");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pet-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
const {
  DEFAULTS: DOCK_DEFAULTS,
  nearestEdge,
  overlayLayout,
  petOriginBesidePanel,
  snapOverlay,
} = require("./dock");
const { petDisplayProgress } = require("./xp");
const { finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("./score");
const { formatSessionClock, remainingStudyMs, studyProgress } = require("./study-clock");
const { updateOffer } = require("./version");
const { version: PET_VERSION } = require("./package.json");
const { CHAT_CLOSING, chatBubbleCopy, chatBubbleLines, takeShuffledLine } = require("./chat-bubble");

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
/** Closed-bar peek: extra window depth so the tilted head can stick past the rail. */
const PEEK_PAD = 112;
/** Floating close-flight window, native size of the boom GIF (142×200). */
const FLIGHT_W = 142;
const FLIGHT_H = 200;
const FLIGHT_AIM_MS = 180;
const FLIGHT_ROCKET_MS = 480;
const FLIGHT_BOOM_CLOSE_MS = 150;
/** One play of boom.gif (17×100ms) after the close delay. */
const FLIGHT_BOOM_HOLD_MS = 1550;
const FLIGHT_RETURN_MS = 520;
const DOCK_INSET = DOCK_DEFAULTS.inset;
const DOCK_INSET_BOTTOM = DOCK_DEFAULTS.insetBottom;

let panelWindow = null;
let panelOpen = false;
/** OS window is already the open size (one instant setBounds, no native morph). */
let panelBoundsOpen = false;
/** Cream outline is showing. Sideways expand is `panelOpen`. */
let panelFrameOpen = false;
let petWindow = null;
let petAnimating = false;
/** True while the pet is rocket-closing a distracted tab. */
let petClosing = false;
/** Last known “on blocklist host” for chat copy between polls. */
let onDistractedHost = false;
/** Study clock and bar fill pause while a blocked site is front. */
let distractionPausedMs = 0;
let distractionPauseStart = 0;
/** Rotates multi-line chat while the same scenario stays up. */
let chatLineIndex = 0;
let chatLineTick = 0;
let chatLineScenario = "";
/** Remaining line indexes for this set. Empties before any line repeats. */
let chatLineBag = [];
/** Distraction / peek / closing: advance every N seconds. */
const CHAT_LINE_TICKS = 3;
/** Open-bar idle: show a line, then silence, then a new random line. */
const CHAT_SHOW_TICKS = 5;
const CHAT_SILENCE_TICKS = 60;
/** @type {"show" | "silence"} */
let chatIdlePhase = "show";
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
  petColor: null,
  petHat: null,
  petClothes: null,
  studyDays: [],
  restDays: [],
  level: null,
  statsPetId: null,
  sessionProgress: 0,
  sessionClock: "",
  status: "Let's study together!",
  panelOpen: false,
  panelFrameOpen: false,
  panelBoundsOpen: true,
  panelPetVisible: false,
  panelPeeking: false,
  distractionPhase: "none",
  petPose: "idle",
  petFlip: false,
  dockEdge: "right",
  chatBubble: "",
  chatBubbleScope: "none",
  flightActive: false,
  flightAngle: 0,
  flightScaleX: 1,
  flightBoom: false,
};
const pendingLinks = [];
let acceptLaunchLinks = false;

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

function currentDistractionPhase() {
  if (!onDistractedHost || !study?.closeWatch) return "none";
  return distractionPhase(study.closeWatch, Date.now());
}

function chatScenarioKey() {
  const host = onDistractedHost ? String(study?.closeWatch?.host || "") : "";
  return [
    Boolean(study?.token),
    petClosing,
    onDistractedHost,
    currentDistractionPhase(),
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
    distractionPhase: currentDistractionPhase(),
    everDistracted: everDistractedThisSession(),
    panelOpen,
    host: onDistractedHost ? study?.closeWatch?.host || "" : "",
  };
}

function nextChatLine(count, fresh = false) {
  if (fresh) chatLineBag = [];
  const next = takeShuffledLine(chatLineBag, count, fresh ? -1 : chatLineIndex);
  chatLineIndex = next;
  return next;
}

function isOpenBarIdleChat(preview) {
  return (
    preview.scope === "panel" &&
    !onDistractedHost &&
    !petClosing &&
    Boolean(study?.token) &&
    panelOpen
  );
}

function syncChatBubble(options = {}) {
  if (typeof options.onDistracted === "boolean") onDistractedHost = options.onDistracted;
  noteDistractionPause(onDistractedHost);
  const phase = currentDistractionPhase();
  const peeking = Boolean(onDistractedHost && phase !== "none" && !panelOpen);
  const scenario = chatScenarioKey();
  const preview = chatBubbleLines(chatBubbleInput());
  if (scenario !== chatLineScenario) {
    chatLineScenario = scenario;
    chatLineTick = 0;
    chatIdlePhase = "show";
    nextChatLine(preview.lines.length, true);
  }
  const copy = chatBubbleCopy({
    ...chatBubbleInput(),
    lineIndex: chatLineIndex,
  });
  const silentIdle = isOpenBarIdleChat(preview) && chatIdlePhase === "silence";
  const text = silentIdle ? "" : copy.text;
  const scope = copy.scope;
  const flying = state.flightActive === true;
  const panelPetVisible = panelOpen && !flying;
  const nextPeeking = peeking && !flying;
  const nextScope = flying ? "none" : scope;
  const nextText = flying ? "" : text;
  if (
    state.chatBubble === nextText &&
    state.chatBubbleScope === nextScope &&
    state.panelPetVisible === panelPetVisible &&
    state.panelPeeking === nextPeeking &&
    state.distractionPhase === phase
  ) {
    return false;
  }
  state = {
    ...state,
    chatBubble: nextText,
    chatBubbleScope: nextScope,
    panelPetVisible,
    panelPeeking: nextPeeking,
    distractionPhase: phase,
  };
  return true;
}

function applyRestingPetPose() {
  // Close-flight owns the face (struggle → idle under boom); don't fight it.
  if (state.flightActive) return;
  const phase = currentDistractionPhase();
  const pose = restingPetPose({
    sessionActive: Boolean(study?.token),
    onDistracted: onDistractedHost,
    mad: phase === "mad",
    closing: petClosing,
    animating: petAnimating,
    currentPose: state.petPose,
  });
  if (state.petPose === pose) return;
  state = { ...state, petPose: pose };
}

function publish() {
  applyRestingPetPose();
  petLog(`[pet] showing ${state.petType || "baby_slime"} level ${state.level}`);
  syncChatBubble();
  syncPeekBounds();
  const flying = state.flightActive === true;
  const payload = {
    ...state,
    assetOrigin: petAssetOrigin(),
    finishLabel: study?.token ? finishLabel(study.log.blockedCount) : "",
    panelPetVisible: panelOpen && !flying,
    panelPeeking: Boolean(state.panelPeeking) && !flying,
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

function optionalLook(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

/** ISO weekdays from a claim payload. Invalid entries are dropped. */
function claimWeekdays(value) {
  return parseWeekdays(value);
}

function claimLevel(value) {
  const level = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(level)) return null;
  return Math.max(0, Math.floor(level));
}

function petAssetRoot() {
  return path.join(__dirname, "..", "public");
}

/** Layered sprites live in this repo. The desk origin is only a fallback for a packed app. */
function petAssetOrigin() {
  const marker = path.join(petAssetRoot(), "pet-assets", "pets", "cat", "colors", "sage", "body.svg");
  return fs.existsSync(marker) ? "pet-asset://local" : API_ORIGIN;
}

function registerPetAssets() {
  if (petAssetOrigin() !== "pet-asset://local") return;
  const root = petAssetRoot();
  protocol.handle("pet-asset", (request) => {
    let rel = "";
    try {
      rel = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response("bad path", { status: 400 });
    }
    const file = path.normalize(path.join(root, rel));
    if (file !== root && !file.startsWith(root + path.sep)) {
      return new Response("forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(file).href);
  });
}

function loadOverlay(win, file) {
  const filePath = path.join(__dirname, file);
  const load = () =>
    win.loadFile(filePath, {
      query: { v: String(fs.statSync(filePath).mtimeMs) },
    });
  const clearing = win.webContents.session.clearCache();
  if (clearing && typeof clearing.then === "function") return clearing.then(load);
  return load();
}

function applyEquippedPetStats(row) {
  const display = petDisplayProgress(row);
  const petType = typeof row?.pet_type === "string" && row.pet_type ? row.pet_type : state.petType;
  statsPetId = display.petId;
  const next = {
    ...state,
    petType,
    level: display.level,
    statsPetId: display.petId,
  };
  if (row && Object.prototype.hasOwnProperty.call(row, "color")) next.petColor = optionalLook(row.color);
  if (row && Object.prototype.hasOwnProperty.call(row, "hat")) next.petHat = optionalLook(row.hat);
  if (row && Object.prototype.hasOwnProperty.call(row, "clothes")) next.petClothes = optionalLook(row.clothes);
  state = next;
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

function noteDistractionPause(active, now = Date.now()) {
  if (active) {
    if (!distractionPauseStart) distractionPauseStart = now;
    return;
  }
  if (!distractionPauseStart) return;
  distractionPausedMs += Math.max(0, now - distractionPauseStart);
  distractionPauseStart = 0;
}

/** Wall clock with blocked-site time removed, so the session timer and bar hold. */
function studyClockNow(now = Date.now()) {
  const live = distractionPauseStart ? Math.max(0, now - distractionPauseStart) : 0;
  return now - distractionPausedMs - live;
}

function syncSessionProgress(now = Date.now()) {
  if (!study) return setSessionProgress(0);
  const progress = studyProgress(study, studyClockNow(now));
  if (progress === null) return setSessionProgress(0);
  return setSessionProgress(progress);
}

function syncSessionClock(now = Date.now()) {
  if (!study) {
    if (!state.sessionClock) return false;
    state = { ...state, sessionClock: "" };
    return true;
  }
  const remaining = remainingStudyMs(study, studyClockNow(now));
  const next = remaining === null ? "" : formatSessionClock(remaining);
  if (state.sessionClock === next) return false;
  state = { ...state, sessionClock: next };
  return true;
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
  const frameOpen = Boolean(panelFrameOpen || panelOpen);
  // Right dock keeps the open window, so the clip stays on and x never jumps.
  const boundsOpen = Boolean(panelBoundsOpen || panelOpen || dock.edge === "right");
  if (
    state.panelOpen === panelOpen &&
    state.panelFrameOpen === frameOpen &&
    state.panelBoundsOpen === boundsOpen
  ) {
    publish();
    return;
  }
  state = { ...state, panelOpen, panelFrameOpen: frameOpen, panelBoundsOpen: boundsOpen };
  publish();
}

/** Content fade in/out — keep in sync with `#panel-body` opacity transition. */
const PANEL_SURFACE_MS = 200;
/** Window is already open-sized before the cream outline appears. */
const PANEL_REVEAL_MS = 80;
/** Hold cream outline on the time bar before sideways expand. */
const PANEL_OUTLINE_MS = 160;
/** CSS sideways expand/collapse — keep in sync with `#shell` clip-path transition. */
const PANEL_EXPAND_MS = 280;

/**
 * Set the OS window to open or closed bounds in one shot (no native morph).
 * Visual widen/collapse is CSS inside the already-sized transparent window.
 */
function applyPanelBounds(mode, { movePet = true } = {}) {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  const open = mode === "open" || mode === true;
  win.setBounds(panelBoundsForDisplay(open), false);
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
  // Left and top grow from a fixed window origin. The right edge would have to move x
  // when the width changes, and macOS sometimes paints that resize from the top-left.
  if (dock.edge === "right") return currentOverlay("open").panel;
  return currentOverlay(open).panel;
}

/** Closed left/top strip grows by PEEK_PAD so the peek head can stick out past the rail. */
function panelBoundsForDisplay(open = panelOpen || panelBoundsOpen) {
  const bounds = panelBounds(open);
  const peeking = Boolean(state.panelPeeking) && !panelOpen;
  if (!peeking) return bounds;
  if (dock.edge === "left") {
    return { ...bounds, width: bounds.width + PEEK_PAD };
  }
  if (dock.edge === "top") {
    return { ...bounds, height: bounds.height + PEEK_PAD };
  }
  // Right already uses open-sized bounds; CSS clip expands into the peek zone.
  return bounds;
}

function syncPeekBounds() {
  const win = panelWindow;
  if (!win || win.isDestroyed() || dockDrag) return;
  if (panelOpen || dock.edge === "right") return;
  win.setBounds(panelBoundsForDisplay(panelOpen || panelBoundsOpen), false);
}

function placePanel() {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return;
  // Native + CSS shadows stacked a ghost frame around the transparent pad.
  win.setHasShadow(false);
  win.setBounds(panelBoundsForDisplay(panelOpen || panelBoundsOpen), false);
}

function setDockEdgeState(edge) {
  if (edge === "right") panelBoundsOpen = true;
  else if (!panelOpen) panelBoundsOpen = false;
  if (state.dockEdge === edge) {
    syncPanelOpenState();
    return;
  }
  state = { ...state, dockEdge: edge };
  syncPanelOpenState();
}

function setPanelOpen(open) {
  const next = Boolean(open);
  const boundsSettled = dock.edge === "right" ? panelBoundsOpen : next === panelBoundsOpen;
  const settled = next === panelOpen && next === panelFrameOpen && boundsSettled;
  if (settled && !dockDrag) {
    placePanel();
    placePet();
    syncPanelOpenState();
    return;
  }
  const seq = ++panelToggleSeq;
  const reduced = prefersReducedMotion();
  if (next) {
    // 1) Instant open-sized window  2) cream outline on the time bar  3) extend sideways.
    void (async () => {
      if (dock.edge !== "right") applyPanelBounds("open", { movePet: false });
      panelBoundsOpen = true;
      panelFrameOpen = false;
      panelOpen = false;
      placePet();
      syncPanelOpenState();
      if (!reduced) {
        await waitMs(PANEL_REVEAL_MS);
        if (seq !== panelToggleSeq) return;
      }
      panelFrameOpen = true;
      placePet();
      syncPanelOpenState();
      if (!reduced) {
        await waitMs(PANEL_OUTLINE_MS);
        if (seq !== panelToggleSeq) return;
      }
      panelOpen = true;
      placePet();
      syncPanelOpenState();
    })();
    return;
  }
  // 1) Collapse cream sideways to the time bar  2) thin window  3) drop cream outline.
  panelOpen = false;
  panelFrameOpen = true;
  panelBoundsOpen = true;
  placePet();
  syncPanelOpenState();
  void (async () => {
    if (!reduced) {
      await waitMs(Math.max(PANEL_SURFACE_MS, PANEL_EXPAND_MS));
      if (seq !== panelToggleSeq) return;
    }
    if (dock.edge !== "right") {
      applyPanelBounds("closed", { movePet: false });
      panelBoundsOpen = false;
    } else {
      panelBoundsOpen = true;
    }
    placePet();
    syncPanelOpenState();
    if (!reduced) {
      await waitMs(PANEL_OUTLINE_MS);
      if (seq !== panelToggleSeq) return;
    }
    panelFrameOpen = false;
    placePet();
    syncPanelOpenState();
  })();
}

function petBounds() {
  return currentOverlay(panelOpen).pet;
}

function destroyPetWindow() {
  const win = petWindow;
  if (!win || win.isDestroyed()) {
    petWindow = null;
    return;
  }
  petWindow = null;
  win.destroy();
}

function placePet() {
  // Floating pet is only used for the close-tab rocket flight.
  if (state.flightActive) return;
  destroyPetWindow();
}

function flightWindowAt(cx, cy) {
  return {
    x: Math.round(cx - FLIGHT_W / 2),
    y: Math.round(cy - FLIGHT_H / 2),
    width: FLIGHT_W,
    height: FLIGHT_H,
  };
}

function easeInCubic(t) {
  return t * t * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function angleToward(fromX, fromY, toX, toY) {
  return (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
}

/** CSS rotate(θ) turns the upright head (screen -90°) onto the flight path. Feet trail. */
function headFirstAngle(fromX, fromY, toX, toY) {
  return angleToward(fromX, fromY, toX, toY) + 90;
}

function shortestTurn(fromDeg, toDeg) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return fromDeg + delta;
}

async function capturePanelPetAnchor() {
  const win = panelWindow;
  if (!win || win.isDestroyed()) return null;
  let info = null;
  try {
    info = await win.webContents.executeJavaScript(`(() => {
      const peeking = document.body.classList.contains("is-peeking") && !document.body.classList.contains("is-open");
      const open = document.body.classList.contains("is-open");
      const el = peeking
        ? document.getElementById("rail-peek-stack")
        : open
          ? document.getElementById("panel-pet-stack")
          : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!(r.width > 2) || !(r.height > 2)) return null;
      // Include parent mirrors (the right dock flips #shell) so the floater matches the pose.
      const nodes = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) nodes.push(n);
      nodes.reverse();
      let a = 1, b = 0, c = 0, d = 1;
      for (const n of nodes) {
        const t = getComputedStyle(n).transform;
        if (!t || t === "none") continue;
        const m = new DOMMatrix(t);
        const na = m.a * a + m.c * b;
        const nb = m.b * a + m.d * b;
        const nc = m.a * c + m.c * d;
        const nd = m.b * c + m.d * d;
        a = na; b = nb; c = nc; d = nd;
      }
      // Local up (the head) after that matrix. rotate(head+90) aims the head the same way, unmirrored.
      const head = Math.atan2(-d, -c) * 180 / Math.PI;
      return {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        angleDeg: head + 90,
        scaleX: 1,
        peeking,
        open,
      };
    })()`);
  } catch {
    return null;
  }
  if (!info) return null;
  const b = win.getBounds();
  return {
    cx: b.x + info.left + info.width / 2,
    cy: b.y + info.top + info.height / 2,
    width: info.width,
    height: info.height,
    angleDeg: info.angleDeg,
    scaleX: info.scaleX,
    peeking: info.peeking,
    open: info.open,
  };
}

function openFlightPet(bounds) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setBounds(bounds, false);
    hardenOverlayWindow(petWindow);
    petWindow.showInactive();
    return petWindow;
  }
  petWindow = new BrowserWindow({
    ...bounds,
    show: true,
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
  hardenOverlayWindow(petWindow);
  petWindow.loadFile(path.join(__dirname, "pet.html"));
  petWindow.on("closed", () => {
    petWindow = null;
  });
  return petWindow;
}

async function waitPetReady() {
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  if (!win.webContents.isLoading()) {
    publish();
    return;
  }
  await new Promise((resolve) => {
    win.webContents.once("did-finish-load", resolve);
    setTimeout(resolve, 800);
  });
  publish();
}

async function animateFlightWindow(from, to, ms, ease = easeInCubic) {
  const win = petWindow;
  if (!win || win.isDestroyed()) return;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i += 1) {
    if (!petWindow || petWindow.isDestroyed()) return;
    const t = ease(i / steps);
    petWindow.setBounds(
      {
        x: Math.round(from.x + (to.x - from.x) * t),
        y: Math.round(from.y + (to.y - from.y) * t),
        width: from.width,
        height: from.height,
      },
      false,
    );
    await waitMs(Math.max(8, Math.round(ms / steps)));
  }
  if (petWindow && !petWindow.isDestroyed()) petWindow.setBounds(to, false);
}

async function animateFlightAngle(fromDeg, toDeg, ms) {
  const end = shortestTurn(fromDeg, toDeg);
  const steps = Math.max(6, Math.round(ms / 16));
  for (let i = 1; i <= steps; i += 1) {
    const t = easeInOutCubic(i / steps);
    state = {
      ...state,
      flightAngle: fromDeg + (end - fromDeg) * t,
    };
    publish();
    await waitMs(Math.max(8, Math.round(ms / steps)));
  }
  state = { ...state, flightAngle: end };
  publish();
}

function setFlightState(partial) {
  state = { ...state, ...partial };
  publish();
}

async function finishCloseFlight(home) {
  try {
    // Boom stays at the tab strip; clear it before the ease-home.
    if (state.flightBoom) {
      setFlightState({ flightBoom: false, flightAngle: 0, flightScaleX: 1, petPose: "idle" });
    }
    if (petWindow && !petWindow.isDestroyed() && home) {
      const from = petWindow.getBounds();
      await animateFlightWindow(from, home, FLIGHT_RETURN_MS, easeInOutCubic);
    }
  } finally {
    petClosing = false;
    petAnimating = false;
    setFlightState({
      flightActive: false,
      flightBoom: false,
      flightAngle: 0,
      flightScaleX: 1,
    });
    destroyPetWindow();
    applyRestingPetPose();
    publish();
  }
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
  const grab = { grabX: dockDrag.grabX, grabY: dockDrag.grabY };
  const floating = {
    x: Math.round(screenX - dockDrag.grabX),
    y: Math.round(screenY - dockDrag.grabY),
    width: dockDrag.width,
    height: dockDrag.height,
  };
  dockDrag = null;
  const area = dockWorkArea({ x: screenX, y: screenY });
  // Point A = release cursor; snap to nearest side with along-edge place from A.
  let snapped = snapOverlay(
    floating,
    { x: screenX, y: screenY },
    area,
    panelOpen,
    dockOptions(),
    grab,
  );
  if (snapped.edge === "right") {
    snapped = overlayLayout(snapped.edge, snapped.offset, "open", area, dockOptions());
  }
  dock = { edge: snapped.edge, offset: snapped.offset };
  setDockEdgeState(snapped.edge);
  // Native animated bounds slides the bar to the docked edge.
  const win = panelWindow;
  if (win && !win.isDestroyed()) {
    win.setHasShadow(false);
    win.setBounds(snapped.panel, !prefersReducedMotion());
  }
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

async function closeFrontTab(appName, host) {
  if (petAnimating || state.flightActive) {
    return closeFrontWindow(appName);
  }
  let homeBounds = null;
  let animated = false;
  try {
    const anchor = await capturePanelPetAnchor();
    const bounds = await readFrontWindowBounds(appName);
    const parsed = bounds.ok ? parseWindowBounds(bounds.value) : null;
    if (anchor && parsed) {
      petClosing = true;
      petAnimating = true;
      animated = true;
      const start = flightWindowAt(anchor.cx, anchor.cy);
      homeBounds = start;
      // Arm flight state first so the panel/peek copy hides as the floater appears.
      state = {
        ...state,
        flightActive: true,
        flightBoom: false,
        flightAngle: anchor.angleDeg,
        flightScaleX: 1,
        petPose: "struggle",
        petFlip: false,
        chatBubble: CHAT_CLOSING,
        chatBubbleScope: "pet",
      };
      publish();
      openFlightPet(start);
      await waitPetReady();
      const origin = petOriginForTabStrip(parsed, PET_SIZE);
      const display = screen.getDisplayNearestPoint({
        x: origin.x + PET_SIZE / 2,
        y: origin.y + PET_SIZE / 2,
      });
      const aim = clampPetOrigin(origin, PET_SIZE, display.bounds);
      const target = flightWindowAt(aim.x + PET_SIZE / 2, aim.y + PET_SIZE / 2);
      const aimDeg = headFirstAngle(anchor.cx, anchor.cy, aim.x + PET_SIZE / 2, aim.y + PET_SIZE / 2);
      await animateFlightAngle(anchor.angleDeg, aimDeg, FLIGHT_AIM_MS);
      await animateFlightWindow(start, target, FLIGHT_ROCKET_MS, easeInCubic);
      // Arrive: upright + normal eyes, boom covers the pet.
      setFlightState({
        flightAngle: 0,
        flightScaleX: 1,
        petPose: "idle",
        flightBoom: true,
      });
      await waitMs(FLIGHT_BOOM_CLOSE_MS);
      const still = await readFrontBrowser();
      if (hostnameFromUrl(still.url || "") !== host) {
        await finishCloseFlight(homeBounds);
        return { ok: false, error: "", skipped: true };
      }
      const result = await closeFrontWindow(appName);
      await waitMs(FLIGHT_BOOM_HOLD_MS);
      await finishCloseFlight(homeBounds);
      return result;
    }
  } catch {
    if (animated) {
      await finishCloseFlight(homeBounds);
      return { ok: false, error: "", skipped: true };
    }
  }
  petClosing = false;
  petAnimating = false;
  return closeFrontWindow(appName);
}

function hardenOverlayWindow(win) {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function openPet() {
  // Floating pet is only for close-tab flight; studying sprite lives in the panel.
  if (state.flightActive) return;
  destroyPetWindow();
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
  loadOverlay(panelWindow, "panel.html");
  panelWindow.on("closed", () => {
    panelWindow = null;
    if (!appQuitting) setImmediate(() => openPanel());
  });
  panelWindow.webContents.once("did-finish-load", publish);
  panelWindow.webContents.once("did-finish-load", () => {
    hardenOverlayWindow(panelWindow);
    if (panelWindow && !panelWindow.isDestroyed()) panelWindow.show();
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
    // A launch claim already supplied the sprite. Signing in is not required.
    if (!study) {
      petLog("[pet] no signed-in pet session, so the equipped row is not read. The character stays baby_slime until a launch code is claimed.");
    }
    return;
  }
  await touchPetPresence(true);
  const userId = sessionData.session.user?.id ?? "";
  await loadWeekPlan(userId);
  const refreshSeq = ++statsRefreshSeq;
  const { data, error } = await supabase
    .from("user_pets")
    .select("id, pet_type, level, xp, color, hat, clothes")
    .eq("is_desktop_active", true)
    .maybeSingle();
  if (refreshSeq !== statsRefreshSeq) return;
  if (error) {
    petLog(`[pet] equipped pet query failed: ${error.message}`);
    setStatus(error.message);
    publish();
    return;
  }
  if (!data) {
    petLog("[pet] signed in, but no user_pets row has is_desktop_active = true.");
    publish();
    return;
  }
  applyEquippedPetStats(data);
  petLog(
    `[pet] equipped ${state.petType} level ${state.level ?? "?"} color=${state.petColor || "-"} hat=${state.petHat || "-"} clothes=${state.petClothes || "-"} study=${state.studyDays.join(",")} rest=${state.restDays.join(",")} for ${userId || "unknown"}`,
  );
  publish();
}

async function loadWeekPlan(userId) {
  if (!supabase || !userId) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("weekly_study_days, weekly_rest_days")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    petLog(`[pet] week plan query failed: ${error.message}`);
    return;
  }
  if (!data) return;
  state = {
    ...state,
    studyDays: claimWeekdays(data.weekly_study_days),
    restDays: claimWeekdays(data.weekly_rest_days),
  };
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
  const progressChanged = syncSessionProgress(now);
  const clockChanged = syncSessionClock(now);
  const countdown = study.closeBlocked ? closeCountdownStatus(study.closeWatch, now) : "";
  const statusChanged = Boolean(countdown && state.status !== countdown);
  if (statusChanged) state = { ...state, status: countdown };
  // Focused study: flip study1 ↔ study2 once a second so the pen and legs animate.
  let poseChanged = false;
  if (!petAnimating && !petClosing && !onDistractedHost) {
    const nextPose = state.petPose === "study2" ? "study1" : "study2";
    if (state.petPose !== nextPose) {
      state = { ...state, petPose: nextPose };
      poseChanged = true;
    }
  }
  // Distracted: republish each second so warn → mad phase / peek bounds stay in sync.
  if (progressChanged || clockChanged || statusChanged || poseChanged || onDistractedHost) publish();
  advanceChatLine();
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
  const preview = chatBubbleLines(chatBubbleInput());
  if (isOpenBarIdleChat(preview)) {
    if (chatIdlePhase === "show") {
      if (chatLineTick < CHAT_SHOW_TICKS) return;
      chatLineTick = 0;
      chatIdlePhase = "silence";
      if (syncChatBubble()) publish();
      return;
    }
    if (chatLineTick < CHAT_SILENCE_TICKS) return;
    chatLineTick = 0;
    chatIdlePhase = "show";
    nextChatLine(preview.lines.length);
    if (syncChatBubble()) publish();
    return;
  }
  if (chatLineTick < CHAT_LINE_TICKS) return;
  chatLineTick = 0;
  nextChatLine(preview.lines.length);
  if (syncChatBubble()) publish();
}

function beginFrontWatch(body, browser = "") {
  stopFrontWatch();
  study = {
    id: String(body.session_id),
    // Held in memory for the later score submit. It is not written to disk.
    token: typeof body.token === "string" ? body.token : "",
    blocklist: body.blocklist.filter((host) => typeof host === "string"),
    // Close blocked tabs stays on for the desktop pet (no user toggle).
    closeBlocked: true,
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
  } else {
    petLog("[pet] claim returned no pet_type, so the character stays as it is.");
  }
  state = {
    ...state,
    petType: typeof body.pet_type === "string" && body.pet_type ? body.pet_type : state.petType,
    level: claimLevel(body.level) ?? state.level,
    petColor: optionalLook(body.color),
    petHat: optionalLook(body.hat),
    petClothes: optionalLook(body.clothes),
    studyDays: claimWeekdays(body.weekly_study_days),
    restDays: claimWeekdays(body.weekly_rest_days),
    finishNote: "",
  };
  petLog(
    `[pet] claim look color=${state.petColor || "-"} hat=${state.petHat || "-"} clothes=${state.petClothes || "-"} study=${state.studyDays.join(",")} rest=${state.restDays.join(",")}`,
  );
  syncSessionProgress(Date.now());
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
  distractionPausedMs = 0;
  distractionPauseStart = 0;
  chatLineIndex = 0;
  chatLineTick = 0;
  chatLineScenario = "";
  chatLineBag = [];
  chatIdlePhase = "show";
  state = {
    ...state,
    chatBubble: "",
    chatBubbleScope: "none",
    panelPeeking: false,
    distractionPhase: "none",
    sessionProgress: 0,
    sessionClock: "",
  };
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

/** Score the active session if one is running (used by Finish and Quit). */
async function endSessionIfNeeded() {
  if (!study?.token) return;
  if (finishing) {
    while (finishing) await waitMs(50);
    return;
  }
  await finishSession();
}

/** Finish any active study session, then exit the pet. */
async function quitApp() {
  await endSessionIfNeeded();
  app.quit();
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
    // Always close blocked tabs on desktop; preference is debug-only.
    current.closeBlocked = true;
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

function launchValues(argv, readPending) {
  const values = launchLinksFromArgs(argv || []);
  if (readPending) {
    try {
      values.push(...takePendingLaunchLinks(pendingLaunchFile(__dirname)));
    } catch (error) {
      console.error("Could not read a pending aurafarm:// link.", error);
    }
  }
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

async function deliverLaunchValues(values) {
  if (!values.length) return;
  petLog("[pet] opening aurafarm:// link");
  for (const value of values) await handleLink(parseAurafarmLink(value));
}

function registerMacProtocol() {
  if (process.platform !== "darwin") return;
  if (!app.isPackaged) {
    // setAsDefaultProtocolClient ignores the app path on macOS, so a cold
    // aurafarm:// open launches Electron.app and shows "Electron path-to-app".
    try {
      const handler = ensureDevProtocolHandler({ electronExecutable: process.execPath });
      console.log(`[pet] aurafarm:// opens ${handler.destApp}`);
    } catch (error) {
      console.error("Could not register the aurafarm:// handler.", error);
    }
    return;
  }
  app.setAsDefaultProtocolClient("aurafarm");
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
  void quitApp();
});
ipcMain.on("set-panel-open", (_event, open) => {
  setPanelOpen(open);
});
ipcMain.on("pet-ignore-mouse", (event, ignore) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
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
    void deliverLaunchValues(launchValues(argv, true));
  });

  let petPresenceReleased = false;
  app.on("before-quit", (event) => {
    appQuitting = true;
    if (petPresenceReleased) return;
    event.preventDefault();
    void (async () => {
      // Quit (button or menu) should end an active session, not leave it hanging.
      await endSessionIfNeeded();
      stopFrontWatch();
      const release = touchPetPresence(false);
      const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
      await Promise.race([release, timeout]);
      petPresenceReleased = true;
      app.quit();
    })();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) void handleLink(parseAurafarmLink(url));
    else pendingLinks.push(url);
  });

  app.whenReady().then(async () => {
    registerPetAssets();
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
      const layout = overlayLayout(dock.edge, dock.offset, panelOpen || panelBoundsOpen, area, dockOptions());
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
      const bottomRight = overlayLayout("right", Number.MAX_SAFE_INTEGER, "open", area, dockOptions());
      dock = { edge: "right", offset: bottomRight.offset };
      state = { ...state, dockEdge: "right" };
      console.log(`[pet] dock panel=${JSON.stringify(bottomRight.panel)} pet=${JSON.stringify(bottomRight.pet)}`);
    }
    openPanel();
    void noteFrontApp();
    setInterval(() => {
      void noteFrontApp();
      if (acceptLaunchLinks) void deliverLaunchValues(launchValues([], true));
    }, 1000);
    setDebug(describeCloseDebug({ session: false }));
    await loadRemoteConfig();
    await restoreSession();
    void checkForUpdate();
    await deliverLaunchValues(launchValues([...process.argv, ...pendingLinks], true));
    acceptLaunchLinks = true;
    setInterval(() => {
      void refreshPet();
    }, PET_REFRESH_MS);
  });
}
