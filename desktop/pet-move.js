/** Places the pet on the front browser's tab strip, just right of the traffic lights. */

const TAB_STRIP_X = 6;
const TAB_STRIP_Y = 18;

function parseWindowBounds(value) {
  const nums = String(value ?? "").match(/-?\d+/g);
  if (!nums || nums.length < 4) return null;
  const [left, top, right, bottom] = nums.slice(0, 4).map(Number);
  const width = right - left;
  const height = bottom - top;
  if (![left, top, right, bottom].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

function petOriginForTabStrip(windowBounds, petSize) {
  const size = Number(petSize) || 0;
  return {
    x: Math.round(Number(windowBounds.x) + TAB_STRIP_X),
    y: Math.round(Number(windowBounds.y) + TAB_STRIP_Y - size / 2),
  };
}

function clampPetOrigin(origin, petSize, area) {
  const size = Number(petSize) || 0;
  const maxX = area.x + Math.max(0, area.width - size);
  const maxY = area.y + Math.max(0, area.height - size);
  return {
    x: Math.min(maxX, Math.max(area.x, Math.round(origin.x))),
    y: Math.min(maxY, Math.max(area.y, Math.round(origin.y))),
  };
}

module.exports = {
  TAB_STRIP_X,
  TAB_STRIP_Y,
  clampPetOrigin,
  parseWindowBounds,
  petOriginForTabStrip,
};
