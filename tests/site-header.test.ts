import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("desk header stacks nav under Aurafarm and uses a Settings menu", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(header, /topbar-brand/);
  assert.match(header, /className="wordmark"/);
  assert.match(header, /topbar-desktop-links/);
  assert.match(header, /topbar-settings/);
  assert.match(header, /aria-label=\{settingsOpen \? "Close settings" : "Open settings"\}/);
  assert.match(header, /topbar-settings-gear/);
  assert.match(header, /topbar-name/);
  assert.match(css, /\.topbar-brand/);
  assert.match(css, /\.topbar\s*\{[^}]*padding:\s*1\.1rem max\(1rem, 2vw\)/);
  assert.match(css, /\.desk-page \.wordmark\s*\{[^}]*font-size:\s*clamp\(2\.2rem/);
  assert.match(css, /\.topbar-name[\s\S]*text-decoration:\s*underline/);
  assert.match(css, /\.topbar-settings-list[\s\S]*right:\s*0/);
});

test("Settings lists Edit plan, Download, Privacy, Dev tools, then Sign out", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const settingsBlock = header.slice(
    header.indexOf("const settingsItems"),
    header.indexOf("return (", header.indexOf("const settingsItems")),
  );

  const editPlan = settingsBlock.indexOf("Edit plan");
  const download = settingsBlock.indexOf("Download desktop pet");
  const privacy = settingsBlock.indexOf('href="/privacy"');
  const social = settingsBlock.indexOf("Social settings");
  const devTools = settingsBlock.indexOf("Dev tools");
  const signOut = settingsBlock.indexOf("Sign out");

  assert.ok(editPlan >= 0);
  assert.ok(download > editPlan);
  assert.ok(privacy > download);
  assert.equal(social, -1);
  assert.ok(devTools > privacy);
  assert.ok(signOut > devTools);
});

test("header no longer hosts Social; blackboard owns it", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(header, /data-tutorial="social"/);
  assert.doesNotMatch(header, /onOpenFriends/);
  assert.doesNotMatch(header, /onOpenFarmCrew/);
  assert.doesNotMatch(header, /onOpenLeaderboard/);
  assert.doesNotMatch(header, /Social settings/);
});
