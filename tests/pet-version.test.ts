import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PET_VERSION, petVersionPayload } from "../lib/pet-version";

const require = createRequire(import.meta.url);
const { isNewerVersion, updateOffer } = require("../desktop/version.js") as {
  isNewerVersion: (remote: string, local: string) => boolean;
  updateOffer: (
    localVersion: string,
    body: unknown,
  ) => { version: string; url: string } | null;
};

test("the version route reports the pet version and the download url", () => {
  assert.deepEqual(petVersionPayload(undefined), { version: "0.1.0", download_url: "" });
  assert.deepEqual(petVersionPayload("https://downloads.example/aurafarm-mac.zip"), {
    version: "0.1.0",
    download_url: "https://downloads.example/aurafarm-mac.zip",
  });
  assert.equal(petVersionPayload("notaurl").download_url, "");
  const packaged = JSON.parse(readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  assert.equal(packaged.version, PET_VERSION);
});

test("a newer published version is an update and the same version is not", () => {
  assert.equal(isNewerVersion("0.2.0", "0.1.0"), true);
  assert.equal(isNewerVersion("0.1.0", "0.1.0"), false);
  assert.equal(isNewerVersion("0.1.0", "0.2.0"), false);
  assert.equal(
    updateOffer("0.1.0", {
      version: "0.2.0",
      download_url: "https://downloads.example/aurafarm-mac.zip",
    })?.url,
    "https://downloads.example/aurafarm-mac.zip",
  );
  assert.equal(
    updateOffer("0.1.0", { version: "0.1.0", download_url: "https://downloads.example/aurafarm-mac.zip" }),
    null,
  );
  assert.equal(updateOffer("0.1.0", { version: "0.2.0", download_url: "" }), null);
});

test("the privacy page states what the pet reads", () => {
  const page = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.match(page, /address bar of the frontmost browser window/);
  assert.match(page, /does not read background tabs, page contents, or passwords/);
  assert.match(page, /closes that front tab after 8 seconds/);
  assert.match(page, /does not close any other tab/);
  assert.match(page, /stores the score, the duration, the blocked count, and the blocked hostnames/);
  assert.match(page, /heartbeat is a timestamp, not a list of tabs/);
  assert.match(page, /quitting the pet stops the address-bar check/);
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /href="\/privacy"/);
});

test("the version route is public and the repo has no extension", () => {
  const route = readFileSync(new URL("../app/api/pet/version/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function GET/);
  assert.match(route, /await connection\(\)/);
  assert.doesNotMatch(route, /export const dynamic|export const revalidate|export const fetchCache/);
  assert.doesNotMatch(route, /getClaims|authorization/);
  const forbidden = /export const (dynamic|revalidate|fetchCache|dynamicParams)\b/;
  for (const file of sourceFiles(fileURLToPath(new URL("../app", import.meta.url)))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), forbidden, file);
  }
  assert.equal(existsSync(new URL("../extension", import.meta.url)), false);
  const builder = readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8");
  assert.match(builder, /"output": "dist"/);
});

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(root)) {
    const file = join(root, name);
    if (statSync(file).isDirectory()) {
      found.push(...sourceFiles(file));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(name)) found.push(file);
  }
  return found;
}
