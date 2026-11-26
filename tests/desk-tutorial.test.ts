import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DESK_TUTORIAL_STEPS,
  parseTutorialRecord,
  progressLabel,
  serializeTutorialRecord,
  tutorialStorageKey,
} from "../lib/desk-tutorial";

test("desk tutorial walks welcome through explore then start studying", () => {
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => step.id),
    ["welcome", "pet", "rewards", "daily", "adopt", "customize", "explore", "start"],
  );
  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((step) => [...step.targets]),
    [
      ["living-room"],
      ["pet"],
      ["coins", "pet-level"],
      ["daily-goal", "streak-calendar"],
      ["shop"],
      ["edit-furniture"],
      ["rack", "social"],
      ["start"],
    ],
  );

  for (const step of DESK_TUTORIAL_STEPS) {
    assert.match(step.title, /\S/);
    assert.match(step.body, /\S/);
    assert.ok(step.targets.length >= 1);
  }

  assert.match(DESK_TUTORIAL_STEPS[0].body, /living room/i);
  assert.match(DESK_TUTORIAL_STEPS[1].body, /desk buddy/i);
  assert.match(DESK_TUTORIAL_STEPS[2].body, /XP/i);
  assert.match(DESK_TUTORIAL_STEPS[2].body, /coins/i);
  assert.match(DESK_TUTORIAL_STEPS[3].body, /daily goal/i);
  assert.match(DESK_TUTORIAL_STEPS[3].body, /calendar/i);
  assert.match(DESK_TUTORIAL_STEPS[3].body, /streak/i);
  assert.match(DESK_TUTORIAL_STEPS[4].body, /adopt/i);
  assert.match(DESK_TUTORIAL_STEPS[5].body, /Edit Furniture/i);
  assert.match(DESK_TUTORIAL_STEPS[6].body, /blackboard/i);
  assert.match(DESK_TUTORIAL_STEPS[7].body, /Start studying/i);

  assert.deepEqual(
    DESK_TUTORIAL_STEPS.map((_, index) => progressLabel(index)),
    ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"],
  );
});

test("tutorial UI uses Back Next and Skip on replay only", () => {
  const ui = readFileSync(new URL("../components/desk-tutorial.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /tutorial-cursor/);
  assert.doesNotMatch(ui, /\/tutorial\/cursor\.svg/);
  assert.match(ui, /tutorial-nav/);
  assert.match(ui, /tutorial-scrim-svg/);
  assert.match(ui, /tutorial-block/);
  assert.match(ui, /maskId/);
  assert.match(ui, />\s*Back\s*</);
  assert.match(ui, />\s*Next\s*</);
  assert.match(ui, /is-primary/);
  assert.match(ui, /Skip tutorial/);
  assert.match(ui, /isReplay/);
  assert.match(ui, /replay/);
  assert.match(css, /\.tutorial-nav/);
  assert.match(css, /\.tutorial-nav\.is-primary/);
  assert.match(css, /\.tutorial-block/);
  assert.match(css, /background: var\(--slime\)/);
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

test("living room exposes tutorial targets and freezes pets while active", () => {
  const room = readFileSync(new URL("../components/living-room.tsx", import.meta.url), "utf8");
  assert.match(room, /data-tutorial="living-room"/);
  assert.match(room, /data-tutorial="rack"/);
  assert.match(room, /data-tutorial="daily-goal"/);
  assert.match(room, /data-tutorial="edit-furniture"/);
  assert.match(room, /data-tutorial=\{isSpotlight \? "pet-level" : undefined\}/);
  assert.match(room, /className="room-pet-label"/);
  assert.match(room, /paused=\{tutorialActive\}/);
  assert.match(room, /showLevel: true/);
  assert.match(room, /Lv\.\{pose\.level\}/);
});

test("header coins carry a tutorial target", () => {
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /data-tutorial="coins"/);
});
