import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
type DockMode = boolean | "closed" | "tall" | "open";
type Area = { x: number; y: number; width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

const {
  nearestEdge,
  overlayLayout,
  panelSize,
  snapOverlay,
} = require("../desktop/dock.js") as {
  nearestEdge: (x: number, y: number, area: Area) => string;
  overlayLayout: (
    edge: string,
    offset: number,
    open: DockMode,
    area: Area,
    options?: Record<string, number>,
  ) => {
    edge: string;
    offset: number;
    vertical: boolean;
    panel: Rect;
    pet: Rect;
  };
  panelSize: (edge: string, open: DockMode, area: Area) => { width: number; height: number };
  snapOverlay: (
    panelBounds: Rect,
    pointer: { x: number; y: number },
    area: Area,
    open: DockMode,
  ) => {
    edge: string;
    offset: number;
    panel: Rect;
    pet: Rect;
  };
};

const area = { x: 100, y: 50, width: 1400, height: 900 };

test("nearestEdge picks left, right, or top and never bottom", () => {
  assert.equal(nearestEdge(120, 500, area), "left");
  assert.equal(nearestEdge(1480, 500, area), "right");
  assert.equal(nearestEdge(800, 70, area), "top");
  // Near the bottom: bottom is not a dock target — pick left/right instead.
  assert.equal(nearestEdge(200, 930, area), "left");
  assert.equal(nearestEdge(1400, 930, area), "right");
  // Exact corner: left distance == top distance → left wins by priority.
  assert.equal(nearestEdge(100, 50, area), "left");
  assert.equal(nearestEdge(1500, 50, area), "right");
  assert.equal(nearestEdge(1500, 950, area), "right");
});

test("panelSize is vertical on the sides and horizontal on the top", () => {
  const closedRight = panelSize("right", false, area);
  assert.equal(closedRight.width, 52);
  assert.ok(closedRight.height > 52);
  const tallRight = panelSize("right", "tall", area);
  assert.equal(tallRight.width, 52);
  assert.ok(tallRight.height >= 275);
  const openRight = panelSize("right", true, area);
  assert.ok(openRight.width >= 320);
  assert.equal(openRight.height, tallRight.height);
  const closedTop = panelSize("top", false, area);
  assert.equal(closedTop.height, 52);
  assert.ok(closedTop.width > 52);
  const openTop = panelSize("top", true, area);
  assert.ok(openTop.width >= 320);
  assert.ok(openTop.height >= 275);
});

test("overlayLayout keeps the docked group inside the inset work area", () => {
  const right = overlayLayout("right", Number.MAX_SAFE_INTEGER, false, area);
  assert.equal(right.edge, "right");
  assert.equal(right.vertical, true);
  assert.equal(right.panel.x + right.panel.width, area.x + area.width - 8);
  // Bottom is flush (insetBottom: 0); sides/top keep inset.
  assert.equal(right.panel.y + right.panel.height, area.y + area.height);
  // Pet sits beside the EXP rail, not the far left of an open panel.
  assert.equal(right.pet.x + right.pet.width, right.panel.x);
  assert.ok(right.pet.y >= area.y + 8);
  assert.equal(right.pet.y + right.pet.height, area.y + area.height);

  const openRight = overlayLayout("right", Number.MAX_SAFE_INTEGER, true, area);
  assert.equal(openRight.pet.x + openRight.pet.width, openRight.panel.x + openRight.panel.width - 52);
  assert.equal(openRight.pet.x + openRight.pet.width, right.pet.x + right.pet.width);

  const left = overlayLayout("left", 0, false, area);
  assert.equal(left.panel.x, area.x + 8);
  assert.equal(left.pet.x, left.panel.x + left.panel.width);

  const top = overlayLayout("top", 200, false, area);
  assert.equal(top.vertical, false);
  assert.equal(top.panel.y, area.y + 8);
  assert.ok(top.pet.y >= top.panel.y + top.panel.height);

  // Stale "bottom" requests normalize to right.
  const normalized = overlayLayout("bottom", 200, false, area);
  assert.equal(normalized.edge, "right");
});

test("snapOverlay preserves along-edge place and chooses the nearest edge", () => {
  const floating = { x: 900, y: 400, width: 24, height: 261 };
  const toLeft = snapOverlay(floating, { x: 130, y: 420 }, area, false);
  assert.equal(toLeft.edge, "left");
  assert.equal(toLeft.panel.x, area.x + 8);
  assert.ok(Math.abs(toLeft.panel.y - floating.y) < 40 || toLeft.offset >= 0);

  const nearBottom = snapOverlay(floating, { x: 1400, y: 920 }, area, false);
  assert.equal(nearBottom.edge, "right");
  assert.notEqual(nearBottom.edge, "bottom");
  assert.ok(nearBottom.panel.x >= area.x + 8);
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
