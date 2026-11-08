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
};

test("the sample score body parses", () => {
  const parsed = parseScoreRequest(exampleBody);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.token, "session-secret");
  assert.equal(parsed.durationSeconds, 1200);
  assert.equal(parsed.blockedCount, 1);
  assert.deepEqual(parsed.blockedHosts, ["www.instagram.com"]);
});

test("a score body needs a token, a whole duration, and a list of hosts", () => {
  assert.equal(parseScoreRequest({ ...exampleBody, token: "" }).ok, false);
  assert.equal(parseScoreRequest({ duration_seconds: 1200, blocked_count: 1, blocked_hosts: [] }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, duration_seconds: "1200" }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, blocked_hosts: "www.instagram.com" }).ok, false);
  assert.equal(parseScoreRequest({ ...exampleBody, blocked_hosts: [1] }).ok, false);
});

test("blocked hosts are capped before they reach the database", () => {
  const hosts = Array.from({ length: 25 }, (_, index) => `host-${index}.example`);
  const parsed = parseScoreRequest({ ...exampleBody, blocked_count: 0, blocked_hosts: hosts });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.blockedHosts.length, 20);
});

test("the score url uses the request origin and the session id", () => {
  assert.deepEqual(buildScoreResult("http://127.0.0.1:3000", "session-id", 40, true), {
    points: 40,
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
