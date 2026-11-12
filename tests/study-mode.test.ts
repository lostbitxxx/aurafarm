import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adjustPlan,
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

  assert.equal(assassin.sessionMinutes, 15);
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
