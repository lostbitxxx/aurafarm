import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("registration no longer asks the person to confirm their email", () => {
  const auth = readFileSync(new URL("../lib/actions/auth.ts", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/register-form.tsx", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.doesNotMatch(auth, /Confirm your email/);
  assert.doesNotMatch(form, /Confirm your email/);
  assert.match(auth, /still requiring email confirmation/);
  assert.match(auth, /if \(!data\.session\)/);
  assert.match(auth, /redirect\("\/customize"\)/);
  assert.match(readme, /turn \*\*Confirm email\*\* off/);
  assert.doesNotMatch(readme, /when email confirmation is enabled/);
});
