import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { normalizeLaunchCode, parseClaimCode, petDownloadUrl } from "../lib/pet-device";

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
  assert.deepEqual(parseClaimCode({ code: "ABC234" }), { ok: true, code: "ABC234" });
  assert.equal(parseClaimCode({}).ok, false);
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
