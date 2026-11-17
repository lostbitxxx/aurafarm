import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  adjustPlan,
  customizationMigrationMessage,
  defaultWeekdaysForLifestyle,
  isScheduledStudyDay,
  parseBehaviorAnswers,
  parseCustomizationInput,
  planForMode,
  recommendStudyMode,
  weekdayFromLocalDay,
} from "../lib/study-mode";

test("study mode cards keep a fixed recommended label on the suggested mode", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(wizard, /recommendStudyMode/);
  assert.match(wizard, /Suggested for you/);
  assert.match(wizard, /item === recommended/);
  assert.match(wizard, /customize-mode-recommended/);
  assert.match(wizard, />✦Recommended✦</);
  assert.doesNotMatch(wizard, /activeMode === recommended[\s\S]*customize-mode-recommended/);
  assert.match(css, /\.customize-mode-recommended/);
  assert.match(css, /position:\s*absolute/);
  assert.match(css, /\.customize-mode-recommended[\s\S]*font-style:\s*italic/);
  assert.doesNotMatch(css, /\.customize-mode-recommended[\s\S]{0,160}transform:\s*rotate/);
  assert.doesNotMatch(css, /\.customize-mode-recommended[\s\S]{0,120}border/);
  assert.doesNotMatch(css, /\.customize-mode-recommended[\s\S]{0,120}background:\s*(?!none)/);
});

test("behavior answers recommend assassin for short focus and frequent distraction", () => {
  assert.equal(
    recommendStudyMode({
      attention: "short",
      lifestyle: "few",
      distraction: "often",
    }),
    "assassin",
  );
  assert.equal(
    recommendStudyMode({
      attention: "medium",
      lifestyle: "steady",
      distraction: "sometimes",
    }),
    "knight",
  );
  assert.equal(
    recommendStudyMode({
      attention: "long",
      lifestyle: "daily",
      distraction: "rare",
    }),
    "lord",
  );
});

test("lifestyle presets pick Mon/Wed/Fri, weekdays, or every day", () => {
  assert.deepEqual(defaultWeekdaysForLifestyle("few"), [1, 3, 5]);
  assert.deepEqual(defaultWeekdaysForLifestyle("steady"), [1, 2, 3, 4, 5]);
  assert.deepEqual(defaultWeekdaysForLifestyle("daily"), [1, 2, 3, 4, 5, 6, 7]);
});

test("each study mode seeds its own daily minutes and lifestyle weekdays", () => {
  const assassin = planForMode("assassin", "steady");
  const knight = planForMode("knight", "few");
  const lord = planForMode("lord", "daily");

  assert.equal(assassin.sessionMinutes, 30);
  assert.deepEqual(assassin.studyWeekdays, [1, 2, 3, 4, 5]);
  assert.equal(assassin.studyDaysPerWeek, 5);

  assert.equal(knight.sessionMinutes, 60);
  assert.deepEqual(knight.studyWeekdays, [1, 3, 5]);
  assert.equal(knight.studyDaysPerWeek, 3);

  assert.equal(lord.sessionMinutes, 90);
  assert.deepEqual(lord.studyWeekdays, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(lord.studyDaysPerWeek, 7);
});

test("editing daily minutes and weekdays keeps the mode block length options", () => {
  const plan = adjustPlan("knight", 90, [1, 2, 3, 4, 5, 6]);
  assert.equal(plan.sessionMinutes, 90);
  assert.deepEqual(plan.studyWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.equal(plan.studyDaysPerWeek, 6);
});

test("customization form data is validated before save", () => {
  const form = new FormData();
  form.set("attention", "medium");
  form.set("lifestyle", "steady");
  form.set("distraction", "sometimes");
  form.set("studyMode", "knight");
  form.set("sessionMinutes", "60");
  form.set("studyWeekdays", "1,2,3,4,5");

  const parsed = parseCustomizationInput(form);
  assert.equal(parsed.error, "");
  if (parsed.error) return;
  assert.equal(parsed.plan.mode, "knight");
  assert.equal(parsed.plan.sessionMinutes, 60);
  assert.deepEqual(parsed.plan.studyWeekdays, [1, 2, 3, 4, 5]);
  assert.equal(parsed.answers.lifestyle, "steady");

  assert.equal(parseBehaviorAnswers({ attention: "nope" }), null);

  const emptyDays = new FormData();
  emptyDays.set("attention", "medium");
  emptyDays.set("lifestyle", "steady");
  emptyDays.set("distraction", "sometimes");
  emptyDays.set("studyMode", "knight");
  emptyDays.set("sessionMinutes", "60");
  emptyDays.set("studyWeekdays", "");
  assert.match(parseCustomizationInput(emptyDays).error, /at least one study day/i);
});

test("local calendar days map to ISO weekdays and scheduled study checks", () => {
  // 2026-11-16 is Monday in the Gregorian calendar.
  assert.equal(weekdayFromLocalDay("2026-11-16"), 1);
  assert.equal(weekdayFromLocalDay("2026-11-22"), 7);
  assert.equal(isScheduledStudyDay([1, 3, 5], "2026-11-16"), true);
  assert.equal(isScheduledStudyDay([1, 3, 5], "2026-11-17"), false);
});

test("goals step uses weekday toggles instead of a monthly session field", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  assert.match(wizard, /Set this week’s goal/);
  assert.match(wizard, /weekday-strip/);
  assert.match(wizard, /studyWeekdays/);
  assert.match(wizard, /sessionMinutes/);
  assert.match(wizard, /SESSION_MINUTE_OPTIONS/);
  assert.match(wizard, /✦Recommended✦/);
  assert.match(wizard, /SESSION_MINUTE_COPY/);
  assert.doesNotMatch(wizard, /session-minute-custom/);
  assert.doesNotMatch(wizard, /name="monthlySessions"/);
  assert.doesNotMatch(wizard, /Set this month’s goal/);
});

test("saving a study plan needs weekly_study_days from migration 0044", () => {
  const grant = readFileSync(
    new URL("../supabase/migrations/0022_study_customization_grant.sql", import.meta.url),
    "utf8",
  );
  const weekly = readFileSync(
    new URL("../supabase/migrations/0044_weekly_study_days.sql", import.meta.url),
    "utf8",
  );
  assert.match(grant, /grant update \(/);
  for (const column of [
    "study_mode",
    "preferred_session_minutes",
    "monthly_session_goal",
    "daily_session_goal",
    "study_days_per_week",
    "behavior_answers",
    "customization_completed_at",
  ]) {
    assert.match(grant, new RegExp(column));
  }
  assert.match(weekly, /weekly_study_days/);
  assert.match(weekly, /grant update \(/);
  assert.match(weekly, /weekly_study_days/);
  assert.doesNotMatch(grant.slice(grant.indexOf("grant update")), /\bpoints\b/);
  const permissionDenied = customizationMigrationMessage(
    "permission denied for column study_mode",
  );
  assert.ok(permissionDenied);
  assert.match(permissionDenied, /0022/);
  const missingColumn = customizationMigrationMessage(
    'column "weekly_study_days" does not exist',
  );
  assert.ok(missingColumn);
  assert.match(missingColumn, /0044/);
});
