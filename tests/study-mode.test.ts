import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  adjustPlan,
  customizationMigrationMessage,
  dailySessionsFromMonthly,
  parseBehaviorAnswers,
  parseCustomizationInput,
  planForMode,
  recommendStudyMode,
} from "../lib/study-mode";

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

test("each study mode suggests its own session length and monthly goal", () => {
  const assassin = planForMode("assassin", "steady");
  const knight = planForMode("knight", "steady");
  const lord = planForMode("lord", "steady");

  assert.equal(assassin.sessionMinutes, 30);
  assert.equal(assassin.monthlySessions, 40);
  assert.equal(assassin.dailySessions, dailySessionsFromMonthly(40, 5));

  assert.equal(knight.sessionMinutes, 60);
  assert.equal(knight.monthlySessions, 20);
  assert.equal(knight.dailySessions, 1);

  assert.equal(lord.sessionMinutes, 90);
  assert.equal(lord.monthlySessions, 12);
  assert.equal(lord.dailySessions, 1);
});

test("editing the monthly goal recalculates the daily slice", () => {
  const plan = adjustPlan("knight", 40, 5);
  assert.equal(plan.monthlySessions, 40);
  assert.equal(plan.dailySessions, 2);
  assert.equal(plan.sessionMinutes, 60);
});

test("customization form data is validated before save", () => {
  const form = new FormData();
  form.set("attention", "medium");
  form.set("lifestyle", "steady");
  form.set("distraction", "sometimes");
  form.set("studyMode", "knight");
  form.set("monthlySessions", "20");

  const parsed = parseCustomizationInput(form);
  assert.equal(parsed.error, "");
  if (parsed.error) return;
  assert.equal(parsed.plan.mode, "knight");
  assert.equal(parsed.plan.monthlySessions, 20);
  assert.equal(parsed.answers.lifestyle, "steady");

  assert.equal(parseBehaviorAnswers({ attention: "nope" }), null);
});

test("saving a study plan needs the column grant from migration 0022", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0022_study_customization_grant.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /grant update \(/);
  for (const column of [
    "study_mode",
    "preferred_session_minutes",
    "monthly_session_goal",
    "daily_session_goal",
    "study_days_per_week",
    "behavior_answers",
    "customization_completed_at",
  ]) {
    assert.match(sql, new RegExp(column));
  }
  assert.doesNotMatch(sql.slice(sql.indexOf("grant update")), /\bpoints\b/);
  const permissionDenied = customizationMigrationMessage(
    "permission denied for column study_mode",
  );
  assert.ok(permissionDenied);
  assert.match(permissionDenied, /0022/);
  const missingColumn = customizationMigrationMessage(
    'column "study_mode" does not exist',
  );
  assert.ok(missingColumn);
  assert.match(missingColumn, /0021/);
});
