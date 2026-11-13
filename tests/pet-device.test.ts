import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { acceptedClaimRow, normalizeLaunchCode, parseClaimCode, petDownloadUrl } from "../lib/pet-device";

test("the download link is an absolute http url", () => {
  assert.equal(petDownloadUrl(undefined), null);
  assert.equal(petDownloadUrl("/aurafarm.exe"), null);
  assert.equal(
    petDownloadUrl("https://downloads.example/aurafarm.exe"),
    "https://downloads.example/aurafarm.exe",
  );
});

test("claim inputs stay on the aurafarm session link", () => {
  assert.equal(normalizeLaunchCode("  aurafarm://session?code=ABC234  "), "ABC234");
  assert.equal(
    normalizeLaunchCode("aurafarm://session?pet=baby_slime&code=ABC234&user=other"),
    "ABC234",
  );
  assert.deepEqual(parseClaimCode({ code: "ABC234", pet: "river_newt" }), {
    ok: true,
    code: "ABC234",
  });
  assert.equal(parseClaimCode({}).ok, false);
});

test("a claim without claimed_at still starts the session", () => {
  const now = new Date("2026-11-13T09:00:00.000Z");
  const older = acceptedClaimRow(
    [
      {
        session_id: "session-id",
        pet_type: "lantern_moth",
        level: 1,
        blocklist: ["instagram.com"],
        close_blocked: true,
        planned_seconds: 300,
        started_at: "2026-11-13T08:59:00.000Z",
      },
    ],
    now,
  );
  assert.equal(older?.sessionId, "session-id");
  assert.equal(older?.plannedSeconds, 300);
  assert.equal(older?.claimedAt, "2026-11-13T09:00:00.000Z");

  const current = acceptedClaimRow({
    session_id: "session-id",
    pet_type: "lantern_moth",
    level: "2",
    blocklist: [],
    planned_seconds: "20",
    started_at: "2026-11-13T08:59:00.000Z",
    claimed_at: "2026-11-13T09:00:05.000Z",
  });
  assert.equal(current?.level, 2);
  assert.equal(current?.plannedSeconds, 20);
  assert.equal(current?.claimedAt, "2026-11-13T09:00:05.000Z");
  assert.equal(acceptedClaimRow({ pet_type: "lantern_moth" }), null);
});

test("the desk source does not call the pet over loopback", () => {
  for (const file of [...sourceFiles("components"), ...sourceFiles("app")]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /127\.0\.0\.1/, file);
    assert.doesNotMatch(source, /localhost:47331/, file);
  }
});

test("pet devices are hashed and heartbeats are not table updates for anon", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0006_pet_devices.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /function public\.pair_pet_device/);
  assert.match(sql, /function public\.touch_pet_device/);
  assert.match(sql, /function public\.claim_study_session/);
  assert.match(sql, /security definer/);
  assert.match(sql, /extensions\.digest\(raw_token, 'sha256'\)/);
  assert.match(sql, /extensions\.digest\(raw_code, 'sha256'\)/);
  assert.match(sql, /grant execute on function public\.touch_pet_device\(text\) to anon/);
  assert.match(sql, /grant execute on function public\.claim_study_session\(text, text\) to anon/);
  assert.match(sql, /grant execute on function public\.pair_pet_device\(text, text\) to authenticated/);
  assert.doesNotMatch(sql, /grant update on table public\.pet_devices to anon/i);
  assert.match(sql, /token_hash text not null unique/);
});

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(tsx|ts|jsx|js)$/.test(entry)) found.push(path);
  }
  return found;
}
