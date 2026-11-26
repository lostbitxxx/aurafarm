import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parseScoreRequest } from "../lib/scoring";

const require = createRequire(import.meta.url);
const { clampPetX, parseWeekdays, plainPetPath, plainPetStack, restingPetPose, sessionDayKind, sessionRailColors } = require("../desktop/pet-art.js") as {
  parseWeekdays: (value: unknown) => number[];
  sessionRailColors: (kind: string) => { liquid: string; track: string };
  clampPetX: (x: number, laneWidth: number, spriteWidth: number) => number;
  plainPetPath: (petType: string, pose: string) => string;
  plainPetStack: (
    petType: string,
    pose: string,
    options?: { color?: string | null; hat?: string | null; clothes?: string | null },
  ) => { face: string; body: string; clothes: string | null; hat: string | null; hatPlacement: string };
  restingPetPose: (input?: {
    sessionActive?: boolean;
    onDistracted?: boolean;
    closing?: boolean;
    animating?: boolean;
    currentPose?: string;
  }) => string;
  sessionDayKind: (state: { studyDays?: unknown; restDays?: unknown }, now?: Date) => string;
};
const { clampPetOrigin, parseWindowBounds, petOriginForTabStrip } = require("../desktop/pet-move.js") as {
  clampPetOrigin: (
    origin: { x: number; y: number },
    petSize: number,
    area: { x: number; y: number; width: number; height: number },
  ) => { x: number; y: number };
  parseWindowBounds: (value: string) => { x: number; y: number; width: number; height: number } | null;
  petOriginForTabStrip: (
    windowBounds: { x: number; y: number },
    petSize: number,
  ) => { x: number; y: number };
};
const { formatSessionClock, formatStudyClock, remainingStudyMs, studyProgress } = require("../desktop/study-clock.js") as {
  formatSessionClock: (remainingMs: number) => string;
  formatStudyClock: (remainingMs: number) => string;
  remainingStudyMs: (
    study: { plannedSeconds?: number; startedAtMs?: number },
    now: number,
  ) => number | null;
  studyProgress: (
    study: { plannedSeconds?: number; startedAtMs?: number },
    now: number,
  ) => number | null;
};
const { finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("../desktop/score.js") as {
  finishLabel: (blockedCount: number) => string;
  interpretScoreResponse: (
    status: number,
    body: unknown,
    origin: string,
    sessionId: string,
  ) => { ok: boolean; url: string; clearToken: boolean; message: string };
  usableApiOrigin: (candidates: unknown) => string;
  scoreRequestBody: (
    study: {
      token: string;
      startedAt: number;
      log: { blockedCount: number; blockedHosts: string[] };
    },
    nowMs: number,
  ) => {
    token: string;
    duration_seconds: number;
    blocked_count: number;
    blocked_hosts: string[];
    local_day: string;
  };
};

test("the pet score body is the phase 3 example", () => {
  const startedAt = 1_700_000_000_000;
  const nowMs = startedAt + 1200 * 1000 + 400;
  const body = scoreRequestBody(
    {
      token: "session-secret",
      startedAt,
      log: { blockedCount: 1, blockedHosts: ["www.instagram.com"] },
    },
    nowMs,
  );
  assert.equal(body.token, "session-secret");
  assert.equal(body.duration_seconds, 1200);
  assert.equal(body.blocked_count, 1);
  assert.deepEqual(body.blocked_hosts, ["www.instagram.com"]);
  assert.match(body.local_day, /^\d{4}-\d{2}-\d{2}$/);
  const beforeHongKongMidnight = scoreRequestBody(
    { token: "session-secret", startedAt: 0, log: { blockedCount: 0, blockedHosts: [] } },
    Date.parse("2026-11-13T15:59:00.000Z"),
  );
  const afterHongKongMidnight = scoreRequestBody(
    { token: "session-secret", startedAt: 0, log: { blockedCount: 0, blockedHosts: [] } },
    Date.parse("2026-11-13T16:00:00.000Z"),
  );
  assert.equal(beforeHongKongMidnight.local_day, "2026-11-13");
  assert.equal(afterHongKongMidnight.local_day, "2026-11-14");
  const parsed = parseScoreRequest(body);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.localDay, body.local_day);
});

test("the finish label follows the blocked count", () => {
  assert.equal(finishLabel(0), "Finish session :)");
  assert.equal(finishLabel(1), "Finish session :|");
  const clear = scoreRequestBody(
    { token: "session-secret", startedAt: 0, log: { blockedCount: 0, blockedHosts: [] } },
    500,
  );
  assert.equal(clear.blocked_count, 0);
  assert.deepEqual(clear.blocked_hosts, []);
  assert.equal(clear.duration_seconds, 0);
});

