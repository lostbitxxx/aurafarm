import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildPetLaunchUrl,
  closeBlockedMigrationMessage,
  formatDuration,
  formatTimestamp,
  startSessionDecision,
} from "../lib/study";

test("launch url carries only the session code", () => {
  const url = buildPetLaunchUrl("AB12CD34EF");
  assert.equal(url, "aurafarm://session?code=AB12CD34EF");

  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()], ["code"]);
  assert.equal(parsed.searchParams.get("code"), "AB12CD34EF");
  assert.equal(parsed.searchParams.get("pet"), null);
  assert.equal(parsed.searchParams.get("user"), null);
});

test("a study link shows the equipped pet for that session's user", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0007_close_blocked.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /where user_id = session_row\.user_id\s+and is_desktop_active/);
  assert.match(sql, /pet_type := coalesce\(equipped_type, 'baby_slime'\)/);

  const desktop = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  const refresh = desktop.slice(
    desktop.indexOf("async function refreshPet"),
    desktop.indexOf("async function signIn"),
  );
  assert.match(refresh, /\.eq\("is_desktop_active", true\)/);
  assert.match(refresh, /petType: data\.pet_type/);
  assert.doesNotMatch(refresh, /searchParams|link\.pet|body\.pet_type/);
  assert.match(desktop, /PET_REFRESH_MS/);
  assert.match(desktop, /void refreshPet\(\)/);
  const sprite = readFileSync(new URL("../desktop/sprite.js", import.meta.url), "utf8");
  assert.match(sprite, /function drawPet\(petType\)/);
  assert.match(sprite, /petType === "lantern_moth"/);
  assert.match(sprite, /petType === "river_newt"/);
  assert.match(sprite, /drawPet\(state\.petType\)/);
  assert.match(desktop, /loadFile\(path\.join\(__dirname, "sprite\.html"\)\)/);
  assert.match(desktop, /did-finish-load", publish/);
  assert.match(desktop, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(desktop, /SUPABASE_SECRET_KEY|SERVICE_ROLE/);
});

test("a missing close_blocked column tells the farmer to run migration 0007", () => {
  assert.equal(closeBlockedMigrationMessage(null), null);
  assert.match(
    closeBlockedMigrationMessage("Could not find the 'close_blocked' column of 'profiles' in the schema cache") ?? "",
    /migration 0007/,
  );
  assert.equal(closeBlockedMigrationMessage("Sign in to change this."), "Sign in to change this.");
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
