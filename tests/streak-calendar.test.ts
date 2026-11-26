import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  calendarRecentDays,
  goalMetToday,
  recentStudyDays,
  streakCalendarTone,
  sumPetLevels,
} from "../lib/streak-calendar";

test("streak calendar tone follows study day and goal met", () => {
  assert.equal(streakCalendarTone(true, false), "study-pending");
  assert.equal(streakCalendarTone(true, true), "study-done");
  assert.equal(streakCalendarTone(false, false), "rest-pending");
  assert.equal(streakCalendarTone(false, true), "rest-done");
});

test("goalMetToday uses preferred minutes when set", () => {
  assert.equal(goalMetToday(29, 30), false);
  assert.equal(goalMetToday(30, 30), true);
  assert.equal(goalMetToday(5, null), true);
  assert.equal(goalMetToday(0, null), false);
});

test("recentStudyDays returns newest-first totals", () => {
  const sessions = [
    {
      status: "submitted" as const,
      endedAt: "2026-11-26T04:00:00.000Z",
      durationSeconds: 600,
    },
    {
      status: "submitted" as const,
      endedAt: "2026-11-25T04:00:00.000Z",
      durationSeconds: 1200,
    },
    {
      status: "cancelled" as const,
      endedAt: "2026-11-26T05:00:00.000Z",
      durationSeconds: 900,
    },
  ];
  const days = recentStudyDays(sessions, "2026-11-26", 3);
  assert.equal(days.length, 3);
  assert.equal(days[0]?.day, "2026-11-26");
  assert.equal(days[0]?.seconds, 600);
  assert.equal(days[1]?.day, "2026-11-25");
  assert.equal(days[1]?.seconds, 1200);
  assert.equal(days[2]?.day, "2026-11-24");
  assert.equal(days[2]?.seconds, 0);
});

test("calendarRecentDays keeps earlier days and replaces today with the live total", () => {
  const sessions = [
    {
      status: "submitted" as const,
      endedAt: "2026-11-26T04:00:00.000Z",
      durationSeconds: 600,
    },
    {
      status: "submitted" as const,
      endedAt: "2026-11-25T04:00:00.000Z",
      durationSeconds: 1200,
    },
  ];
  const days = calendarRecentDays(sessions, "2026-11-26", 95, 2);
  assert.equal(days[0]?.day, "2026-11-26");
  assert.equal(days[0]?.seconds, 95);
  assert.equal(days[1]?.seconds, 1200);
});

test("sumPetLevels floors and ignores non-finite values", () => {
  assert.equal(sumPetLevels([1, 2.9, Number.NaN, 3]), 6);
  assert.equal(sumPetLevels([]), 0);
});

test("streak calendar svg asset exists and is transparent-backed", () => {
  const path = new URL("../public/pet-assets/ui/streak-calendar.svg", import.meta.url);
  assert.equal(existsSync(path), true);
  const svg = readFileSync(path, "utf8");
  assert.match(svg, /data:image\/png;base64,/);
  assert.doesNotMatch(svg, /fill="#fff"/i);
});
