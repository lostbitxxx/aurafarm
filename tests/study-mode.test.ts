import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  adjustPlan,
  BEHAVIOR_QUESTIONS,
  customizationMigrationMessage,
  defaultWeekdaysForLifestyle,
  isScheduledStudyDay,
  parseBehaviorAnswers,
  parseCustomizationInput,
  planForMode,
  recommendStudyMode,
  resolveWeekSchedule,
  restWeekdaysFor,
  weekdayFromLocalDay,
} from "../lib/study-mode";

test("study mode cards show assassin, knight, and lord pixel art", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  const modes = readFileSync(new URL("../lib/study-mode.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(wizard, /STUDY_MODE_ART\[item\]/);
  assert.match(wizard, /customize-mode-art/);
  assert.match(wizard, /customize-mode-copy[\s\S]*customize-mode-art/);
  assert.match(css, /\.customize-mode-art[\s\S]*image-rendering:\s*pixelated/);
  assert.match(css, /\.customize-mode-art[\s\S]*opacity:\s*0\.35/);
  assert.match(css, /\.customize-mode\.is-selected \.customize-mode-art[\s\S]*opacity:\s*1/);
  assert.match(css, /\.customize-mode-art[\s\S]*position:\s*absolute/);
  assert.match(css, /\.customize-mode-art[\s\S]*right:\s*0/);
  assert.match(css, /\.customize-mode-art[\s\S]*height:\s*100%/);
  for (const mode of ["assassin", "knight", "lord"]) {
    const art = readFileSync(new URL(`../public/pet-assets/ui/${mode}.svg`, import.meta.url), "utf8");
    assert.match(art, /viewBox="0 0 128 128"/);
    assert.match(art, /shape-rendering="crispEdges"/);
    assert.match(art, /data:image\/png;base64,/);
    assert.match(modes, new RegExp(`/pet-assets/ui/${mode}\\.svg`));
  }
});

test("study mode cards keep a fixed recommended label on the suggested mode", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(wizard, /recommendStudyMode/);
  assert.match(wizard, /Suggested for you/);
  assert.match(wizard, /item === recommended/);
  assert.match(wizard, /customize-mode-title/);
  assert.match(wizard, /customize-mode-recommended/);
  assert.match(wizard, />✦Recommended✦</);
  assert.doesNotMatch(wizard, /activeMode === recommended[\s\S]*customize-mode-recommended/);
  assert.match(css, /\.customize-mode-title/);
  assert.match(css, /\.customize-mode \.customize-mode-recommended/);
  assert.match(css, /\.customize-mode-recommended[\s\S]*position:\s*static/);
  assert.match(css, /\.customize-mode-recommended[\s\S]*font-style:\s*italic/);
  assert.match(css, /\.customize-mode-recommended[\s\S]*color:\s*#4a5c32/);
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
  assert.deepEqual(defaultWeekdaysForLifestyle("daily"), [1, 2, 3, 4, 5, 6]);
});

test("each study mode seeds its own daily minutes and lifestyle weekdays", () => {
  const assassin = planForMode("assassin", "steady");
  const knight = planForMode("knight", "few");
  const lord = planForMode("lord", "daily");

  assert.equal(assassin.sessionMinutes, 30);
  assert.deepEqual(assassin.studyWeekdays, [1, 2, 3, 4, 5]);
  assert.deepEqual(assassin.restWeekdays, [6, 7]);
  assert.equal(assassin.studyDaysPerWeek, 5);

  assert.equal(knight.sessionMinutes, 60);
  assert.deepEqual(knight.studyWeekdays, [1, 3, 5]);
  assert.deepEqual(knight.restWeekdays, [2, 4, 6, 7]);
  assert.equal(knight.studyDaysPerWeek, 3);

  assert.equal(lord.sessionMinutes, 90);
  assert.deepEqual(lord.studyWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(lord.restWeekdays, [7]);
  assert.equal(lord.studyDaysPerWeek, 6);
});

test("editing daily minutes and weekdays keeps the mode block length options", () => {
  const plan = adjustPlan("knight", 90, [1, 2, 3, 4, 5, 6]);
  assert.equal(plan.sessionMinutes, 90);
  assert.deepEqual(plan.studyWeekdays, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(plan.restWeekdays, [7]);
  assert.equal(plan.studyDaysPerWeek, 6);
});

test("study days and rest days partition the week for one farmer", () => {
  assert.deepEqual(restWeekdaysFor([1, 3, 5]), [2, 4, 6, 7]);
  assert.deepEqual(restWeekdaysFor([1, 2, 3, 4, 5, 6, 7]), []);

  assert.deepEqual(resolveWeekSchedule([1, 3, 5], [2, 4, 6, 7]), {
    studyDays: [1, 3, 5],
    restDays: [2, 4, 6, 7],
  });
  assert.deepEqual(resolveWeekSchedule([1, 2, 3, 4, 5, 6, 7], []), {
    studyDays: [1, 2, 3, 4, 5, 6, 7],
    restDays: [],
  });
  // A mismatched rest list is rebuilt from the stored study days.
  assert.deepEqual(resolveWeekSchedule([1, 2, 3, 4, 5], [7]), {
    studyDays: [1, 2, 3, 4, 5],
    restDays: [6, 7],
  });
  // Rest days alone can rebuild the study list.
  assert.deepEqual(resolveWeekSchedule(null, [6, 7]), {
    studyDays: [1, 2, 3, 4, 5],
    restDays: [6, 7],
  });
  assert.equal(resolveWeekSchedule(null, null), null);
  assert.equal(resolveWeekSchedule([], [1, 2, 3, 4, 5, 6, 7]), null);
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
  assert.deepEqual(parsed.plan.restWeekdays, [6, 7]);
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

test("customize wizard options use radiogroup semantics and visible radio markers", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(wizard, /role="radiogroup"/);
  assert.match(wizard, /role="radio"/);
  assert.match(wizard, /aria-checked=\{selected\}/);
  assert.match(wizard, /customize-option-radio/);
  assert.match(wizard, /onRadioGroupKeyDown/);
  assert.match(wizard, /data-radio-value/);
  assert.match(css, /\.customize-option-radio/);
  assert.match(css, /\.customize-option\.is-selected \.customize-option-radio/);
});

test("customize wizard steps are numbered Behavior, Study mode, Goals", () => {
  const wizard = readFileSync(new URL("../components/customize-wizard.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(wizard, /customize-step-index/);
  assert.match(wizard, /customize-step-label/);
  assert.match(wizard, /number:\s*1,\s*label:\s*"Behavior"/);
  assert.match(wizard, /number:\s*2,\s*label:\s*"Study mode"/);
  assert.match(wizard, /number:\s*3,\s*label:\s*"Goals"/);
  assert.match(wizard, /aria-current=\{step === item\.id \? "step" : undefined\}/);
  assert.match(css, /\.customize-steps li:not\(:last-child\)::after/);
  assert.match(css, /\.customize-steps button\.is-active \.customize-step-index/);
  assert.match(css, /\.customize-steps button\.is-done/);
  assert.match(css, /\.customize-steps button\.is-upcoming/);
});

test("behavior questions Q1 and Q2 use the customize-wizard copy tables", () => {
  const attention = BEHAVIOR_QUESTIONS.find((question) => question.id === "attention");
  const lifestyle = BEHAVIOR_QUESTIONS.find((question) => question.id === "lifestyle");
  const distraction = BEHAVIOR_QUESTIONS.find((question) => question.id === "distraction");
  assert.ok(attention);
  assert.ok(lifestyle);
  assert.ok(distraction);

  assert.equal(attention.hint, "Think about a typical day, not your best day.");
  assert.equal(attention.options[0]?.detail, "Short sessions with frequent breaks.");
  assert.equal(attention.options[1]?.label, "30–60 minutes");
  assert.equal(attention.options[1]?.detail, "A moderate session before a break.");
  assert.equal(attention.options[2]?.label, "Over 60 minutes");
  assert.equal(attention.options[2]?.detail, "Longer sessions with fewer interruptions.");

  assert.equal(lifestyle.hint, "Count the days you can usually make time for.");
  assert.equal(lifestyle.options[0]?.detail, "A few dedicated study days each week.");
  assert.equal(lifestyle.options[1]?.detail, "A consistent routine on most weekdays.");
  assert.equal(lifestyle.options[2]?.detail, "Study on most days of the week.");

  assert.equal(distraction.hint, "This shapes how strict your study mode should feel.");
  assert.equal(distraction.options[0]?.detail, "Distracted pretty easily.");
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

test("saving a study plan stores rest days from migration 0052", () => {
  const rest = readFileSync(
    new URL("../supabase/migrations/0052_weekly_rest_days.sql", import.meta.url),
    "utf8",
  );
  const action = readFileSync(new URL("../lib/actions/customize.ts", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../lib/dashboard.ts", import.meta.url), "utf8");
  assert.match(rest, /weekly_rest_days integer\[\]/);
  assert.match(rest, /function public\.weekly_study_rest_partition/);
  assert.match(rest, /profiles_weekly_rest_days_check/);
  assert.match(rest, /grant update \(\s*weekly_rest_days\s*\) on table public\.profiles to authenticated/);
  assert.match(action, /weekly_rest_days: parsed\.plan\.restWeekdays/);
  assert.match(dashboard, /weekly_rest_days/);
  assert.match(dashboard, /resolveWeekSchedule/);
  const missingRest = customizationMigrationMessage(
    'column "weekly_rest_days" of relation "profiles" does not exist',
  );
  assert.ok(missingRest);
  assert.match(missingRest, /0052/);
  const denied = customizationMigrationMessage("permission denied for column study_mode");
  assert.ok(denied);
  assert.match(denied, /0022/);
});
