import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parseScoreRequest } from "../lib/scoring";

const require = createRequire(import.meta.url);
const { distractionSeconds, finishLabel, interpretScoreResponse, scoreRequestBody, usableApiOrigin } = require("../desktop/score.js") as {
  distractionSeconds: (
    study: {
      startedAt: number;
      log: {
        distractionMs?: number;
        sampledAt?: number;
        onBlocklist?: boolean;
      };
    },
    nowMs: number,
  ) => number;
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
      log: {
        blockedCount: number;
        blockedHosts: string[];
        distractionMs?: number;
        sampledAt?: number;
        onBlocklist?: boolean;
        currentHost?: string;
      };
    },
    nowMs: number,
  ) => {
    token: string;
    duration_seconds: number;
    blocked_count: number;
    blocked_hosts: string[];
    distraction_seconds: number;
  };
};

const exampleBody = {
  token: "session-secret",
  duration_seconds: 1200,
  blocked_count: 1,
  blocked_hosts: ["www.instagram.com"],
  distraction_seconds: 0,
};

test("the pet score body is the phase 3 example", () => {
  const startedAt = 1_700_000_000_000;
  const body = scoreRequestBody(
    {
      token: "session-secret",
      startedAt,
      log: { blockedCount: 1, blockedHosts: ["www.instagram.com"] },
    },
    startedAt + 1200 * 1000 + 400,
  );
  assert.deepEqual(body, exampleBody);
  const parsed = parseScoreRequest(body);
  assert.equal(parsed.ok, true);
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
  assert.equal(clear.distraction_seconds, 0);

  const startedAt = 1_000_000;
  const distracted = scoreRequestBody(
    {
      token: "session-secret",
      startedAt,
      log: {
        blockedCount: 1,
        blockedHosts: ["www.instagram.com"],
        distractionMs: 90_000,
        onBlocklist: true,
        sampledAt: startedAt + 30_000,
        currentHost: "www.instagram.com",
      },
    },
    startedAt + 40_000,
  );
  assert.equal(distracted.duration_seconds, 40);
  assert.equal(distracted.distraction_seconds, 40);
  assert.equal(
    distractionSeconds(
      {
        startedAt,
        log: { distractionMs: 15_000, onBlocklist: false, sampledAt: startedAt },
      },
      startedAt + 120_000,
    ),
    15,
  );
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
  assert.match(panel, /Session token/);
  assert.match(panel, /id="session-token"/);
  assert.match(script, /window\.pet\.useToken\(/);
  assert.match(preload, /useToken: \(token\) => ipcRenderer\.invoke\("use-token", token\)/);
  assert.match(main, /show: false/);
  assert.match(main, /function showPet\(\)/);
  assert.match(main, /function hidePet\(\)/);
  assert.match(main, /petShown = false/);
  assert.match(main, /if \(!petShown\) return/);
  assert.match(main, /win\.setVisibleOnAllWorkspaces\(false\)/);
  assert.match(main, /openPanel\(\)/);
  assert.doesNotMatch(panel, /type="email"|type="password"|id="sign-in"/);
  assert.match(main, /signInWithPassword/);
  assert.match(main, /ipcMain\.handle\("sign-in"/);
  assert.match(preload, /signIn: \(email, password\)/);
  assert.match(panel, /id="cancel"/);
  assert.match(panel, /Cancel study session/);
  assert.match(script, /cancelStudy/);
  assert.match(preload, /cancelStudy: \(\) => ipcRenderer\.invoke\("cancel-study"\)/);
  assert.match(main, /ipcMain\.handle\("cancel-study"/);
  assert.match(main, /distraction_seconds: watched/);
  assert.match(main, /does not change experience/);
  assert.doesNotMatch(main, /grant_study_experience/);
  assert.match(main, /planned_seconds/);
  assert.match(main, /closeFrontTab/);
  assert.match(main, /remaining <= 0\) void finishSession/);
  assert.match(main, /response\.status === 200 \|\| response\.status === 409/);
  assert.doesNotMatch(main, /The study time has not finished/);
  const desk = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  assert.match(desk, /id="length-title"[\s\S]*aria-label="Study length"[\s\S]*Custom[\s\S]*customOpen \? \([\s\S]*Custom minutes[\s\S]*How should this session be tracked/);
  assert.match(desk, /Desktop pet/);
  assert.match(desk, /Website timer/);
  assert.match(desk, /Confirm/);
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
