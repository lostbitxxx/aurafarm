import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { launchLinksFromArgs, parseAurafarmLink } = require("../desktop/links.js") as {
  launchLinksFromArgs: (argv: unknown) => string[];
  parseAurafarmLink: (value: string) => { kind: "session"; code: string } | null;
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

test("launch args keep aurafarm links and ignore the electron path", () => {
  assert.deepEqual(
    launchLinksFromArgs([
      "/Users/kittykwan/aurafarm/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      "/Users/kittykwan/aurafarm/desktop",
      "--aurafarm-link=aurafarm://session?code=ABC234",
      "https://example.com",
    ]),
    ["aurafarm://session?code=ABC234"],
  );
  assert.deepEqual(launchLinksFromArgs(["aurafarm://session?code=ABC234"]), ["aurafarm://session?code=ABC234"]);
  assert.deepEqual(launchLinksFromArgs(null), []);
});
