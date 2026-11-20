import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parseScoreRequest } from "../lib/scoring";

const require = createRequire(import.meta.url);
const { clampPetX, plainPetPath } = require("../desktop/pet-art.js") as {
  clampPetX: (x: number, laneWidth: number, spriteWidth: number) => number;
  plainPetPath: (petType: string, pose: string) => string;
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
const { formatStudyClock, remainingStudyMs, studyProgress } = require("../desktop/study-clock.js") as {
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
  assert.match(main, /if \(remaining !== null && remaining <= 0\) \{\s*setSessionProgress\(1\);\s*publish\(\);\s*void finishSession\(\);/);
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
  assert.match(desk, /Copy session code/);
  assert.match(desk, /Copy Terminal command/);
  assert.match(desk, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(desk, /id="length-title"[\s\S]*aria-label="Study length"[\s\S]*Custom[\s\S]*customOpen \? \([\s\S]*Custom minutes[\s\S]*How should this session be tracked/);
  assert.match(desk, /Desktop pet/);
  assert.match(desk, /Website timer/);
  assert.match(desk, /xattr -cr ~\/Downloads\/Aurafarm\.app/);
  assert.match(
    desk,
    /Desktop pet[\s\S]*If you haven't downloaded our desktop application, please download it here\.[\s\S]*<PetStatus downloadUrl=\{downloadUrl\} showHeading=\{false\} \/>[\s\S]*After downloading, unzip it, then open your Terminal and run this command:[\s\S]*xattr -cr ~\/Downloads\/Aurafarm\.app/,
  );
  assert.match(
    desk,
    /desktopStep === 2 \? \([\s\S]*When on, we close tabs like YouTube and Instagram for you when you get distracted\.[\s\S]*Close blocked tabs[\s\S]*Confirm/,
  );
  assert.doesNotMatch(desk, /closes a blocklist window|Closing blocklist windows is off|desktopHelp/);
  assert.match(desk, /desktopStep === 2 \|\| trackerChoice === false \? "Confirm" : "Next"/);
  assert.match(desk, /onAskTracker/);
  assert.match(desk, /onConfirmTracker/);
  assert.match(desk, /shownSession\.useDesktopPet \? \([\s\S]*study-active[\s\S]*StudyClock/);
  assert.match(desk, /onFinished=\{shownSession\.useDesktopPet \? null : \(\) => finishSession\(""\)\}/);
  assert.doesNotMatch(desk, /Started <time|chosen<\/p>/);
  assert.match(desk, /trackerChoice === true \?[\s\S]*The desktop pet tracks the time\.[\s\S]*trackerChoice === false/);
  assert.match(desk, /id="dev-title"[\s\S]*type="password"[\s\S]*Finish now/);
  assert.match(desk, /End session early/);
  assert.match(desk, /id="early-title"[\s\S]*bigger bonus[\s\S]*motivation-quote[\s\S]*Keep studying/);
  assert.doesNotMatch(desk, /Unlock/);
  assert.doesNotMatch(desk, /cancelStudySession/);
  assert.doesNotMatch(desk, /Cancel session/);
  assert.doesNotMatch(panel, /id="dock-handle"/);
  assert.match(panel, /id="panel-toggle"/);
  assert.match(panel, /id="session-fill"/);
  assert.doesNotMatch(panel, /id="exp-track"|id="exp-fill"|id="exp-level"/);
  assert.match(panel, /#session-fill[\s\S]*bottom: 0;/);
  assert.match(panel, /--session-green: #5fbf4a/);
  assert.doesNotMatch(panel, /--fill-purple|--track-sage|repeating-linear-gradient/);
  assert.match(panel, /id="shell"[\s\S]*id="dock-rail"[\s\S]*id="panel-toggle"[\s\S]*id="session-fill"[\s\S]*id="panel-body"/);
  assert.match(panel, /body\.edge-left[\s\S]*body\.edge-right[\s\S]*body\.edge-top[\s\S]*body\.edge-bottom/);
  assert.match(panel, /#panel-pet-stack \{[^}]*cursor: grab/);
  assert.doesNotMatch(panel, /#shell \{[^}]*cursor: grab/);
  assert.match(panel, /--shell-radius: 10px/);
  assert.match(panel, /border-radius: var\(--shell-radius\)/);
  assert.match(panel, /\.pet-chat::after/);
  assert.match(panel, /border-top: 5\.5px solid #fffdf6/);
  assert.match(panel, /width: 90px/);
  assert.match(panel, /height: 90px/);
  assert.match(panel, /#panel-action-row \{[\s\S]*grid-template-columns: minmax\(0, 1\.85fr\) minmax\(3\.25rem, 0\.85fr\)/);
  assert.match(script, /panelPetStack\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(script, /shell\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(panel, /id="dock-chrome"/);
  assert.match(panel, /#shell \{[\s\S]*box-shadow: none/);
  assert.doesNotMatch(panel, /box-shadow: 2px 3px 0/);
  assert.match(main, /setHasShadow\(false\)/);
  assert.match(main, /hasShadow: false/);
  assert.doesNotMatch(panel, /id="timer"|#timer \{/);
  assert.doesNotMatch(script, /remainingLabel/);
  assert.match(main, /Countdown UI lives on the desk site/);
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
  assert.doesNotMatch(panel, /id="pet-lane"/);
  assert.doesNotMatch(script, /clampPetX|startPetWalk|pet-lane/);
  assert.match(panel, /id="pet-switch-row"[\s\S]*id="pet-switch-label"[\s\S]*Show pet[\s\S]*id="pet-toggle"/);
  assert.match(panel, /id="pet-toggle"[^>]*role="switch"[^>]*aria-checked="true"/);
  assert.match(panel, /#pet-switch-row \{\s*position: absolute;\s*top: 0\.4rem;\s*right: 0\.45rem;[\s\S]*justify-content: flex-end;/);
  assert.match(panel, /#panel-body #pet-toggle \{\s*[\s\S]*width: 26px;\s*height: 16px;/);
  assert.match(panel, /#panel-body #pet-toggle\[aria-checked="true"\] \{\s*background: #34c759;/);
  assert.match(panel, /translateX\(10px\)/);
  assert.doesNotMatch(panel, /id="panel-actions"[\s\S]*id="pet-toggle"/);
  assert.match(script, /window\.pet\.setPetVisible\(/);
  assert.match(script, /state\.petVisible/);
  assert.match(preload, /setPetVisible: \(visible\) => ipcRenderer\.send\("set-pet-visible", visible\)/);
  assert.match(main, /ipcMain\.on\("set-pet-visible"/);
  assert.match(main, /let petVisible = true/);
  assert.match(main, /loadFile\(path\.join\(__dirname, "pet\.html"\)\)/);
  assert.match(main, /overlayLayout/);
  assert.match(main, /snapOverlay/);
  assert.match(main, /petOriginBesidePanel/);
  assert.match(main, /nearestEdge/);
  assert.match(main, /insetBottom/);
  assert.match(main, /select\("id, pet_type, level, xp"\)/);
  assert.match(main, /sessionProgress/);
  assert.match(main, /studyProgress/);
  assert.match(main, /syncSessionProgress/);
  assert.doesNotMatch(main, /xpIntoLevel|petStatsReady/);
  assert.match(main, /petDisplayProgress/);
  assert.match(main, /function applyPanelBounds/);
  assert.match(main, /PANEL_SURFACE_MS = 200/);
  assert.match(main, /PANEL_STAGE_MS = 140/);
  assert.match(main, /applyPanelBounds\("tall"\)/);
  assert.match(main, /applyPanelBounds\("open"\)/);
  assert.match(main, /applyPanelBounds\("closed"\)/);
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
  assert.match(main, /focusable: false/);
  assert.match(main, /skipTaskbar: true/);
  assert.match(main, /placePet\(\)/);
  assert.match(petPage, /id="pet-sprite"/);
  assert.match(petPage, /id="pet-chat"/);
  assert.match(petPage, /background: transparent/);
  assert.match(petPage, /width: 70px/);
  assert.match(petPage, /height: 70px/);
  assert.match(petPage, /\.pet-chat\.is-on/);
  assert.match(petScript, /plainPetStack\(shownPet, shownPose\)/);
  assert.match(petScript, /scaleX\(-1\)/);
  assert.match(petScript, /chatBubbleScope/);
  assert.match(main, /chatBubbleCopy/);
  assert.match(main, /PET_CHAT_PAD/);
  assert.match(main, /petClosing/);
  assert.doesNotMatch(main, /Closing \$\{host\}/);
  assert.doesNotMatch(main, /function showBubble|function hideBubble|bubbleHost/);
  const chat = readFileSync(new URL("../desktop/chat-bubble.js", import.meta.url), "utf8");
  assert.match(chat, /That's enough!!!/);
  assert.match(chat, /Lock in bro >:\(/);
  assert.match(chat, /auramaxxing\.\.\./);
  assert.match(main, /function closeFrontTab/);
  assert.match(main, /readFrontWindowBounds/);
  assert.match(main, /petOriginForTabStrip/);
  assert.match(main, /await walkPetTo\(target\.x, target\.y\)/);
  assert.match(main, /await jumpPet\(\)/);
  assert.match(main, /if \(petAnimating \|\| dockDrag\) return/);
  assert.match(main, /assetOrigin: API_ORIGIN/);
  assert.match(main, /panelOpen\) \{\s*win\.hide\(\)/);
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
  assert.match(panel, /width: 25px/);
  assert.match(panel, /#panel-body \{[\s\S]*padding: 1\.75rem 0\.55rem 0\.55rem 0\.55rem/);
  assert.doesNotMatch(panel, /#panel-body \{[^}]*border-right|#dock-rail \{[^}]*border-right/);
  assert.match(panel, /"Outfit", "Avenir Next", "Segoe UI", sans-serif/);
  assert.match(panel, /font-size: 13px/);
  assert.doesNotMatch(panel, /#shell \{[\s\S]*border-radius: 999px/);
  assert.match(panel, /background: #c5ef47/);
  assert.match(panel, /background: #f5f0e2/);
  assert.match(main, /PANEL_COLLAPSED_WIDTH = DOCK_DEFAULTS\.barThickness/);
  assert.match(main, /PANEL_HEIGHT = DOCK_DEFAULTS\.panelLength/);
  assert.match(main, /PANEL_COLLAPSED_HEIGHT = DOCK_DEFAULTS\.barLength/);
  assert.match(main, /PANEL_EXPANDED_WIDTH = DOCK_DEFAULTS\.panelSpan/);
  assert.match(main, /edge: "right"/);
  assert.match(main, /setBounds\(panelBounds\(panelOpen\), true\)/);
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
