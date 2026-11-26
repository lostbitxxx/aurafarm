const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const finishButton = document.getElementById("finish");
const note = document.getElementById("note");
const dockRail = document.getElementById("dock-rail");
const toggle = document.getElementById("panel-toggle");
const sessionFill = document.getElementById("session-fill");
const sessionClock = document.getElementById("session-clock");
const panelPet = document.getElementById("panel-pet");
const panelPetChat = document.getElementById("panel-pet-chat");
const panelPetStack = document.getElementById("panel-pet-stack");
const panelLayerNodes = {
  floor: panelPetStack.querySelector('[data-layer="floor"]'),
  chair: panelPetStack.querySelector('[data-layer="chair"]'),
  shadow: panelPetStack.querySelector('[data-layer="shadow"]'),
  legs: panelPetStack.querySelector('[data-layer="legs"]'),
  body: panelPetStack.querySelector('[data-layer="body"]'),
  clothes: panelPetStack.querySelector('[data-layer="clothes"]'),
  face: panelPetStack.querySelector('[data-layer="face"]'),
  hat: panelPetStack.querySelector('[data-layer="hat"]'),
  desk: panelPetStack.querySelector('[data-layer="desk"]'),
  pen: panelPetStack.querySelector('[data-layer="pen"]'),
};

const EDGE_CLASSES = ["edge-left", "edge-right", "edge-top", "edge-bottom"];
/** Screen px before a rail press counts as a drag instead of a click. */
const DOCK_DRAG_THRESHOLD_PX = 7;
/** Delay before leaving the open panel auto-collapses it. */
const LEAVE_CLOSE_MS = 450;

let dockEdge = "right";
let mouseIgnored = false;
/** @type {null | { x: number, y: number }} */
let lastPointer = null;
let panelIsOpen = false;
let dockDragging = false;
let dockMoved = false;
let activePointerId = null;
/** @type {null | { x: number, y: number }} */
let pendingDragOrigin = null;
let leaveCloseTimer = null;
let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownColor = null;
let shownHat = null;
let shownClothes = null;
let shownFlip = false;

function isHorizontalEdge(edge) {
  return edge === "top" || edge === "bottom";
}

function setHitTestIgnored(ignore) {
  const next = Boolean(ignore);
  if (next === mouseIgnored) return;
  mouseIgnored = next;
  window.pet.setIgnoreMouse(next);
}

function railContains(x, y) {
  const rect = dockRail.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Right dock stays at the open window size, so clicks miss the empty area beside the bar. */
function syncHitTarget(clientX, clientY) {
  if (dockEdge !== "right" || panelIsOpen || dockDragging) {
    setHitTestIgnored(false);
    return;
  }
  const x = Number.isFinite(clientX) ? clientX : lastPointer?.x;
  const y = Number.isFinite(clientY) ? clientY : lastPointer?.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    setHitTestIgnored(true);
    return;
  }
  setHitTestIgnored(!railContains(x, y));
}

window.addEventListener("pointermove", (event) => {
  lastPointer = { x: event.clientX, y: event.clientY };
  syncHitTarget(event.clientX, event.clientY);
});

function applyDockEdge(edge) {
  // Bottom is not a dock target; fall back to right.
  const next = edge === "left" || edge === "right" || edge === "top" ? edge : "right";
  dockEdge = next;
  for (const name of EDGE_CLASSES) document.body.classList.toggle(name, name === `edge-${next}`);
  applyPanelOpen(
    panelIsOpen,
    document.body.classList.contains("is-frame-open"),
    document.body.classList.contains("is-bounds-open"),
  );
}

function applyPanelOpen(open, frameOpen = open, boundsOpen = frameOpen) {
  panelIsOpen = Boolean(open);
  const frame = Boolean(frameOpen) || panelIsOpen;
  const bounds = Boolean(boundsOpen) || panelIsOpen;
  document.body.classList.toggle("is-open", panelIsOpen);
  document.body.classList.toggle("is-frame-open", frame);
  document.body.classList.toggle("is-bounds-open", bounds);
  toggle.setAttribute("aria-expanded", panelIsOpen ? "true" : "false");
  toggle.setAttribute("aria-label", panelIsOpen ? "Close Aurafarm" : "Open Aurafarm");
  if (!panelIsOpen) clearLeaveClose();
  syncHitTarget();
}

function setLayer(node, src) {
  if (!node) return;
  if (!src) {
    node.hidden = true;
    node.removeAttribute("src");
    return;
  }
  if (node.getAttribute("src") !== src) node.src = src;
  node.hidden = false;
}

