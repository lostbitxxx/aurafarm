import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("desk header shows Aurafarm without a study mode icon", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(header, /className="wordmark"[\s\S]*Aurafarm/);
  assert.doesNotMatch(header, /wordmark-mode/);
  assert.doesNotMatch(header, /STUDY_MODE_ART/);
  assert.doesNotMatch(header, /studyMode=\{studyMode\}/);
  assert.match(desk, /studyMode=\{studyMode\}/);
  assert.match(css, /\.wordmark\s*\{[^}]*display:\s*inline-flex/);
  assert.doesNotMatch(css, /\.wordmark-mode/);
});

test("desk header stacks nav under Aurafarm and uses a Settings menu", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(header, /topbar-brand/);
  assert.match(header, /className="wordmark"/);
  assert.doesNotMatch(header, /topbar-desktop-links/);
  assert.doesNotMatch(header, />\s*Pets\s*</);
  assert.match(header, /topbar-settings/);
  assert.match(header, /aria-label=\{settingsOpen \? "Close settings" : "Open settings"\}/);
  assert.match(header, /topbar-settings-gear/);
  assert.doesNotMatch(header, /topbar-name/);
  assert.match(css, /\.topbar-brand/);
  assert.match(css, /\.topbar\s*\{[^}]*padding:\s*1\.1rem max\(1rem, 2vw\)/);
  assert.match(css, /\.desk-page \.wordmark\s*\{[^}]*font-size:\s*clamp\(2\.2rem/);
  assert.match(css, /\.topbar-settings-list[\s\S]*right:\s*0/);
});

test("Settings lists Download, Privacy, Replay tutorial, Dev tools, then Sign out", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const settingsBlock = header.slice(
    header.indexOf("const settingsItems"),
    header.indexOf("return (", header.indexOf("const settingsItems")),
  );

  const editPlan = settingsBlock.indexOf("Edit plan");
  const download = settingsBlock.indexOf("Download desktop pet");
  const privacy = settingsBlock.indexOf('href="/privacy"');
  const replay = settingsBlock.indexOf("Replay tutorial");
  const social = settingsBlock.indexOf("Social settings");
  const devTools = settingsBlock.indexOf("Dev tools");
  const signOut = settingsBlock.indexOf("Sign out");

  assert.equal(editPlan, -1);
  assert.ok(download >= 0);
  assert.ok(privacy > download);
  assert.ok(replay > privacy);
  assert.equal(social, -1);
  assert.ok(devTools > replay);
  assert.ok(signOut > devTools);
  assert.match(header, /data-tutorial="settings"/);
  assert.match(header, /onReplayTutorial/);
  assert.doesNotMatch(header, /onOpenEditPlan/);
});

test("header no longer hosts Social; blackboard owns it", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(header, /data-tutorial="social"/);
  assert.doesNotMatch(header, /onOpenFriends/);
  assert.doesNotMatch(header, /onOpenFarmCrew/);
  assert.doesNotMatch(header, /onOpenLeaderboard/);
  assert.doesNotMatch(header, /Social settings/);
});

test("header shows total pet level; streak calendar lives on the room wall", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../lib/living-room-layout.ts", import.meta.url), "utf8");
  const decor = readFileSync(new URL("../lib/room-decor.ts", import.meta.url), "utf8");
  const calendarSvg = readFileSync(
    new URL("../public/pet-assets/room/calendar/base.svg", import.meta.url),
    "utf8",
  );
  assert.match(header, /Total pet level:/);
  assert.doesNotMatch(header, /topbar-name/);
  assert.doesNotMatch(header, /streak-calendar/);
  assert.doesNotMatch(header, /STREAK_CALENDAR_SRC/);
  assert.doesNotMatch(header, /streak-pill/);
  assert.doesNotMatch(header, /🔥/);
  assert.doesNotMatch(header, /Study </);
  assert.match(desk, /petTotalLevel=/);
  assert.match(desk, /farmerName=\{displayName\}/);
  assert.doesNotMatch(desk, /recentStudyDays\(recordedSessions/);
  assert.match(panel, /calendarRecentDays\(\s*planSessions/);
  assert.match(panel, /goalMetToday\(dailyStudiedMinutes/);
  assert.match(panel, /streakTone=\{calendarTone\}/);
  assert.match(room, /createPortal/);
  assert.match(room, /is-fixed/);
  assert.match(room, /data-tutorial="streak-calendar"/);
  assert.match(room, /Let's start AuraFarming/);
  assert.match(room, /room-calendar-art/);
  assert.match(layout, /STREAK_CALENDAR_BOUNDS/);
  assert.match(layout, /id: "calendar"/);
  assert.match(decor, /mover: "calendar"/);
  assert.match(calendarSvg, /viewBox="0 0 44 48"/);
  assert.match(layout, /x: 198, y: 22, width: 44, height: 48/);
});

test("edit plan lives on the wall as a square framed painting", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../lib/living-room-layout.ts", import.meta.url), "utf8");
  const decor = readFileSync(new URL("../lib/room-decor.ts", import.meta.url), "utf8");
  const planSvg = readFileSync(new URL("../public/pet-assets/room/plan/base.svg", import.meta.url), "utf8");

  assert.doesNotMatch(header, /onOpenEditPlan|Edit plan/);
  assert.match(desk, /onOpenEditPlan=\{studyPlan \? \(\) => showSection\("edit-plan"\) : undefined\}/);
  assert.match(desk, /studyMode=\{studyMode\}/);
  assert.match(room, /onOpenEditPlan/);
  assert.match(room, /room-plan-painting/);
  assert.match(room, /room-plan-glass/);
  assert.match(room, /room-plan-frame/);
  assert.match(room, /data-prop-hotspot="plan"/);
  assert.match(room, /aria-label="Edit plan"/);
  assert.match(layout, /PLAN_PAINTING_BOUNDS/);
  assert.match(layout, /id: "plan"/);
  assert.match(layout, /x: 354, y: 22, width: 36, height: 36/);
  assert.match(decor, /mover: "plan"/);
  assert.match(planSvg, /viewBox="0 0 48 48"/);
});
