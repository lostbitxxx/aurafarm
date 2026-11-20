import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DESK_TUTORIAL_STEPS,
  parseTutorialRecord,
  progressLabel,
  sectionMatchesStep,
  serializeTutorialRecord,
  tutorialStorageKey,
} from "../lib/desk-tutorial";

test("desk tutorial walks shop, rack props, pets, social, start, then settings replay tip", () => {
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => step.id),
    ["shop", "collection", "pets", "achievements", "song", "social", "start", "replay"],
  );
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => step.target),
    ["shop", "collection", "pets", "achievements", "song", "social", "start", "settings"],
  );

  for (const step of DESK_TUTORIAL_STEPS) {
    assert.match(step.body, /Click /);
    if (step.kind === "dialog") {
      assert.ok("openBody" in step);
      assert.match(step.openBody, /\S/);
      assert.doesNotMatch(step.openBody, /Click the X/i);
    }
    if (step.kind === "start") {
      assert.match(step.body, /Start studying/i);
    } else if (step.kind === "settings") {
      assert.match(step.body, /Settings/i);
      assert.match(step.body, /Replay tutorial/i);
    } else if (step.id === "social") {
      assert.match(step.body, /blackboard/i);
      assert.equal(step.section, "social");
    } else if (step.id === "shop" || step.id === "pets") {
      assert.match(step.body, new RegExp(`Click ${step.title}`));
    } else if (step.kind === "dialog") {
      assert.match(step.body, /rack|trophy|gramophone|drawer/i);
    }
  }

  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((_, index) => progressLabel(index)),
    ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"],
  );
});

test("tutorial UI uses cursor guidance and keeps skip only", () => {
  const ui = readFileSync(new URL("../components/desk-tutorial.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(ui, /\/tutorial\/cursor\.svg/);
  assert.match(ui, /tutorial-cursor/);
  assert.match(ui, /Skip tutorial/);
  assert.doesNotMatch(ui, /tutorial-next/);
  assert.doesNotMatch(ui, /tutorial-prev/);
  assert.doesNotMatch(ui, />\s*Next\s*</);
  assert.doesNotMatch(ui, />\s*Prev\s*</);
  assert.match(ui, /replay/);
  assert.match(ui, /onSettings/);
  assert.match(css, /\.tutorial-cursor/);
});

test("tutorial storage resumes an active step and remembers when it is done", () => {
  assert.equal(tutorialStorageKey("farmer-1"), "aurafarm.tutorial.farmer-1");
  assert.equal(parseTutorialRecord(null), null);
  assert.equal(parseTutorialRecord("{"), null);
  assert.deepEqual(parseTutorialRecord(serializeTutorialRecord({ status: "active", step: 4 })), {
    status: "active",
    step: 4,
  });
  assert.deepEqual(parseTutorialRecord(serializeTutorialRecord({ status: "done" })), { status: "done" });
  assert.deepEqual(parseTutorialRecord(JSON.stringify({ status: "active", step: 40 })), {
    status: "active",
    step: DESK_TUTORIAL_STEPS.length - 1,
  });
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[2], "inventory"), true);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[5], "social"), true);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[5], "friends"), false);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[6], "shop"), false);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[7], "shop"), false);
});

test("the first customization save opens the desk tutorial", () => {
  const source = readFileSync(new URL("../lib/actions/customize.ts", import.meta.url), "utf8");
  const embeddedAt = source.indexOf('return { error: "", saved: true }');
  const tutorialAt = source.indexOf('"/dashboard?tutorial=1"');
  assert.ok(embeddedAt !== -1);
  assert.ok(tutorialAt !== -1);
  assert.ok(embeddedAt < tutorialAt);
  assert.match(source, /customization_completed_at/);
  assert.match(source, /firstCompletion/);
});
