import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPetLaunchUrl, formatDuration, formatTimestamp, startSessionDecision } from "../lib/study";

test("launch url carries only the session code", () => {
  const url = buildPetLaunchUrl("AB12CD34EF");
  assert.equal(url, "aurafarm://session?code=AB12CD34EF");

  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()], ["code"]);
  assert.equal(parsed.searchParams.get("code"), "AB12CD34EF");
});

test("a second start is refused while a session is active", () => {
  assert.equal(startSessionDecision(0).error, "");
  assert.match(startSessionDecision(1).error, /already running/);
  assert.match(startSessionDecision(2).error, /already running/);
});

test("timestamps render in UTC", () => {
  assert.equal(formatTimestamp("2026-11-04T15:28:00.000Z"), "4 Nov 2026, 15:28");
  assert.equal(formatTimestamp("not-a-time"), "not-a-time");
});

test("durations stay in whole hours, minutes, and seconds", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(125), "2m 5s");
  assert.equal(formatDuration(3661), "1h 1m");
});