function applyPanelPetSprite() {
  const base = String(assetOrigin || "").replace(/\/$/, "");
  if (!base || typeof plainPetStack !== "function") return;
  const stack = plainPetStack(shownPet, shownPose, {
    color: shownColor,
    hat: shownHat,
    clothes: shownClothes,
  });
  panelPetStack.classList.toggle("is-study", stack.stage === "study");
  setLayer(panelLayerNodes.floor, stack.floor ? base + stack.floor : null);
  setLayer(panelLayerNodes.chair, stack.chair ? base + stack.chair : null);
  setLayer(panelLayerNodes.shadow, stack.shadow ? base + stack.shadow : null);
  setLayer(panelLayerNodes.legs, base + stack.legs);
  setLayer(panelLayerNodes.body, base + stack.body);
  setLayer(panelLayerNodes.clothes, stack.clothes ? base + stack.clothes : null);
  setLayer(panelLayerNodes.face, base + stack.face);
  setLayer(panelLayerNodes.hat, stack.hat ? base + stack.hat : null);
  if (panelLayerNodes.hat) {
    panelLayerNodes.hat.classList.toggle("is-head", stack.hatPlacement === "head");
  }
  setLayer(panelLayerNodes.desk, stack.desk ? base + stack.desk : null);
  setLayer(panelLayerNodes.pen, stack.pen ? base + stack.pen : null);
  panelPetStack.style.transform = shownFlip ? "scaleX(-1)" : "";
}

function applyPanelPet(state) {
  const show = state.panelPetVisible === true;
  panelPet.classList.toggle("is-visible", show);
  if (!show) {
    replayChatBubble(panelPetChat, "", false);
    return;
  }
  applyPanelPetSprite();
  const text = typeof state.chatBubble === "string" ? state.chatBubble : "";
  const scope = state.chatBubbleScope;
  replayChatBubble(panelPetChat, text, Boolean(text) && (scope === "pet" || scope === "panel"));
}

function applySessionFill(state) {
  const kind = typeof sessionDayKind === "function" ? sessionDayKind(state) : "unset";
  const colors =
    typeof sessionRailColors === "function"
      ? sessionRailColors(kind)
      : { liquid: "#5fbf4a", track: "transparent" };
  document.body.classList.toggle("is-study-day", kind === "study");
  document.body.classList.toggle("is-rest-day", kind === "rest");
  sessionFill.style.background = colors.liquid;
  const rail = document.getElementById("dock-rail");
  if (rail) rail.style.background = colors.track;
  const raw = Number(state.sessionProgress);
  const pct =
    Number.isFinite(raw) && raw > 0
      ? `${Math.max(0, Math.min(100, Math.round(raw * 100)))}%`
      : "0%";
  if (isHorizontalEdge(dockEdge)) {
    sessionFill.style.width = pct;
    sessionFill.style.height = "100%";
    sessionFill.style.left = "0";
    sessionFill.style.right = "auto";
    sessionFill.style.top = "0";
    sessionFill.style.bottom = "0";
  } else {
    sessionFill.style.height = pct;
    sessionFill.style.width = "auto";
    sessionFill.style.left = "0";
    sessionFill.style.right = "0";
    sessionFill.style.bottom = "0";
    sessionFill.style.top = "auto";
  }
}

function applySessionClock(state) {
  if (!sessionClock) return;
  const text = typeof state.sessionClock === "string" ? state.sessionClock.trim() : "";
  sessionClock.textContent = text;
  sessionClock.hidden = !text;
}

function screenPoint(event) {
  return { x: event.screenX, y: event.screenY };
}

function clearLeaveClose() {
  if (!leaveCloseTimer) return;
  clearTimeout(leaveCloseTimer);
  leaveCloseTimer = null;
}

function armLeaveClose() {
  clearLeaveClose();
  if (!panelIsOpen || dockDragging || pendingDragOrigin) return;
  leaveCloseTimer = setTimeout(() => {
    leaveCloseTimer = null;
    if (!panelIsOpen || dockDragging) return;
    window.pet.setOpen(false);
  }, LEAVE_CLOSE_MS);
}

function clearDockDrag() {
  const pointerId = activePointerId;
  activePointerId = null;
  pendingDragOrigin = null;
  dockDragging = false;
  dockMoved = false;
  dockRail.classList.remove("is-dragging");
  if (pointerId !== null && toggle.hasPointerCapture?.(pointerId)) {
    try {
      toggle.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be cleared.
    }
  }
}

