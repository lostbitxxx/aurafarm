import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { parseAurafarmLink, sessionCodeFromPaste } = require("../desktop/links.js") as {
  parseAurafarmLink: (value: string) => { kind: "session"; code: string } | null;
  sessionCodeFromPaste: (value: string) => string;
};

test("session links keep only the launch code", () => {
  assert.equal(parseAurafarmLink("aurafarm://pair?token=device-token"), null);
  assert.deepEqual(parseAurafarmLink("aurafarm://session?code=ABC234"), {
    kind: "session",
    code: "ABC234",
  });
  const decorated = parseAurafarmLink(
    "aurafarm://session?code=ABC234&pet=baby_slime&user=someone-else",
  );
  assert.deepEqual(decorated, { kind: "session", code: "ABC234" });
  assert.equal(decorated && "pet" in decorated, false);
  assert.equal(decorated && "user" in decorated, false);
  assert.equal(parseAurafarmLink("https://example.com"), null);
  assert.equal(parseAurafarmLink("aurafarm://session?code=no"), null);
});

test("a pasted session field accepts a code or a session link", () => {
  assert.equal(sessionCodeFromPaste("  ABC234  "), "ABC234");
  assert.equal(sessionCodeFromPaste("aurafarm://session?code=ABC234"), "ABC234");
  assert.equal(sessionCodeFromPaste('{"access_token":"a","refresh_token":"b"}'), "");
  assert.equal(sessionCodeFromPaste("   "), "");
});
