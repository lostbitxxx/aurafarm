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
  assert.equal(finishLabel(0), "Finish focused session");
  assert.equal(finishLabel(1), "Finish distracted session");
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
  assert.match(panel, /Session token/);
  assert.match(script, /document\.addEventListener\("paste"/);
  assert.match(main, /role: "paste"/);
  assert.match(main, /context-menu/);
  assert.match(panel, /id="session-token"/);
  assert.match(panel, /#session-block \{\s*display: grid;\s*gap: 0\.45rem;\s*margin-top: 0;/);
  assert.match(panel, /id="session-block"[\s\S]*id="session-token"[\s\S]*id="status"/);
  assert.match(script, /window\.pet\.useToken\(/);
  assert.match(preload, /useToken: \(token\) => ipcRenderer\.invoke\("use-token", token\)/);
  assert.match(panel, /id="finish"/);
  assert.match(panel, /Finish focused session/);
  assert.match(panel, /id="finish"[^>]*hidden/);
  assert.match(script, /finishButton\.hidden = !state\.finishLabel/);
  assert.match(script, /window\.pet\.finish\(\)/);
  assert.match(script, /state\.finishLabel \|\| "Finish focused session"/);
  assert.match(script, /state\.bubble/);
  assert.match(preload, /finish: \(\) => ipcRenderer\.send\("finish-session"\)/);
  assert.match(main, /function focusPanel\(\)/);
  assert.match(main, /if \(remaining !== null && remaining <= 0\) void finishSession\(\)/);
  assert.doesNotMatch(main, /sprite\.html|finish\.html/);
  assert.match(main, /openPanel\(\)/);
  assert.doesNotMatch(panel, /type="email"|type="password"|id="sign-in"/);
  assert.match(main, /signInWithPassword/);
  assert.match(main, /ipcMain\.handle\("sign-in"/);
  assert.match(preload, /signIn: \(email, password\)/);
  assert.doesNotMatch(panel, /id="cancel"/);
  assert.doesNotMatch(panel, /Cancel study session/);
  assert.doesNotMatch(script, /cancelStudy/);
  assert.match(panel, /#session-token button \{\s*margin-top: 0\.7rem;/);
  assert.match(preload, /cancelStudy: \(\) => ipcRenderer\.invoke\("cancel-study"\)/);
  assert.match(main, /ipcMain\.handle\("cancel-study"/);
  assert.match(main, /does not change experience/);
  assert.doesNotMatch(main, /grant_study_experience/);
  assert.match(main, /planned_seconds/);
  assert.match(main, /closeFrontWindow/);
  assert.doesNotMatch(main, /The study time has not finished/);
  const desk = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  assert.match(desk, /Copy session code/);
  assert.match(desk, /Copy launch link/);
  assert.match(desk, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(desk, /id="length-title"[\s\S]*aria-label="Study length"[\s\S]*Custom[\s\S]*customOpen \? \([\s\S]*Custom minutes[\s\S]*How should this session be tracked/);
  assert.match(desk, /Desktop pet/);
  assert.match(desk, /Website timer/);
  assert.match(desk, /xattr -cr ~\/Downloads\/Aurafarm\.app/);
  assert.match(desk, /If this is the first time you download the app/);
  assert.match(desk, /desktopHelp \|\| trackerChoice === false \? "Confirm" : "Next"/);
  assert.match(desk, /onAskTracker/);
  assert.match(desk, /onConfirmTracker/);
  assert.match(desk, /shownSession\?\.useDesktopPet \? \([\s\S]*study-active[\s\S]*StudyClock/);
  assert.match(desk, /trackerChoice === true \? \([\s\S]*Close blocked tabs[\s\S]*trackerChoice === false/);
  assert.match(desk, /id="dev-title"[\s\S]*type="password"[\s\S]*Finish now/);
  assert.match(desk, /End session early/);
  assert.match(desk, /id="early-title"[\s\S]*bigger bonus[\s\S]*motivation-quote[\s\S]*Keep studying/);
  assert.doesNotMatch(desk, /Unlock/);
  assert.doesNotMatch(desk, /cancelStudySession/);
  assert.doesNotMatch(desk, /Cancel session/);
  assert.match(panel, /id="panel-toggle"/);
  assert.match(panel, /id="timer-fill"/);
  assert.match(panel, /#timer-fill[\s\S]*bottom: 0;/);
  assert.match(panel, /#timer-fill[\s\S]*background: #c5ef47;/);
  assert.match(script, /panelArrow\.textContent = open \? "›" : "‹"/);
  assert.match(panel, /aria-controls="panel-body"/);
  assert.match(panel, /aria-label="Open Aurafarm"/);
  assert.match(panel, /id="panel-body"/);
  assert.doesNotMatch(panel, /id="pet-lane"/);
  assert.doesNotMatch(script, /clampPetX|startPetWalk|pet-lane/);
  assert.match(panel, /id="pet-switch-row"[\s\S]*id="pet-switch-label"[\s\S]*Show pet[\s\S]*id="pet-toggle"/);
  assert.match(panel, /id="pet-toggle"[^>]*role="switch"[^>]*aria-checked="true"/);
  assert.match(panel, /#pet-switch-row \{\s*position: absolute;\s*top: 0\.4rem;\s*right: calc\(20px \+ 0\.8rem\);[\s\S]*justify-content: flex-end;/);
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
  assert.match(main, /panel\.x - width/);
  assert.match(main, /area\.y \+ area\.height - height/);
  assert.match(main, /setIgnoreMouseEvents\(true, \{ forward: true \}\)/);
  assert.match(main, /focusable: false/);
  assert.match(main, /skipTaskbar: true/);
  assert.match(main, /placePet\(\)/);
  assert.match(petPage, /id="pet-sprite"/);
  assert.match(petPage, /background: transparent/);
  assert.match(petPage, /width: 70px/);
  assert.match(petPage, /height: 70px/);
  assert.match(petScript, /plainPetPath\(shownPet, shownPose\)/);
  assert.match(petScript, /scaleX\(-1\)/);
  assert.match(main, /function closeFrontTab/);
  assert.match(main, /readFrontWindowBounds/);
  assert.match(main, /petOriginForTabStrip/);
  assert.match(main, /await walkPetTo\(aim\.x, aim\.y\)/);
  assert.match(main, /await jumpPet\(\)/);
  assert.match(main, /if \(petAnimating\) return/);
  assert.match(main, /assetOrigin: API_ORIGIN/);
  assert.match(script, /window\.pet\.setOpen\(/);
  assert.match(script, /Close Aurafarm/);
  assert.match(script, /state\.panelOpen/);
  assert.match(preload, /setOpen: \(open\) => ipcRenderer\.send\("set-panel-open", open\)/);
  const openPanel = main.slice(main.indexOf("function openPanel"), main.indexOf("async function restoreSession"));
  assert.match(openPanel, /frame: false/);
  assert.match(openPanel, /transparent: true/);
  assert.match(openPanel, /movable: false/);
  assert.match(openPanel, /panelBounds\(panelOpen\)/);
  assert.match(panel, /background: #f7f3e8/);
  assert.doesNotMatch(panel, /#10241c/);
  assert.match(panel, /width: 24px/);
  assert.match(panel, /padding: 0\.55rem calc\(20px \+ 0\.45rem\) 0\.55rem 0\.45rem/);
  assert.doesNotMatch(panel, /border-right/);
  assert.match(panel, /"Outfit", "Avenir Next", "Segoe UI", sans-serif/);
  assert.match(panel, /font-size: 13px/);
  assert.match(panel, /border-radius: 999px/);
  assert.match(panel, /background: #c5ef47/);
  assert.match(panel, /background: #f5f0e2/);
  assert.match(main, /PANEL_COLLAPSED_WIDTH = 24/);
  assert.match(main, /PANEL_HEIGHT = 275/);
  assert.match(main, /PANEL_COLLAPSED_HEIGHT = 239/);
  assert.match(main, /PANEL_EXPANDED_WIDTH = 320/);
  assert.match(main, /area\.x \+ area\.width - width/);
  assert.match(main, /area\.y \+ area\.height - height/);
  assert.match(main, /setBounds\(panelBounds\(panelOpen\), true\)/);
  assert.match(main, /ipcMain\.on\("set-panel-open"/);
  assert.match(main, /function focusPanel\(\)[\s\S]*setPanelOpen\(true\)/);
  assert.match(main, /display-metrics-changed/);
  assert.match(panel, /textarea \{\s*min-height: 2\.25rem;/);
  assert.match(panel, /#panel-actions \{\s*display: grid;\s*gap: 0\.45rem;\s*margin-top: auto;\s*margin-bottom: 0;/);
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
  assert.equal(plainPetPath("baby_slime", "idle"), "/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg");
  assert.equal(plainPetPath("lantern_moth", "walk1"), "/pet-assets/pets/bunny/lavender/no-hat-no-clothes/walk1.svg");
  assert.equal(plainPetPath("river_newt", "walk2"), "/pet-assets/pets/cat/honey/no-hat-no-clothes/walk2.svg");
  assert.equal(plainPetPath("unknown", "idle"), "/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg");
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
  assert.match(main, /openExternal/);
  assert.doesNotMatch(main, /\.listen\(/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /submit_study_score/);
});
