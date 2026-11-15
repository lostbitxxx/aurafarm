/** Dock edge math for the pet + progress-bar overlay. Pure functions for tests. */

const EDGES = ["left", "right", "top", "bottom"];
const EDGE_PRIORITY = { left: 0, right: 1, top: 2, bottom: 3 };

const DEFAULTS = {
  inset: 4,
  petSize: 70,
  barThickness: 24,
  barLength: 239,
  panelSpan: 320,
  panelLength: 275,
  handleSize: 22,
};

function isVerticalEdge(edge) {
  return edge === "left" || edge === "right";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Nearest usable edge. Ties break by EDGE_PRIORITY so corners stay stable.
 */
function nearestEdge(x, y, area) {
  const distances = {
    left: x - area.x,
    right: area.x + area.width - x,
    top: y - area.y,
    bottom: area.y + area.height - y,
  };
  let best = "left";
  let bestDistance = distances.left;
  for (const edge of EDGES) {
    const distance = distances[edge];
    if (distance < bestDistance - 0.5) {
      best = edge;
      bestDistance = distance;
      continue;
    }
    if (Math.abs(distance - bestDistance) <= 0.5 && EDGE_PRIORITY[edge] < EDGE_PRIORITY[best]) {
      best = edge;
      bestDistance = distance;
    }
  }
  return best;
}

function panelSize(edge, open, area, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const inset = cfg.inset;
  const maxW = Math.max(0, area.width - inset * 2);
  const maxH = Math.max(0, area.height - inset * 2);
  if (isVerticalEdge(edge)) {
    if (open) {
      return {
        width: Math.min(cfg.panelSpan, maxW),
        height: Math.min(cfg.panelLength, maxH),
      };
    }
    const height = Math.min(cfg.handleSize + cfg.barLength, maxH);
    return { width: Math.min(cfg.barThickness, maxW), height };
  }
  if (open) {
    return {
      width: Math.min(cfg.panelSpan, maxW),
      height: Math.min(cfg.panelLength, maxH),
    };
  }
  const width = Math.min(cfg.handleSize + cfg.barLength, maxW);
  return { width, height: Math.min(cfg.barThickness, maxH) };
}

/**
 * Clamp the along-edge offset so the panel stays inside the inset work area.
 * For left/right, offset is panel top relative to area.y + inset.
 * For top/bottom, offset is panel left relative to area.x + inset.
 */
function clampDockOffset(edge, offset, panel, area, inset = DEFAULTS.inset) {
  if (isVerticalEdge(edge)) {
    const max = Math.max(0, area.height - inset * 2 - panel.height);
    return clamp(Math.round(offset), 0, max);
  }
  const max = Math.max(0, area.width - inset * 2 - panel.width);
  return clamp(Math.round(offset), 0, max);
}

function offsetFromPanelOrigin(edge, panelOrigin, area, inset = DEFAULTS.inset) {
  if (isVerticalEdge(edge)) return Math.round(panelOrigin.y - (area.y + inset));
  return Math.round(panelOrigin.x - (area.x + inset));
}

function panelOriginForDock(edge, offset, panel, area, inset = DEFAULTS.inset) {
  const clamped = clampDockOffset(edge, offset, panel, area, inset);
  if (edge === "left") {
    return { x: area.x + inset, y: area.y + inset + clamped };
  }
  if (edge === "right") {
    return { x: area.x + area.width - inset - panel.width, y: area.y + inset + clamped };
  }
  if (edge === "top") {
    return { x: area.x + inset + clamped, y: area.y + inset };
  }
  return { x: area.x + inset + clamped, y: area.y + area.height - inset - panel.height };
}

function petOriginBesidePanel(edge, panelBounds, petSize, area, inset = DEFAULTS.inset) {
  const size = Number(petSize) || 0;
  let x;
  let y;
  if (edge === "right") {
    x = panelBounds.x - size;
    y = panelBounds.y + panelBounds.height - size;
  } else if (edge === "left") {
    x = panelBounds.x + panelBounds.width;
    y = panelBounds.y + panelBounds.height - size;
  } else if (edge === "bottom") {
    x = panelBounds.x + Math.max(0, panelBounds.width - size);
    y = panelBounds.y - size;
  } else {
    x = panelBounds.x + Math.max(0, panelBounds.width - size);
    y = panelBounds.y + panelBounds.height;
  }
  const maxX = area.x + Math.max(0, area.width - size);
  const maxY = area.y + Math.max(0, area.height - size);
  return {
    x: clamp(Math.round(x), area.x + inset, Math.max(area.x + inset, maxX - inset)),
    y: clamp(Math.round(y), area.y + inset, Math.max(area.y + inset, maxY - inset)),
  };
}

/**
 * Full overlay placement for a docked edge + along-edge offset.
 */
function overlayLayout(edge, offset, open, area, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const size = panelSize(edge, open, area, cfg);
  const clampedOffset = clampDockOffset(edge, offset, size, area, cfg.inset);
  const origin = panelOriginForDock(edge, clampedOffset, size, area, cfg.inset);
  const panel = { ...origin, ...size };
  const pet = {
    ...petOriginBesidePanel(edge, panel, cfg.petSize, area, cfg.inset),
    width: cfg.petSize,
    height: Math.min(cfg.petSize, Math.max(0, area.height - cfg.inset * 2)),
  };
  return {
    edge,
    offset: clampedOffset,
    vertical: isVerticalEdge(edge),
    panel,
    pet,
  };
}

/**
 * Snap a free-floating panel rect to the nearest edge, keeping along-edge place.
 */
function snapOverlay(panelBounds, pointer, area, open, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const x = Number.isFinite(pointer?.x) ? pointer.x : panelBounds.x + panelBounds.width / 2;
  const y = Number.isFinite(pointer?.y) ? pointer.y : panelBounds.y + panelBounds.height / 2;
  const edge = nearestEdge(x, y, area);
  const size = panelSize(edge, open, area, cfg);
  let guessOrigin;
  if (isVerticalEdge(edge)) {
    guessOrigin = {
      x: edge === "left" ? area.x + cfg.inset : area.x + area.width - cfg.inset - size.width,
      y: Math.round(panelBounds.y),
    };
  } else {
    guessOrigin = {
      x: Math.round(panelBounds.x),
      y: edge === "top" ? area.y + cfg.inset : area.y + area.height - cfg.inset - size.height,
    };
  }
  const offset = offsetFromPanelOrigin(edge, guessOrigin, area, cfg.inset);
  return overlayLayout(edge, offset, open, area, cfg);
}

module.exports = {
  DEFAULTS,
  EDGES,
  clampDockOffset,
  isVerticalEdge,
  nearestEdge,
  offsetFromPanelOrigin,
  overlayLayout,
  panelOriginForDock,
  panelSize,
  petOriginBesidePanel,
  snapOverlay,
};
