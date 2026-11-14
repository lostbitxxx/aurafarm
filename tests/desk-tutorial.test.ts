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

test("desk tutorial walks every header from shop to social, then start studying", () => {
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => step.id),
    ["shop", "collection", "pets", "achievements", "song", "social", "start"],
  );
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => step.target),
    ["shop", "collection", "pets", "achievements", "song", "social", "start"],
  );

  for (const step of DESK_TUTORIAL_STEPS) {
    if (step.kind === "start") {
      assert.doesNotMatch(step.body, /inside/i);
      assert.match(step.body, /start a study session/i);
    } else {
      assert.match(step.body, new RegExp(`^Click ${step.title} to see what is inside\\.$`));
    }
  }

  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((_, index) => progressLabel(index)),
    ["1/7", "2/7", "3/7", "4/7", "5/7", "6/7", "7/7"],
  );
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
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[5], "friends"), true);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[5], "leaderboard"), true);
  assert.equal(sectionMatchesStep(DESK_TUTORIAL_STEPS[6], "shop"), false);
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