test("a saved score opens the screen and a failed score keeps the token", () => {
  const sent = interpretScoreResponse(
    200,
    { url: "http://localhost:3000/dashboard/sessions/session-id", xp: 46, distracted: true },
    "http://localhost:3000",
    "session-id",
  );
  assert.equal(sent.ok, true);
  assert.equal(sent.clearToken, true);
  assert.equal(sent.url, "http://localhost:3000/dashboard/sessions/session-id");

  const again = interpretScoreResponse(409, { error: "That session was already scored." }, "http://localhost:3000", "session-id");
  assert.equal(again.ok, true);
  assert.equal(again.clearToken, true);
  assert.equal(again.url, "http://localhost:3000/dashboard/sessions/session-id");
  assert.match(again.message, /already scored/);

  const rejected = interpretScoreResponse(403, { error: "Score rejected." }, "http://localhost:3000", "session-id");
  assert.equal(rejected.ok, false);
  assert.equal(rejected.clearToken, false);
  assert.equal(rejected.url, "");
  assert.match(rejected.message, /Try again/);
});

test("the sign-in panel can quit the pet", () => {
  const panel = readFileSync(new URL("../desktop/panel.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../desktop/panel.js", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../desktop/preload.js", import.meta.url), "utf8");
  const main = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  const petPage = readFileSync(new URL("../desktop/pet.html", import.meta.url), "utf8");
  const petScript = readFileSync(new URL("../desktop/pet.js", import.meta.url), "utf8");
  assert.doesNotMatch(panel, /Session token|session-token|Use session token/);
  assert.doesNotMatch(script, /useToken|session-token|fillSessionCode/);
  assert.doesNotMatch(preload, /useToken/);
  assert.doesNotMatch(main, /use-token|pasteSessionCode|Paste a session token/);
  assert.match(panel, /Let's study together!/);
  assert.match(main, /Let's study together!/);
  assert.match(main, /friendlyStatus|refresh token/i);
  assert.match(panel, /#panel-actions #status \{[\s\S]*white-space: nowrap/);
  assert.match(script, /function fitStatusLine/);
  assert.match(script, /scheduleFitStatusLine/);
  assert.match(main, /role: "paste"/);
  assert.match(panel, /id="panel-stage"/);
  assert.match(panel, /id="panel-pet"/);
  assert.match(panel, /id="panel-pet-chat"/);
  assert.match(panel, /id="panel-actions"[\s\S]*id="status"[\s\S]*id="quit"/);
  assert.match(panel, /pet-art\.js/);
  assert.doesNotMatch(panel, /id="bubble"|id="session-block"/);
  assert.match(panel, /id="finish"/);
  assert.match(panel, /Finish session :\)/);
  assert.match(panel, /id="panel-action-row"[\s\S]*id="finish"[\s\S]*id="quit"/);
  assert.match(panel, /id="finish"[^>]*hidden/);
  assert.match(script, /finishButton\.hidden = !state\.finishLabel/);
  assert.match(script, /window\.pet\.finish\(\)/);
  assert.match(script, /state\.finishLabel \|\| "Finish session :\)"/);
  assert.match(script, /state\.chatBubble/);
  assert.match(script, /panelPetVisible/);
  assert.match(preload, /finish: \(\) => ipcRenderer\.send\("finish-session"\)/);
  assert.match(main, /function focusPanel\(\)/);
  assert.match(main, /formatSessionClock/);
  assert.match(main, /syncSessionClock/);
  assert.doesNotMatch(main, /remaining <= 0\) \{\s*setSessionProgress\(1\);\s*publish\(\);\s*void finishSession\(\);/);
  assert.doesNotMatch(main, /sprite\.html|finish\.html/);
  assert.match(main, /openPanel\(\)/);
  assert.doesNotMatch(panel, /type="email"|type="password"|id="sign-in"/);
  assert.match(main, /signInWithPassword/);
  assert.match(main, /ipcMain\.handle\("sign-in"/);
  assert.match(preload, /signIn: \(email, password\)/);
  assert.doesNotMatch(panel, /id="cancel"/);
  assert.doesNotMatch(panel, /Cancel study session/);
  assert.doesNotMatch(script, /cancelStudy/);
  assert.match(preload, /cancelStudy: \(\) => ipcRenderer\.invoke\("cancel-study"\)/);
  assert.match(main, /ipcMain\.handle\("cancel-study"/);
  assert.match(main, /does not change experience/);
  assert.doesNotMatch(main, /grant_study_experience/);
  assert.match(main, /planned_seconds/);
  assert.match(main, /closeFrontWindow/);
  assert.doesNotMatch(main, /The study time has not finished/);
  const desk = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(desk, /Copy session code/);
  assert.doesNotMatch(desk, /Copy Terminal command/);
  assert.doesNotMatch(desk, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(desk, /xattr -cr/);
  assert.match(
    desk,
    /id="length-title"[\s\S]*aria-label="Study length"[\s\S]*Custom[\s\S]*\{customOpen \? \([\s\S]*placeholder="type here"[\s\S]*\) : null\}[\s\S]*Desktop pet[\s\S]*FARM AURA/,
  );
  assert.match(desk, /TrackerDemo kind="desktop"/);
  assert.doesNotMatch(desk, /TrackerDemo kind="website"/);
  assert.doesNotMatch(desk, /tracker-option-name">Website timer/);
  assert.match(desk, /First time aurafarming\? Download here!/);
  assert.match(desk, /desktopLink \? \([\s\S]*href=\{desktopLink\}[\s\S]*onClick=\{onCloseStart\}[\s\S]*Open Aurafarm/);
  assert.match(desk, /desktopLink \? "tracker-cards is-desktop-ready" : "tracker-cards"/);
  assert.match(desk, /tracker-option-desktop/);
  assert.doesNotMatch(desk, /tracker-option-website/);
  const deskCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const readyWebsite = deskCss.match(/\.tracker-cards\.is-desktop-ready \.tracker-option-website \{[^}]+\}/);
  const readyDesktop = deskCss.match(/\.tracker-cards\.is-desktop-ready \.tracker-option-desktop \{[^}]+\}/);
  assert.ok(readyWebsite);
  assert.ok(readyDesktop);
  assert.match(readyWebsite[0], /opacity: 0;/);
  assert.match(readyWebsite[0], /translateX\(1\.75rem\)/);
  assert.doesNotMatch(readyWebsite[0], /max-width:\s*0|flex:\s*0\s+0\s+0|max-height:\s*0/);
  assert.match(readyDesktop[0], /translateX\(calc\(50% \+ 0\.375rem\)\)/);
  assert.doesNotMatch(readyDesktop[0], /max-width:\s*18\.5rem/);
  assert.match(desk, /shownSession\.useDesktopPet && launchUrl \? <DesktopLaunchHelp href=\{launchUrl\} \/>/);
  const launchHelp = readFileSync(new URL("../components/desktop-launch-help.tsx", import.meta.url), "utf8");
  assert.match(launchHelp, /Not Seeing Desktop Pet\?/);
  assert.match(launchHelp, /button button-end-early/);
  assert.doesNotMatch(launchHelp, /className = "button button-ghost button-end-early"/);
  assert.match(launchHelp, /tracker-pop[\s\S]*Open Aurafarm/);
  assert.match(launchHelp, /setOpen\(true\)/);
  assert.match(launchHelp, /Not seeing the desktop pet\?/);
  assert.doesNotMatch(desk, /closes a blocklist window|Closing blocklist windows is off|desktopHelp/);
  assert.match(desk, /onAskTracker/);
  assert.match(desk, /onConfirmTracker/);
  assert.match(desk, /openPetLaunch\(launchUrl\)/);
  assert.match(desk, /openPetLaunch\(launchUrl\);[\s\S]*setStartOpen\(false\)/);
  assert.match(desk, /headTitle=\{shownSession \? "Studying with you" : null\}/);
  assert.doesNotMatch(desk, /Desktop pet is tracking this session|Website timer is tracking this session/);
  assert.match(desk, /headerCenter=\{/);
  assert.match(desk, /desk-session-actions/);
  assert.match(
    desk,
    /headerCenter=\{[\s\S]*StudyClock[\s\S]*onFinished=\{shownSession\.useDesktopPet \? null : \(\) => finishSession\(""\)\}/,
  );
  assert.doesNotMatch(desk, /Started <time|chosen<\/p>/);
  const living = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  assert.match(living, /Let's start AuraFarming/);
  assert.match(living, /farmerName/);
  assert.doesNotMatch(living, /Your little living room/);
  assert.doesNotMatch(living, /Ready for a little focus\?/);
  assert.doesNotMatch(desk, /Ready for a little focus\?/);
  assert.match(living, /studyingHead \? "room-top is-studying" : "room-top"/);
  assert.match(living, /headerCenter \? <div className="room-center">\{headerCenter\}<\/div>/);
  assert.match(deskCss, /\.room-top\.is-studying,[\s\S]*grid-template-columns:/);
  assert.match(deskCss, /\.room-top\.is-studying \.room-head,[\s\S]*grid-column: 1;[\s\S]*text-align: left;/);
  assert.match(deskCss, /\.room-top\.is-studying \.room-center,[\s\S]*grid-column: 2;[\s\S]*justify-self: center;/);
  assert.match(deskCss, /\.room-top\.is-studying \.desk-session-actions,[\s\S]*grid-column: 3;/);
  assert.match(desk, /id="dev-title"[\s\S]*type="password"[\s\S]*Finish now/);
  assert.match(desk, /End session early/);
  assert.match(desk, /id="early-title"[\s\S]*bigger bonus[\s\S]*motivation-quote[\s\S]*Keep studying/);
  assert.doesNotMatch(desk, /Unlock/);
  assert.doesNotMatch(desk, /cancelStudySession/);
  assert.doesNotMatch(desk, /Cancel session/);
  assert.doesNotMatch(panel, /id="dock-handle"/);
  assert.match(panel, /id="panel-toggle"/);
  assert.match(panel, /id="session-capsule"/);
  assert.doesNotMatch(panel, /id="session-track"/);
  assert.match(panel, /id="session-fill"/);
  assert.match(panel, /id="session-ticks"/);
  assert.match(panel, /id="session-clock"/);
  assert.doesNotMatch(panel, /id="exp-track"|id="exp-fill"|id="exp-level"/);
  assert.match(panel, /#session-fill[\s\S]*bottom: 0;/);
  assert.match(panel, /#session-capsule[\s\S]*border-radius: 999px/);
  assert.match(panel, /--session-green: #5fbf4a/);
  assert.match(panel, /--cylinder-wall: #fffcf7/);
  assert.match(panel, /--session-study: #c43b2e/);
  assert.match(panel, /--session-rest: #3f78c8/);
  assert.match(panel, /body\.is-study-day #session-fill/);
  assert.match(panel, /body\.is-rest-day #session-fill/);
  assert.match(panel, /body\.is-study-day #session-capsule/);
  assert.doesNotMatch(panel, /--fill-purple|--track-sage|repeating-linear-gradient/);
  assert.match(panel, /id="shell"[\s\S]*id="dock-rail"[\s\S]*id="panel-toggle"[\s\S]*id="session-capsule"[\s\S]*id="session-fill"[\s\S]*id="panel-body"/);
  assert.match(panel, /body\.edge-left[\s\S]*body\.edge-right[\s\S]*body\.edge-top[\s\S]*body\.edge-bottom/);
  assert.match(panel, /#dock-rail \{[\s\S]*cursor: grab/);
  assert.doesNotMatch(panel, /#shell \{[^}]*cursor: grab/);
  assert.match(panel, /#panel-pet-stack \{[^}]*pointer-events: none/);
  assert.match(panel, /--shell-radius: 10px/);
  assert.match(panel, /border-radius: var\(--shell-radius\)/);
  assert.match(panel, /\.pet-chat::after/);
  assert.match(panel, /border-top: 5\.5px solid #fffdf6/);
  assert.match(panel, /width: 90px/);
  assert.match(panel, /height: 90px/);
  assert.match(panel, /#panel-action-row \{[\s\S]*grid-template-columns: minmax\(0, 1\.85fr\) minmax\(3\.25rem, 0\.85fr\)/);
  assert.match(script, /toggle\.addEventListener\("pointerdown"/);
  assert.match(script, /DOCK_DRAG_THRESHOLD_PX/);
  assert.match(script, /LEAVE_CLOSE_MS/);
  assert.match(script, /replayChatBubble/);
  assert.match(script, /applySessionClock/);
  assert.doesNotMatch(script, /shell\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(script, /panelPetStack\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(panel, /id="dock-chrome"/);
  assert.match(panel, /#shell \{[\s\S]*box-shadow: none/);
  assert.match(panel, /#session-capsule \{[\s\S]*box-shadow: none/);
  assert.match(panel, /body\.is-frame-open #shell/);
  assert.match(main, /setHasShadow\(false\)/);
  assert.match(main, /hasShadow: false/);
  assert.doesNotMatch(panel, /id="timer"|#timer \{/);
  assert.doesNotMatch(script, /remainingLabel/);
  assert.doesNotMatch(main, /Countdown UI lives on the desk site/);
  assert.match(script, /applySessionFill/);
  assert.match(script, /sessionProgress/);
  assert.doesNotMatch(script, /applyExpBar|xpIntoLevel|petStatsReady/);
  assert.match(script, /dockDragStart/);
  assert.match(script, /dockDragEnd/);
  assert.match(script, /dockDragCancel/);
  assert.match(script, /lostpointercapture/);
  assert.match(script, /applyDockEdge/);
  assert.match(panel, /aria-controls="panel-body"/);
  assert.match(panel, /aria-label="Open Aurafarm"/);
  assert.match(panel, /id="panel-body"/);
  assert.doesNotMatch(panel, /id="timer-fill"/);
  assert.doesNotMatch(panel, /id="panel-arrow"/);
  assert.match(panel, /id="panel-chevron"/);
  assert.match(panel, /body\.edge-right #panel-chevron svg/);
  assert.doesNotMatch(panel, /row-reverse/);
  assert.match(panel, /body\.edge-right #shell \{\s*transform: scaleX\(-1\);/);
  assert.match(
    panel,
    /body\.edge-left\.is-bounds-open:not\(\.is-open\) #shell,\s*body\.edge-right\.is-bounds-open:not\(\.is-open\) #shell/,
  );
  assert.match(panel, /body\.edge-right\.is-open #panel-chevron svg/);
  assert.doesNotMatch(panel, /#panel-pet-stack:hover/);
  assert.match(petScript, /getBoundingClientRect/);
  assert.match(petScript, /syncPetMouseTarget/);
  assert.doesNotMatch(petScript, /setHoverCursor/);
  assert.doesNotMatch(petPage, /background: rgba\(0, 0, 0, 0\.01\)|#pet-stack:hover/);
  assert.doesNotMatch(petPage, /#pet-stack \{[^}]*cursor: grab/);
  assert.doesNotMatch(panel, /id="pet-lane"/);
  assert.doesNotMatch(script, /clampPetX|startPetWalk|pet-lane/);
  assert.doesNotMatch(panel, /id="pet-switch-row"|id="pet-toggle"|Show pet/);
  assert.doesNotMatch(script, /setPetVisible|petVisible|applyPetVisible/);
  assert.doesNotMatch(preload, /setPetVisible|set-pet-visible/);
  assert.doesNotMatch(main, /set-pet-visible|setPetVisible|petVisible/);
  assert.match(main, /panelPetVisible: panelOpen/);
  assert.doesNotMatch(main, /panelPetVisible: panelOpen && !petAnimating/);
  assert.match(main, /function destroyPetWindow/);
  assert.doesNotMatch(main, /loadOverlay\(petWindow, "pet\.html"\)/);
  assert.match(main, /loadOverlay\(panelWindow, "panel\.html"\)/);
  assert.match(main, /scheme: "pet-asset"/);
  assert.match(main, /overlayLayout/);
  assert.match(main, /snapOverlay/);
  assert.match(main, /petOriginBesidePanel/);
  assert.match(main, /nearestEdge/);
  assert.match(main, /insetBottom/);
  assert.match(main, /select\("id, pet_type, level, xp, color, hat, clothes"\)/);
  assert.match(main, /sessionProgress/);
  assert.match(main, /studyProgress/);
  assert.match(main, /syncSessionProgress/);
  assert.doesNotMatch(main, /xpIntoLevel|petStatsReady/);
  assert.match(main, /petDisplayProgress/);
  assert.match(main, /function applyPanelBounds/);
  assert.match(main, /PANEL_SURFACE_MS = 200/);
  assert.match(main, /PANEL_REVEAL_MS = 80/);
  assert.match(main, /PANEL_OUTLINE_MS = 160/);
  assert.match(main, /PANEL_EXPAND_MS = 280/);
  assert.doesNotMatch(main, /PANEL_BOUNDS_MS/);
  assert.doesNotMatch(main, /PANEL_STAGE_MS/);
  assert.doesNotMatch(main, /applyPanelBounds\("tall"\)/);
  assert.match(main, /applyPanelBounds\("open", \{ movePet: false \}\)/);
  assert.match(main, /applyPanelBounds\("closed", \{ movePet: false \}\)/);
  assert.match(main, /panelFrameOpen/);
  assert.match(panel, /is-frame-open/);
  assert.match(panel, /clip-path/);
  assert.doesNotMatch(main, /steps = 8/);
  assert.match(panel, /transition: opacity 200ms ease, visibility 200ms ease/);
  assert.match(panel, /#panel-body \{[\s\S]*background: transparent/);
  assert.doesNotMatch(script, /LV\$\{/);
  assert.match(main, /setIgnoreMouseEvents\(true, \{ forward: true \}\)/);
  assert.match(main, /pet-ignore-mouse/);
  assert.match(main, /dock-drag-start/);
  assert.match(main, /dock-drag-end/);
  assert.match(main, /getDisplayNearestPoint/);
  assert.match(preload, /dockDragStart:/);
  assert.match(preload, /dockDragEnd:/);
  assert.match(preload, /setIgnoreMouse:/);
  assert.match(petScript, /dockDragStart/);
  assert.match(petScript, /setIgnoreMouse/);
  assert.doesNotMatch(main, /focusable: false/);
  assert.doesNotMatch(main, /skipTaskbar: true/);
  assert.match(main, /function openPet\(\) \{[\s\S]*destroyPetWindow\(\)/);
  assert.match(main, /placePet\(\)/);
  assert.match(petPage, /id="pet-sprite"/);
  assert.match(petPage, /id="pet-chat"/);
  assert.match(petPage, /background: transparent/);
  assert.match(petPage, /width: 70px/);
  assert.match(petPage, /height: 70px/);
  assert.match(petPage, /\.pet-chat\.is-on/);
  assert.match(petPage, /is-legs"[\s\S]*hidden/);
  assert.match(petPage, /id="pet-sprite"[\s\S]*hidden/);
  assert.match(petPage, /\.pet-layer:not\(\[src\]\),[\s\S]*display: none/);
  assert.match(panel, /#panel-pet \.pet-layer:not\(\[src\]\),[\s\S]*display: none/);
  assert.match(panel, /data-layer="legs"[\s\S]*hidden/);
  assert.match(petScript, /plainPetStack\(shownPet, shownPose,/);
  assert.match(petScript, /scaleX\(-1\)/);
  assert.match(petScript, /chatBubbleScope/);
  assert.match(main, /chatBubbleCopy/);
  assert.match(main, /pickChatLineIndex/);
  assert.match(main, /CHAT_LINE_TICKS = 3/);
  assert.match(panel, /#panel-pet-stack \{[^}]*position: absolute/);
  assert.match(petPage, /#pet-stack \{[^}]*position: absolute/);
  assert.match(main, /PET_CHAT_PAD = 64/);
  assert.match(main, /PET_CHAT_WIDTH = 168/);
  assert.match(main, /spriteOrigin\.x - overhang/);
  assert.match(main, /edge === "top"/);
  assert.match(petPage, /body\.edge-right #pet-root/);
  assert.match(petPage, /body\.edge-top #pet-root/);
  assert.match(petScript, /applyDockEdge/);
  assert.doesNotMatch(main, /PET_CHAT_GAP|chatWidth: PET_CHAT_WIDTH|sideClear/);
  assert.match(main, /petClosing/);
  assert.doesNotMatch(main, /Closing \$\{host\}/);
  assert.doesNotMatch(main, /function showBubble|function hideBubble|bubbleHost/);
  const chat = readFileSync(new URL("../desktop/chat-bubble.js", import.meta.url), "utf8");
  assert.match(chat, /Start a study session on our web!/);
  assert.match(chat, /That's enough!!!/);
  assert.match(chat, /Lock in bro >:\(/);
  assert.match(chat, /auramaxxing\.\.\./);
  assert.match(main, /function closeFrontTab/);
  assert.match(main, /return closeFrontWindow\(appName\)/);
  assert.doesNotMatch(main, /await walkPetTo\(target\.x, target\.y\)/);
  assert.match(main, /assetOrigin: petAssetOrigin\(\)/);
  assert.doesNotMatch(main, /if \(petAnimating \|\| dockDrag\) return/);
  assert.doesNotMatch(main, /panelOpen\) \{\s*win\.hide\(\)/);
  assert.match(script, /window\.pet\.setOpen\(/);
  assert.match(script, /Close Aurafarm/);
  assert.match(script, /state\.panelOpen/);
  assert.match(preload, /setOpen: \(open\) => ipcRenderer\.send\("set-panel-open", open\)/);
  const openPanel = main.slice(main.indexOf("function openPanel"), main.indexOf("async function restoreSession"));
  assert.match(openPanel, /frame: false/);
  assert.match(openPanel, /transparent: true/);
  assert.match(openPanel, /movable: false/);
  assert.match(openPanel, /panelBounds\(panelOpen\)/);
  assert.match(panel, /--shell-cream: #f7f3e8/);
  assert.doesNotMatch(panel, /#10241c/);
  assert.match(panel, /width: 31px/);
  assert.match(panel, /--frame-pad: 8px/);
  assert.match(panel, /is-bounds-open/);
  assert.match(panel, /#panel-body \{[\s\S]*padding: 0\.55rem;/);
  assert.doesNotMatch(panel, /#panel-body \{[^}]*border-right|#dock-rail \{[^}]*border-right/);
  assert.match(panel, /"Outfit", "Avenir Next", "Segoe UI", sans-serif/);
  assert.match(panel, /font-size: 13px/);
  assert.doesNotMatch(panel, /#shell \{[^}]*border-radius: 999px/);
  assert.match(panel, /background: #c5ef47/);
  assert.match(panel, /background: #f5f0e2/);
  assert.match(main, /PANEL_COLLAPSED_WIDTH = DOCK_DEFAULTS\.barThickness/);
  assert.match(main, /PANEL_HEIGHT = DOCK_DEFAULTS\.panelLength/);
  assert.match(main, /PANEL_COLLAPSED_HEIGHT = DOCK_DEFAULTS\.barLength/);
  assert.match(main, /PANEL_EXPANDED_WIDTH = DOCK_DEFAULTS\.panelSpan/);
  assert.match(main, /edge: "right"/);
  assert.match(main, /setBounds\(panelBounds\(panelOpen \|\| panelBoundsOpen\), false\)/);
  assert.match(main, /if \(dock\.edge === "right"\) return currentOverlay\("open"\)/);
  assert.match(main, /if \(dock\.edge !== "right"\) applyPanelBounds\("open"/);
  assert.match(script, /function syncHitTarget/);
  assert.match(main, /panelBoundsOpen/);
  assert.match(main, /ipcMain\.on\("set-panel-open"/);
  assert.match(main, /beginDockDrag|endDockDrag|cancelDockDrag/);
  assert.doesNotMatch(main, /writeSecret\("dock/);
  assert.doesNotMatch(main, /readSecret\("dock/);
  assert.match(main, /function focusPanel\(\)[\s\S]*setPanelOpen\(true\)/);
  assert.match(main, /display-metrics-changed/);
  assert.doesNotMatch(panel, /textarea/);
  assert.match(panel, /#panel-actions \{\s*display: grid;\s*gap: 0\.45rem;\s*flex: none;\s*margin-top: auto;\s*margin-bottom: 0;/);
  assert.match(panel, /id="panel-actions"[\s\S]*id="finish"[\s\S]*id="quit"/);
  assert.match(panel, /id="quit"/);
  assert.match(panel, />Quit</);
  assert.match(script, /getElementById\("quit"\)/);
  assert.match(script, /window\.pet\.quit\(\)/);
  assert.match(preload, /quit: \(\) => ipcRenderer\.send\("quit-app"\)/);
  assert.match(main, /ipcMain\.on\("quit-app", \(\) => \{\s*app\.quit\(\);\s*\}\)/);
});

test("a commented vercel origin falls back to the local desk", () => {
  assert.equal(usableApiOrigin(["#https://aurafarm.vercel.app", ""]), "http://localhost:3000");
  assert.equal(usableApiOrigin("https://aurafarm.vercel.app/"), "https://aurafarm.vercel.app");
});

test("the study clock shows the planned time that is left", () => {
  assert.equal(formatStudyClock(90.2 * 1000), "1:31");
  assert.equal(formatStudyClock((3 * 3600 + 5 * 60) * 1000), "3:05:00");
  assert.equal(formatStudyClock(0), "0:00");
  assert.equal(formatSessionClock(90.2 * 1000), "1:31");
  assert.equal(formatSessionClock(0), "+0:00");
  assert.equal(formatSessionClock(-65_000), "+1:05");
  assert.equal(remainingStudyMs({ startedAtMs: 1_000 }, 1_000), null);
  assert.equal(
    remainingStudyMs({ plannedSeconds: 120, startedAtMs: 1_700_000_000_000 }, 1_700_000_030_000),
    90_000,
  );
  const started = 1_700_000_000_000;
  assert.equal(studyProgress({ plannedSeconds: 120, startedAtMs: started }, started + 60_000), 0.5);
  assert.equal(studyProgress({ plannedSeconds: 120, startedAtMs: started }, started + 120_000), 1);
  assert.equal(studyProgress({ startedAtMs: started }, started), null);
});

test("the pet aims beside the traffic lights on the tab strip", () => {
  assert.deepEqual(petOriginForTabStrip({ x: 100, y: 40 }, 70), { x: 106, y: 23 });
  assert.deepEqual(parseWindowBounds("12, 40, 812, 640"), { x: 12, y: 40, width: 800, height: 600 });
  assert.equal(parseWindowBounds("nope"), null);
  assert.deepEqual(
    clampPetOrigin({ x: -20, y: -40 }, 70, { x: 0, y: 0, width: 1400, height: 900 }),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    clampPetOrigin({ x: 2000, y: 2000 }, 70, { x: 0, y: 0, width: 1400, height: 900 }),
    { x: 1330, y: 830 },
  );
});

test("a focused desktop pet uses the petting love face", () => {
  assert.equal(restingPetPose({ sessionActive: true }), "blush");
  assert.equal(restingPetPose({ sessionActive: true, onDistracted: false }), "blush");
  assert.equal(restingPetPose({ sessionActive: true, onDistracted: true }), "idle");
  assert.equal(restingPetPose({ sessionActive: false, onDistracted: false }), "idle");
  assert.equal(restingPetPose({ sessionActive: true, closing: true }), "idle");
  assert.equal(
    restingPetPose({ sessionActive: true, animating: true, closing: true, currentPose: "blush" }),
    "idle",
  );
  assert.equal(
    restingPetPose({ sessionActive: true, onDistracted: true, animating: true, currentPose: "walk2" }),
    "walk2",
  );
  assert.equal(
    plainPetStack("baby_slime", "blush").face,
    "/pet-assets/pets/cat/colors/sage/face/blush.svg",
  );
  assert.equal(
    plainPetStack("baby_slime", "idle").face,
    "/pet-assets/pets/cat/colors/sage/face/normal.svg",
  );
  const dressed = plainPetStack("baby_slime", "idle", {
    color: "sky",
    hat: "hat_a",
    clothes: "clothes_a",
  });
  assert.equal(dressed.body, "/pet-assets/pets/cat/colors/sky/body.svg");
  assert.equal(dressed.hat, "/pet-assets/accessories/worn/hats/hat_a.svg");
  assert.equal(dressed.hatPlacement, "overlay");
  assert.equal(
    plainPetStack("baby_slime", "idle", { hat: "little-gentleman-top-hat" }).hatPlacement,
    "head",
  );
  assert.match(readFileSync(new URL("../desktop/pet.html", import.meta.url), "utf8"), /is-hat\.is-head[\s\S]*top: -12%/);
  assert.equal(dressed.clothes, "/pet-assets/accessories/worn/clothes_a/cat.svg");
  assert.equal(plainPetStack("baby_slime", "idle", { hat: "nope" }).hat, null);
  // 2026-11-26 is Thursday in Hong Kong.
  const thursday = new Date("2026-11-26T04:00:00.000Z");
  assert.equal(sessionDayKind({ studyDays: [1, 2, 3, 4, 5], restDays: [6, 7] }, thursday), "study");
  assert.equal(sessionDayKind({ studyDays: [1, 3, 5], restDays: [2, 4, 6, 7] }, thursday), "rest");
  assert.equal(sessionDayKind({ studyDays: [], restDays: [] }, thursday), "unset");
  assert.equal(sessionDayKind({ studyDays: ["1", "2", "3", "4", "5"], restDays: "{6,7}" }, thursday), "study");
  assert.deepEqual(parseWeekdays("{1,2,3,4,5}"), [1, 2, 3, 4, 5]);
  assert.equal(sessionRailColors("rest").liquid, "#3f78c8");
  assert.equal(sessionRailColors("study").track, "#f3c2bc");
  const main = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  assert.match(main, /restingPetPose/);
  assert.match(main, /function applyRestingPetPose/);
});

test("a plain pet uses the default species sprite", () => {
  assert.equal(plainPetPath("baby_slime", "idle"), "/pet-assets/pets/cat/colors/sage/body.svg");
  assert.equal(plainPetPath("lantern_moth", "walk1"), "/pet-assets/pets/bunny/colors/lavender/body.svg");
  assert.equal(plainPetPath("river_newt", "walk2"), "/pet-assets/pets/cat/colors/honey/body.svg");
  assert.equal(plainPetPath("unknown", "idle"), "/pet-assets/pets/cat/colors/sage/body.svg");
  assert.equal(clampPetX(-4, 200, 70), 0);
  assert.equal(clampPetX(180, 200, 70), 130);
  assert.equal(clampPetX(40, 200, 70), 40);
});

test("the pet posts the score and does not open a port", () => {
  const main = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/sessions/[id]/score/route.ts", import.meta.url), "utf8");
  assert.match(main, /\/api\/sessions\/\$\{current\.id\}\/score/);
  assert.match(main, /\[score\] POST \$\{current\.id\}/);
  assert.match(main, /\[score\] session \$\{sessionId\} is/);
  assert.match(main, /rpc\("submit_study_score"/);
  assert.match(main, /openScorePage\(saved\.url, lastBrowserApp \|\| current\.browser\)/);
  assert.match(main, /openScorePage\(result\.url, lastBrowserApp \|\| current\.browser\)/);
  assert.match(main, /\["-a", browser, url\]/);
  assert.match(main, /shell\.openExternal\(url\)/);
  assert.match(main, /readScoreBrowser\(DESK_HOST\)/);
  assert.match(main, /openExternal/);
  assert.doesNotMatch(main, /\.listen\(/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /submit_study_score/);
});
