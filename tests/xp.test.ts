import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { experienceProgress as deskProgress, levelFromExperience } from "../lib/study";
import { wholePoints as deskWholePoints } from "../lib/pets";

const require = createRequire(import.meta.url);
const { XP_PER_LEVEL, wholePoints, experienceProgress, petDisplayProgress } = require("../desktop/xp.js") as {
  XP_PER_LEVEL: number;
  wholePoints: (value: unknown) => number;
  experienceProgress: (xp: number) => { level: number; intoLevel: number; xp: number };
  petDisplayProgress: (row: Record<string, unknown> | null) => {
    petId: string | null;
    level: number | null;
    xpIntoLevel: number | null;
    xp: number | null;
    ready: boolean;
  };
};

test("desktop xp helpers match the desk wholePoints and experienceProgress", () => {
  assert.equal(XP_PER_LEVEL, 100);
  for (const xp of [0, 99, 100, 105, 250, "1850", 19 * 100 + 37]) {
    assert.equal(wholePoints(xp), deskWholePoints(xp));
    assert.deepEqual(experienceProgress(Number(xp)), deskProgress(deskWholePoints(xp)));
  }
  assert.equal(levelFromExperience(deskWholePoints(1900)), experienceProgress(1900).level);
});

test("within-level thresholds: start, mid, and next-level boundary", () => {
  assert.deepEqual(experienceProgress(1800), { level: 19, intoLevel: 0, xp: 1800 });
  assert.deepEqual(experienceProgress(1837), { level: 19, intoLevel: 37, xp: 1837 });
  assert.deepEqual(experienceProgress(1900), { level: 20, intoLevel: 0, xp: 1900 });
});

test("petDisplayProgress uses xp not the level column, and does not fake missing xp", () => {
  assert.deepEqual(petDisplayProgress({ id: "a", xp: "1837", level: 99 }), {
    petId: "a",
    level: 19,
    xpIntoLevel: 37,
    xp: 1837,
    ready: true,
  });
  assert.deepEqual(petDisplayProgress({ id: "a", xp: 0, level: 5 }), {
    petId: "a",
    level: 1,
    xpIntoLevel: 0,
    xp: 0,
    ready: true,
  });
  assert.equal(petDisplayProgress({ id: "a", level: 19 }).ready, false);
  assert.equal(petDisplayProgress({ id: "a", xp: null, level: 19 }).ready, false);
  assert.equal(petDisplayProgress(null).ready, false);
});
