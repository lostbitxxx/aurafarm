import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { macDesktopSupported } from "../lib/mac-desktop";

test("desktop pet support is macOS only", () => {
  assert.equal(macDesktopSupported({ uaPlatform: "macOS" }), true);
  assert.equal(macDesktopSupported({ uaPlatform: "Windows" }), false);
  assert.equal(macDesktopSupported({ uaPlatform: "Linux" }), false);
  assert.equal(macDesktopSupported({ uaPlatform: "Android" }), false);
  assert.equal(
    macDesktopSupported({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 }),
    true,
  );
  assert.equal(macDesktopSupported({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }), false);
  assert.equal(macDesktopSupported({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }), false);
  assert.equal(
    macDesktopSupported({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 5,
    }),
    false,
  );
});

test("both session dialogs recommend the desktop pet only on a Mac", () => {
  for (const file of ["components/study-panel.tsx", "components/crew-study-start.tsx"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /macDesktop !== true/);
    assert.match(source, /※ Recommended ※/);
    assert.match(source, /macDesktop === false[\s\S]*Not supported in this device/);
    assert.match(source, /const useDesktopPet = macDesktop === true/);
    assert.doesNotMatch(source, /trackerChoice/);
  }
});
