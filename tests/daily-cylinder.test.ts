import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CYLINDER_RULER_LINES,
  CYLINDER_TICK_MS,
  cylinderHeat,
  cylinderProgress,
  cylinderTone,
} from "../lib/daily-cylinder";
import {
  filterSessionsAfterCylinderReset,
  liveSessionCountsAfterCylinderReset,
} from "../lib/cylinder-reset";

test("cylinder fill caps at the rim and marks goal met", () => {
  assert.deepEqual(cylinderProgress(0, 60), {
    ratio: 0,
    goalMet: false,
    studiedMinutes: 0,
    goalMinutes: 60,
  });
  assert.equal(cylinderProgress(30, 60).ratio, 0.5);
  assert.equal(cylinderProgress(60, 60).goalMet, true);
  assert.equal(cylinderProgress(90, 60).ratio, 1);
  assert.equal(cylinderProgress(90, 60).goalMet, true);
});

test("cylinder heat steps at each ruler band; rest tone stays separate", () => {
  assert.equal(cylinderHeat(0), 0);
  assert.equal(cylinderHeat(0.12), 0);
  assert.equal(cylinderHeat(0.125), 0.125);
  assert.equal(cylinderHeat(0.5), 0.5);
  assert.equal(cylinderHeat(1), 1);
  assert.equal(cylinderHeat(1.2), 1);
  assert.equal(cylinderTone(true), "study");
  assert.equal(cylinderTone(false), "rest");
  assert.equal(CYLINDER_TICK_MS, 10_000);
});

test("seven ruler lines divide the tube into eight bands", () => {
  assert.deepEqual([...CYLINDER_RULER_LINES], [1, 2, 3, 4, 5, 6, 7]);
});

test("cylinder reset ignores sessions ended before the wipe", () => {
  const reset = { localDay: "2026-11-17", resetAtMs: Date.parse("2026-11-17T04:00:00.000Z") };
  const sessions = [
    { status: "submitted" as const, endedAt: "2026-11-17T03:00:00.000Z", durationSeconds: 1800 },
    { status: "submitted" as const, endedAt: "2026-11-17T05:00:00.000Z", durationSeconds: 600 },
  ];
  const kept = filterSessionsAfterCylinderReset(sessions, reset, "2026-11-17");
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.endedAt, "2026-11-17T05:00:00.000Z");
  assert.equal(liveSessionCountsAfterCylinderReset("2026-11-17T03:30:00.000Z", reset, "2026-11-17"), false);
  assert.equal(liveSessionCountsAfterCylinderReset("2026-11-17T05:30:00.000Z", reset, "2026-11-17"), true);
});

test("living room hosts the daily cylinder in the top-right", () => {
  const room = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  const cylinder = readFileSync(
    new URL("../components/daily-progress-cylinder.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");

  assert.match(room, /DailyProgressCylinder/);
  assert.doesNotMatch(room, /petLevel/);
  assert.match(cylinder, /CYLINDER_RULER_LINES/);
  assert.match(cylinder, /is-\$\{tone\}/);
  assert.match(cylinder, /is-burning/);
  assert.doesNotMatch(cylinder, /room-cylinder-level|Lv\./);
  assert.match(css, /\.room-cylinder/);
  assert.match(css, /width: 44px/);
  assert.match(css, /height: 352px/);
  assert.match(css, /border-radius: 18px/);
  assert.match(css, /--cylinder-wall: #fffcf7/);
  assert.match(css, /border-radius: 0 0 11px 11px/);
  assert.match(css, /--cylinder-wall-hot/);
  assert.match(css, /linear-gradient\(\s*to top/);
  assert.match(css, /max\(0%, calc\(var\(--cylinder-ratio\) \* 100% - 6%\)\)/);
  assert.match(css, /cylinder-fire/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /room-cylinder-rim|room-cylinder-base|room-cylinder-glass/);
  assert.match(panel, /dailyStudiedMinutes/);
  assert.match(panel, /focusedSeconds/);
  assert.match(panel, /CYLINDER_TICK_MS/);
  assert.match(panel, /studySecondsOnLocalDay/);
  assert.match(panel, /filterSessionsAfterCylinderReset/);
  assert.match(desk, /isScheduledStudyDay/);
  assert.match(desk, /showDailyCylinder/);
  assert.match(desk, /planSessions=\{planSessions\}/);
});
