import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { labelForBlockedHost } from "../lib/blocklist";
import { buildScoreResult, parseScoreRequest } from "../lib/scoring";

const exampleBody = {
  token: "session-secret",
  duration_seconds: 1200,
  blocked_count: 1,
  blocked_hosts: ["www.instagram.com"],
  local_day: "2026-11-13",
};

test("the sample score body parses", () => {
  const parsed = parseScoreRequest(exampleBody);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.token, "session-secret");
  assert.equal(parsed.durationSeconds, 1200);
  assert.equal(parsed.blockedCount, 1);
  assert.deepEqual(parsed.blockedHosts, ["www.instagram.com"]);
  assert.equal(parsed.localDay, "2026-11-13");
});

test("a score body needs a token, a whole duration, a list of hosts, and a local day", () => {
  const { local_day: _day, ...withoutDay } = exampleBody;
  assert.equal(parseScoreRequest({ ...exampleBody, token: "" }).ok, false);
  assert.equal(parseScoreRequest({ duration_seconds: 1200, blocked_count: 1, blocked_hosts: [] }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, duration_seconds: "1200" }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, blocked_hosts: "www.instagram.com" }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, blocked_hosts: [1] }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, local_day: "13-11-2026" }).ok, false);
  assert.equal(parseScoreRequest(withoutDay).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, local_day: null }).ok, false);
  const withDay = parseScoreRequest({ ...exampleBody, local_day: "2026-11-13" });
  assert.equal(withDay.ok, true);
  if (withDay.ok) assert.equal(withDay.localDay, "2026-11-13");
});

test("blocked hosts are capped before they reach the database", () => {
  const hosts = Array.from({ length: 25 }, (_, index) => `host-${index}.example`);
  const parsed = parseScoreRequest({ ...exampleBody, blocked_count: 0, blocked_hosts: hosts });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.blockedHosts.length, 20);
});

test("the session page uses the same paper layout as sign-in", () => {
  const session = readFileSync(new URL("../app/dashboard/sessions/[id]/page.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /paper-shell/);
  assert.match(login, /auth-layout/);
  assert.match(login, /auth-card/);
  assert.match(session, /paper-shell/);
  assert.match(session, /auth-layout/);
  assert.match(session, /auth-aside/);
  assert.match(session, /auth-card/);
  assert.match(session, /PublicHeader/);
  assert.match(session, /Back to the desk/);
});

test("the score url uses the request origin and the session id", () => {
  assert.deepEqual(buildScoreResult("http://127.0.0.1:3000", "session-id", 46, true), {
    xp: 46,
    distracted: true,
    url: "http://127.0.0.1:3000/dashboard/sessions/session-id",
  });
});

test("a subdomain score uses the blocklist label", () => {
  const entries = [
    { host: "instagram.com", label: "Instagram" },
    { host: "tiktok.com", label: "TikTok" },
  ];
  assert.equal(labelForBlockedHost("www.instagram.com", entries), "Instagram");
  assert.equal(labelForBlockedHost("example.com", entries), "example.com");
});

test("a second submit is a different database error from a bad token", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0003_score_submit_status.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /Score already submitted/);
  assert.match(sql, /Score rejected/);
});

test("a finished session adds its score to the wallet once", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0010_score_wallet_points.sql", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../app/api/sessions/[id]/score/route.ts", import.meta.url),
    "utf8",
  );
  const creditedAt = sql.indexOf("set points = farmer.points + result_points");
  const alreadySubmittedAt = sql.indexOf("session_row.status = 'submitted'");
  assert.ok(alreadySubmittedAt >= 0);
  assert.ok(creditedAt > alreadySubmittedAt);
  assert.match(sql, /where farmer\.id = session_row\.user_id/);
  assert.doesNotMatch(sql, /set points = points \+/);
  assert.match(sql, /Score already submitted/);
  assert.doesNotMatch(sql, /grant update \([^)]*points/);
  assert.match(route, /revalidatePath\("\/dashboard"\)/);
  assert.match(route, /revalidatePath\(`\/dashboard\/sessions\/\$\{id\}`\)/);
  assert.doesNotMatch(route, /revalidatePath\("\/shop"\)/);
  assert.match(route, /revalidatePath\("\/inventory"\)/);
  assert.match(route, /\[score\] \$\{id\} rejected/);
  assert.match(route, /status=\$\{data\.status\} has_token=/);
  assert.doesNotMatch(route, /console\.error\([\s\S]*parsed\.token/);
});
