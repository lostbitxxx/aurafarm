import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parseScoreRequest } from "../lib/scoring";

const require = createRequire(import.meta.url);
const { finishLabel, interpretScoreResponse, scoreRequestBody } = require("../desktop/score.js") as {
  finishLabel: (blockedCount: number) => string;
  interpretScoreResponse: (
    status: number,
    body: unknown,
    origin: string,
    sessionId: string,
  ) => { ok: boolean; url: string; clearToken: boolean; message: string };
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
  };
};

const exampleBody = {
  token: "session-secret",
  duration_seconds: 1200,
  blocked_count: 1,
  blocked_hosts: ["www.instagram.com"],
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
});

test("a saved score opens the screen and a failed score keeps the token", () => {
  const sent = interpretScoreResponse(
    200,
    { url: "http://localhost:3000/dashboard/sessions/session-id", points: 40, distracted: true },
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
  assert.match(script, /window\.pet\.cancelStudy\(\)/);
  assert.match(preload, /cancelStudy: \(\) => ipcRenderer\.invoke\("cancel-study"\)/);
  assert.match(main, /cancel_study_session/);
  assert.doesNotMatch(
    readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8"),
    /Cancel session/,
  );
  assert.match(panel, /id="quit"/);
  assert.match(panel, />Quit</);
  assert.match(script, /getElementById\("quit"\)/);
  assert.match(script, /window\.pet\.quit\(\)/);
  assert.match(preload, /quit: \(\) => ipcRenderer\.send\("quit-app"\)/);
  assert.match(main, /ipcMain\.on\("quit-app", \(\) => \{\s*app\.quit\(\);\s*\}\)/);
});

test("the pet posts the score and does not open a port", () => {
  const main = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  assert.match(main, /\/api\/sessions\/\$\{current\.id\}\/score/);
  assert.match(main, /\[score\] POST \$\{current\.id\}/);
  assert.match(main, /\[score\] session \$\{sessionId\} is/);
  assert.match(main, /openExternal/);
  assert.doesNotMatch(main, /\.listen\(/);
});
