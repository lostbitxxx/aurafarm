import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { step } = require("../desktop/walk.js") as {
  step: (
    origin: { x: number; y: number },
    velocity: { x: number; y: number },
    windowSize: { x: number; y: number },
    rects: Array<{ x: number; y: number; width: number; height: number }>,
  ) => { position: { x: number; y: number }; velocity: { x: number; y: number } };
};

const windowSize = { x: 128, y: 128 };
const desk = { x: 0, y: 0, width: 1920, height: 1080 };
const edge = { x: 1920 - windowSize.x, y: 100 };
const velocity = { x: 4, y: 0 };

test("a pet at the right edge of one display turns around", () => {
  const turned = step(edge, velocity, windowSize, [desk]);
  assert.ok(turned.position.x < edge.x);
  assert.ok(turned.velocity.x < 0);
});

test("a pet at the right edge steps onto the next display", () => {
  const second = { x: 1920, y: 0, width: 1920, height: 1080 };
  const crossed = step(edge, velocity, windowSize, [desk, second]);
  assert.ok(crossed.position.x >= 1920);
  assert.ok(crossed.velocity.x > 0);
});

test("a pet in open space keeps its direction", () => {
  const middle = step({ x: 100, y: 100 }, velocity, windowSize, [desk]);
  assert.deepEqual(middle.position, { x: 104, y: 100 });
  assert.deepEqual(middle.velocity, velocity);
});
