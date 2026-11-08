import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { parseAurafarmLink } = require("../desktop/links.js") as {
  parseAurafarmLink: (value: string) =>
    | { kind: "pair"; token: string }
    | { kind: "session"; code: string }
    | null;
};

test("pair and session links keep only their own field", () => {
  assert.deepEqual(parseAurafarmLink("aurafarm://pair?token=device-token"), {
    kind: "pair",
    token: "device-token",
  });
  assert.deepEqual(parseAurafarmLink("aurafarm://session?code=ABC234"), {
    kind: "session",
    code: "ABC234",
  });
  assert.equal(parseAurafarmLink("https://example.com"), null);
  assert.equal(parseAurafarmLink("aurafarm://session?code=no"), null);
});
