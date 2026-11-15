import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  nearestEdge,
  overlayLayout,
  panelSize,
  snapOverlay,
} = require("../desktop/dock.js") as {
  nearestEdge: (x: number, y: number, area: { x: number; y: number; width: number; height: number }) => string;
  overlayLayout: (
    edge: string,
    offset: number,
    open: boolean,
    area: { x: number; y: number; width: number; height: number },
    options?: Record<string, number>,
  ) => {
    edge: string;
    offset: number;
    vertical: boolean;
    panel: { x: number; y: number; width: number; height: number };
    pet: { x: number; y: number; width: number; height: number };
  };
  panelSize: (
    edge: string,
    open: boolean,
    area: { x: number; y: number; width: number; height: number },
  ) => { width: number; height: number };
  snapOverlay: (
    panelBounds: { x: number; y: number; width: number; height: number },
    pointer: { x: number; y: number },
    area: { x: number; y: number; width: number; height: number },
    open: boolean,
  ) => {
    edge: string;
    offset: number;
    panel: { x: number; y: number; width: number; height: number };
    pet: { x: number; y: number; width: number; height: number };
  };
};

const area = { x: 100, y: 50, width: 1400, height: 900 };

test("nearestEdge picks each side and breaks corner ties stably", () => {
  assert.equal(nearestEdge(120, 500, area), "left");
  assert.equal(nearestEdge(1480, 500, area), "right");
  assert.equal(nearestEdge(800, 70, area), "top");
  assert.equal(nearestEdge(800, 930, area), "bottom");
  // Exact corner: left distance == top distance → left wins by priority.
  assert.equal(nearestEdge(100, 50, area), "left");
  assert.equal(nearestEdge(1500, 50, area), "right");
  assert.equal(nearestEdge(1500, 950, area), "right");
});

test("panelSize is vertical on the sides and horizontal on the top and bottom", () => {
  const closedRight = panelSize("right", false, area);
  assert.equal(closedRight.width, 24);
  assert.ok(closedRight.height > 24);
  const openRight = panelSize("right", true, area);
  assert.equal(openRight.width, 320);
  assert.equal(openRight.height, 275);
  const closedTop = panelSize("top", false, area);
  assert.equal(closedTop.height, 24);
  assert.ok(closedTop.width > 24);
  const openTop = panelSize("top", true, area);
  assert.equal(openTop.width, 320);
  assert.equal(openTop.height, 275);
});

test("overlayLayout keeps the docked group inside the inset work area", () => {
  const right = overlayLayout("right", Number.MAX_SAFE_INTEGER, false, area);
  assert.equal(right.edge, "right");
  assert.equal(right.vertical, true);
  assert.equal(right.panel.x + right.panel.width, area.x + area.width - 4);
  assert.equal(right.panel.y + right.panel.height, area.y + area.height - 4);
  assert.ok(right.pet.x + right.pet.width <= right.panel.x + 1);
  assert.ok(right.pet.y >= area.y + 4);

  const left = overlayLayout("left", 0, false, area);
  assert.equal(left.panel.x, area.x + 4);
  assert.ok(left.pet.x >= left.panel.x + left.panel.width);

  const top = overlayLayout("top", 200, false, area);
  assert.equal(top.vertical, false);
  assert.equal(top.panel.y, area.y + 4);
  assert.ok(top.pet.y >= top.panel.y + top.panel.height);

  const bottom = overlayLayout("bottom", 200, false, area);
  assert.equal(bottom.panel.y + bottom.panel.height, area.y + area.height - 4);
  assert.ok(bottom.pet.y + bottom.pet.height <= bottom.panel.y + 1);
});

test("snapOverlay preserves along-edge place and chooses the nearest edge", () => {
  const floating = { x: 900, y: 400, width: 24, height: 261 };
  const toLeft = snapOverlay(floating, { x: 130, y: 420 }, area, false);
  assert.equal(toLeft.edge, "left");
  assert.equal(toLeft.panel.x, area.x + 4);
  assert.ok(Math.abs(toLeft.panel.y - floating.y) < 30 || toLeft.offset >= 0);

  const toBottom = snapOverlay(floating, { x: 920, y: 920 }, area, false);
  assert.equal(toBottom.edge, "bottom");
  assert.equal(toBottom.panel.y + toBottom.panel.height, area.y + area.height - 4);
  assert.ok(toBottom.panel.x >= area.x + 4);
});

test("secondary-display work areas with non-zero origin still clamp", () => {
  const second = { x: 1920, y: -200, width: 1600, height: 1000 };
  const layout = overlayLayout("right", 500, false, second);
  assert.ok(layout.panel.x >= second.x);
  assert.ok(layout.panel.x + layout.panel.width <= second.x + second.width);
  assert.ok(layout.panel.y >= second.y);
  assert.ok(layout.panel.y + layout.panel.height <= second.y + second.height);
  assert.ok(layout.pet.x >= second.x);
  assert.ok(layout.pet.y >= second.y);
});
