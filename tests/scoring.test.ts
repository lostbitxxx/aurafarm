import assert from "node:assert/strict";
import { test } from "node:test";
import { hostMatchesBlocklist } from "../lib/blocklist";
import {
  DISTRACTED_SCORE,
  FOCUSED_SCORE,
  createLaunchCode,
  createSessionSecret,
  hashSecret,
  scoreForBlockedCount,
} from "../lib/scoring";

test("a clear session scores higher than a distracted one", () => {
  assert.equal(FOCUSED_SCORE, 100);
  assert.equal(DISTRACTED_SCORE, 40);
  assert.equal(scoreForBlockedCount(0), 100);
  assert.equal(scoreForBlockedCount(1), 40);
  assert.equal(scoreForBlockedCount(3), 40);
});

test("session secrets and launch codes are hashed as lowercase sha256 hex", () => {
  assert.equal(
    hashSecret("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );

  const secret = createSessionSecret();
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashSecret(secret).length, 64);
  assert.notEqual(createSessionSecret(), secret);

  const code = createLaunchCode();
  assert.match(code, /^[ABCDEFGHIJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(code.includes("0") || code.includes("1") || code.includes("O"), false);
});

test("blocklist hosts match themselves and their subdomains", () => {
  const blocked = ["instagram.com", "tiktok.com", "youtube.com"];
  assert.equal(hostMatchesBlocklist("instagram.com", blocked), true);
  assert.equal(hostMatchesBlocklist("WWW.Instagram.com", blocked), true);
  assert.equal(hostMatchesBlocklist("www.instagram.com", blocked), true);
  assert.equal(hostMatchesBlocklist("notinstagram.com", blocked), false);
  assert.equal(hostMatchesBlocklist("instagram.com.evil.com", blocked), false);
  assert.equal(hostMatchesBlocklist("https://instagram.com", blocked), false);
});
