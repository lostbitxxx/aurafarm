/** Dock edge math for the pet + progress-bar overlay. Pure functions for tests. */

/** Bottom is not a dock target — only left, right, and top. */
const EDGES = ["left", "right", "top"];
const EDGE_PRIORITY = { left: 0, right: 1, top: 2 };

function normalizeEdge(edge) {
  return EDGES.includes(edge) ? edge : "right";
}

const DEFAULTS = {
  inset: 8,
  /** Flush with the work-area bottom; side/top still use `inset`. */
  insetBottom: 0,
  petSize: 70,
  /** Outer capsule thickness (vertical width / horizontal height), including chrome pad. */
  barThickness: 31,
  /** Track length along the edge (exclusive of pad). Chrome length ≈ 238 (1.2× prior). */
  barLength: 232,
  /** Open content square side (matches collapsed chrome). Outer width adds barThickness. */
  panelSpan: 238,
  /** Top tall grows content thickness to panelSpan; open height adds barThickness for the rail. */
  panelLength: 238,
  /** Drag uses the whole shell; no dedicated handle or level chrome. */
  handleSize: 0,
  levelSize: 0,
  chromePad: 3,
};

function isVerticalEdge(edge) {
  return edge === "left" || edge === "right";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveConfig(options = {}) {
  if (typeof options === "number") {
    return { ...DEFAULTS, inset: options };
  }
  return { ...DEFAULTS, ...options };
}

function edgeInsets(cfg) {
  const inset = cfg.inset;
  const insetBottom = Number.isFinite(cfg.insetBottom) ? cfg.insetBottom : inset;
  return { inset, insetBottom };
}

/**
 * Nearest usable edge. Ties break by EDGE_PRIORITY so corners stay stable.
 */
function nearestEdge(x, y, area) {
  const distances = {
    left: x - area.x,
    right: area.x + area.width - x,
    top: y - area.y,
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

function collapsedChromeLength(cfg) {
  return cfg.handleSize + cfg.barLength + cfg.levelSize + cfg.chromePad * 2;
}

/**
 * @param {string} edge
 * @param {boolean | "closed" | "tall" | "open"} open
 *   closed = strip only;
 *   tall = legacy mid stage (sides match closed; top matches open height);
 *   open = content square (panelSpan) plus progress-bar thickness on the docked edge.
 *   Live open/close animates closed ↔ open in one native setBounds; tall is unused.
 */
function panelSize(edge, open, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  const maxW = Math.max(0, area.width - inset * 2);
  const maxH = Math.max(0, area.height - inset - insetBottom);
  const mode = open === true || open === "open" ? "open" : open === "tall" ? "tall" : "closed";
  const chrome = collapsedChromeLength(cfg);
  const stripHeight = Math.min(chrome, maxH);
  const contentSide = Math.min(Math.max(cfg.panelSpan, chrome), maxW, maxH);
  const bar = cfg.barThickness;
  if (isVerticalEdge(edge)) {
    if (mode === "open") {
      // Extra width matches the EXP rail so the cream body stays a content square.
      return {
        width: Math.min(contentSide + bar, maxW),
        height: contentSide,
      };
    }
    if (mode === "tall") {
      return {
        width: Math.min(bar, maxW),
        height: stripHeight,
      };
    }
    return {
      width: Math.min(bar, maxW),
      height: stripHeight,
    };
  }
  if (mode === "open") {
    return {
      width: contentSide,
      height: Math.min(contentSide + bar, maxH),
    };
  }
  if (mode === "tall") {
    // For top dock, "down" grows thickness toward the content square before widening.
    return {
      width: Math.min(chrome, maxW),
      height: Math.min(contentSide + bar, maxH),
    };
  }
  return {
    width: Math.min(chrome, maxW),
    height: Math.min(bar, maxH),
  };
}

/**
 * Clamp the along-edge offset so the panel stays inside the inset work area.
 * For left/right, offset is panel top relative to area.y + inset.
 * For top/bottom, offset is panel left relative to area.x + inset.
 */
function clampDockOffset(edge, offset, panel, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  if (isVerticalEdge(edge)) {
    const max = Math.max(0, area.height - inset - insetBottom - panel.height);
    return clamp(Math.round(offset), 0, max);
  }
  const max = Math.max(0, area.width - inset * 2 - panel.width);
  return clamp(Math.round(offset), 0, max);
}

function offsetFromPanelOrigin(edge, panelOrigin, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset } = edgeInsets(cfg);
  if (isVerticalEdge(edge)) return Math.round(panelOrigin.y - (area.y + inset));
  return Math.round(panelOrigin.x - (area.x + inset));
}

function panelOriginForDock(edge, offset, panel, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  const clamped = clampDockOffset(edge, offset, panel, area, cfg);
  if (edge === "left") {
    return { x: area.x + inset, y: area.y + inset + clamped };
  }
  if (edge === "right") {
    return { x: area.x + area.width - inset - panel.width, y: area.y + inset + clamped };
  }
  if (edge === "top") {
    return { x: area.x + inset + clamped, y: area.y + inset };
  }
  return { x: area.x + inset + clamped, y: area.y + area.height - insetBottom - panel.height };
}

/** Pet sits beside the EXP rail (barThickness), not the far edge of an open panel. */
function petOriginBesidePanel(edge, panelBounds, petSize, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  const size = Number(petSize) || 0;
  const bar = cfg.barThickness;
  let x;
  let y;
  if (edge === "right") {
    x = panelBounds.x + panelBounds.width - bar - size;
    y = panelBounds.y + panelBounds.height - size;
  } else if (edge === "left") {
    x = panelBounds.x + bar;
    y = panelBounds.y + panelBounds.height - size;
  } else if (edge === "bottom") {
    x = panelBounds.x + Math.max(0, panelBounds.width - size);
    y = panelBounds.y + panelBounds.height - bar - size;
  } else {
    x = panelBounds.x + Math.max(0, panelBounds.width - size);
    y = panelBounds.y + bar;
  }
  const maxX = area.x + Math.max(0, area.width - size);
  const maxY = area.y + Math.max(0, area.height - size);
  return {
    x: clamp(Math.round(x), area.x + inset, Math.max(area.x + inset, maxX - inset)),
    y: clamp(Math.round(y), area.y + inset, Math.max(area.y + inset, maxY - insetBottom)),
  };
}

/**
 * Full overlay placement for a docked edge + along-edge offset.
 */
/**
 * @param {boolean | "closed" | "tall" | "open"} open
 */
function overlayLayout(edge, offset, open, area, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  const dockEdge = normalizeEdge(edge);
  const size = panelSize(dockEdge, open, area, cfg);
  const clampedOffset = clampDockOffset(dockEdge, offset, size, area, cfg);
  const origin = panelOriginForDock(dockEdge, clampedOffset, size, area, cfg);
  const panel = { ...origin, ...size };
  const pet = {
    ...petOriginBesidePanel(dockEdge, panel, cfg.petSize, area, cfg),
    width: cfg.petSize,
    height: Math.min(cfg.petSize, Math.max(0, area.height - inset - insetBottom)),
  };
  return {
    edge: dockEdge,
    offset: clampedOffset,
    vertical: isVerticalEdge(dockEdge),
    panel,
    pet,
  };
}

/**
 * Snap a free-floating panel rect to the nearest edge, keeping along-edge place.
 */
function snapOverlay(panelBounds, pointer, area, open, options = {}) {
  const cfg = resolveConfig(options);
  const { inset, insetBottom } = edgeInsets(cfg);
  const x = Number.isFinite(pointer?.x) ? pointer.x : panelBounds.x + panelBounds.width / 2;
  const y = Number.isFinite(pointer?.y) ? pointer.y : panelBounds.y + panelBounds.height / 2;
  const edge = nearestEdge(x, y, area);
  const size = panelSize(edge, open, area, cfg);
  let guessOrigin;
  if (isVerticalEdge(edge)) {
    guessOrigin = {
      x: edge === "left" ? area.x + inset : area.x + area.width - inset - size.width,
      y: Math.round(panelBounds.y),
    };
  } else {
    guessOrigin = {
      x: Math.round(panelBounds.x),
      y: edge === "top" ? area.y + inset : area.y + area.height - insetBottom - size.height,
    };
  }
  const offset = offsetFromPanelOrigin(edge, guessOrigin, area, cfg);
  return overlayLayout(edge, offset, open, area, cfg);
}

module.exports = {
  DEFAULTS,
  EDGES,
  clampDockOffset,
  collapsedChromeLength,
  isVerticalEdge,
  nearestEdge,
  normalizeEdge,
  offsetFromPanelOrigin,
  overlayLayout,
  panelOriginForDock,
  panelSize,
  petOriginBesidePanel,
  snapOverlay,
};