function togglePanelOpen() {
  window.pet.setOpen(toggle.getAttribute("aria-expanded") !== "true");
}

// Slim rail only: click toggles; movement past threshold starts a dock drag.
toggle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  clearLeaveClose();
  pendingDragOrigin = screenPoint(event);
  dockDragging = false;
  dockMoved = false;
  activePointerId = event.pointerId;
  toggle.setPointerCapture?.(event.pointerId);
});

toggle.addEventListener("pointermove", (event) => {
  if (activePointerId !== event.pointerId || !pendingDragOrigin) return;
  const point = screenPoint(event);
  const dist = Math.hypot(point.x - pendingDragOrigin.x, point.y - pendingDragOrigin.y);
  if (!dockMoved && dist < DOCK_DRAG_THRESHOLD_PX) return;
  if (!dockDragging) {
    dockDragging = true;
    dockMoved = true;
    dockRail.classList.add("is-dragging");
    window.pet.dockDragStart(pendingDragOrigin.x, pendingDragOrigin.y);
  }
  window.pet.dockDragMove(point.x, point.y);
});

function finishRailPointer(event, cancelled) {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  if (!pendingDragOrigin && !dockDragging) return;
  const point = screenPoint(event);
  if (dockDragging) {
    if (cancelled) window.pet.dockDragCancel();
    else window.pet.dockDragEnd(point.x, point.y);
    clearDockDrag();
    return;
  }
  // Under-threshold press = click toggle open/close.
  clearDockDrag();
  if (!cancelled) togglePanelOpen();
}

toggle.addEventListener("pointerup", (event) => {
  finishRailPointer(event, false);
});

toggle.addEventListener("pointercancel", (event) => {
  finishRailPointer(event, true);
});

toggle.addEventListener("lostpointercapture", (event) => {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  if (!pendingDragOrigin && !dockDragging) return;
  if (dockDragging) window.pet.dockDragCancel();
  clearDockDrag();
});

window.addEventListener("blur", () => {
  if (dockDragging) window.pet.dockDragCancel();
  clearDockDrag();
  clearLeaveClose();
});

document.addEventListener("mouseleave", () => {
  if (panelIsOpen) armLeaveClose();
});

document.addEventListener("mouseenter", () => {
  clearLeaveClose();
});

document.getElementById("update-button").addEventListener("click", () => {
  window.pet.openUpdate();
});

document.getElementById("quit").addEventListener("click", () => {
  window.pet.quit();
});

finishButton.addEventListener("click", () => {
  window.pet.finish();
});

const STATUS_MIN_PX = 7;

function fitStatusLine() {
  if (!status || !status.textContent) return;
  status.style.fontSize = "";
  const base = parseFloat(getComputedStyle(status).fontSize) || 11;
  let size = base;
  status.style.fontSize = `${size}px`;
  // Shrink until the Watching line fits on one row.
  while (size > STATUS_MIN_PX && status.scrollWidth > status.clientWidth + 0.5) {
    size -= 0.5;
    status.style.fontSize = `${size}px`;
  }
}

function scheduleFitStatusLine() {
  requestAnimationFrame(() => {
    requestAnimationFrame(fitStatusLine);
  });
}

if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => fitStatusLine()).observe(status);
}

applyDockEdge("right");

window.pet.onState((state) => {
  if (typeof state.dockEdge === "string") applyDockEdge(state.dockEdge);
  if (typeof state.panelOpen === "boolean" || typeof state.panelFrameOpen === "boolean") {
    applyPanelOpen(
      typeof state.panelOpen === "boolean" ? state.panelOpen : panelIsOpen,
      typeof state.panelFrameOpen === "boolean" ? state.panelFrameOpen : state.panelOpen,
      typeof state.panelBoundsOpen === "boolean" ? state.panelBoundsOpen : state.panelFrameOpen,
    );
  }
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  shownColor = typeof state.petColor === "string" ? state.petColor : null;
  shownHat = typeof state.petHat === "string" ? state.petHat : null;
  shownClothes = typeof state.petClothes === "string" ? state.petClothes : null;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applySessionFill(state);
  applySessionClock(state);
  applyPanelPet(state);
  if (state.status) status.textContent = state.status;
  finishButton.hidden = !state.finishLabel;
  finishButton.textContent = state.finishLabel || "Finish session :)";
  note.textContent = state.finishNote || "";
  if (state.updateUrl) {
    update.hidden = false;
    updateLabel.textContent = state.updateLabel || "A newer pet is available.";
  } else {
    update.hidden = true;
  }
  scheduleFitStatusLine();
});