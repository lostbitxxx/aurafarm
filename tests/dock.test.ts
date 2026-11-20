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
  assert.equal(closedRight.width, 31);
  assert.equal(closedRight.height, 238);
  const tallRight = panelSize("right", "tall", area);
  assert.equal(tallRight.width, 31);
  assert.equal(tallRight.height, closedRight.height);
  const openRight = panelSize("right", true, area);
  assert.equal(openRight.width, 269);
  assert.equal(openRight.height, 238);
  const closedTop = panelSize("top", false, area);
  assert.equal(closedTop.height, 31);
  assert.equal(closedTop.width, 238);
  const openTop = panelSize("top", true, area);
  assert.equal(openTop.width, 238);
  assert.equal(openTop.height, 269);
});

test("overlayLayout keeps the docked group inside the inset work area", () => {
  const right = overlayLayout("right", Number.MAX_SAFE_INTEGER, false, area);
  assert.equal(right.edge, "right");
  assert.equal(right.vertical, true);
  assert.equal(right.panel.x + right.panel.width, area.x + area.width - 8);
  // Bottom is flush (insetBottom: 0); sides/top keep inset.
  assert.equal(right.panel.y + right.panel.height, area.y + area.height);
  // Closed: pet sits beside the EXP rail (open bar hosts the pet inside the shell instead).
  assert.equal(right.pet.x + right.pet.width, right.panel.x);
  assert.ok(right.pet.y >= area.y + 8);
  assert.equal(right.pet.y + right.pet.height, area.y + area.height);

  const openRight = overlayLayout("right", Number.MAX_SAFE_INTEGER, true, area);
  assert.equal(openRight.pet.x + openRight.pet.width, openRight.panel.x + openRight.panel.width - 31);
  assert.equal(openRight.panel.height, 238);
  assert.equal(openRight.panel.width, 269);

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

test("chat clearance keeps the wide bubble off the collapsed session rail", () => {
  const chat = { chatWidth: 168, chatPad: 64, chatGap: 8 };
  const right = overlayLayout("right", Number.MAX_SAFE_INTEGER, false, area, chat);
  const sideClear = (168 - 70) / 2 + 8;
  assert.equal(right.pet.x + right.pet.width + sideClear, right.panel.x);
  const left = overlayLayout("left", 0, false, area, chat);
  assert.equal(left.pet.x, left.panel.x + left.panel.width + sideClear);
  const top = overlayLayout("top", 200, false, area, chat);
  assert.equal(top.pet.y, top.panel.y + top.panel.height + 64 + 8);
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
