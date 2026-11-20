const petStack = document.getElementById("pet-stack");
const petChat = document.getElementById("pet-chat");
const layerNodes = {
  floor: petStack.querySelector('[data-layer="floor"]'),
  chair: petStack.querySelector('[data-layer="chair"]'),
  shadow: petStack.querySelector('[data-layer="shadow"]'),
  legs: petStack.querySelector('[data-layer="legs"]'),
  body: petStack.querySelector('[data-layer="body"]'),
  face: petStack.querySelector('[data-layer="face"]'),
  desk: petStack.querySelector('[data-layer="desk"]'),
  pen: petStack.querySelector('[data-layer="pen"]'),
};

let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownFlip = false;
let dockDragging = false;
let activePointerId = null;
/** True while the overlay accepts mouse hits so CSS cursors can paint. */
let mouseCaptured = false;

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

function applyPetSprite() {
  const base = String(assetOrigin || "").replace(/\/$/, "");
  if (!base) return;
  const stack = plainPetStack(shownPet, shownPose);
  petStack.classList.toggle("is-study", stack.stage === "study");
  setLayer(layerNodes.floor, stack.floor ? base + stack.floor : null);
  setLayer(layerNodes.chair, stack.chair ? base + stack.chair : null);
  setLayer(layerNodes.shadow, stack.shadow ? base + stack.shadow : null);
  setLayer(layerNodes.legs, base + stack.legs);
  setLayer(layerNodes.body, base + stack.body);
  setLayer(layerNodes.face, base + stack.face);
  setLayer(layerNodes.desk, stack.desk ? base + stack.desk : null);
  setLayer(layerNodes.pen, stack.pen ? base + stack.pen : null);
  petStack.style.transform = shownFlip ? "scaleX(-1)" : "";
}

function applyChatBubble(state) {
  if (!petChat) return;
  const scope = state.chatBubbleScope;
  const text = typeof state.chatBubble === "string" ? state.chatBubble : "";
  const show = Boolean(text) && scope === "pet";
  petChat.textContent = show ? text : "";
  petChat.classList.toggle("is-on", show);
}

function screenPoint(event) {
  return { x: event.screenX, y: event.screenY };
}

function setPetMouseIgnore(ignore) {
  mouseCaptured = !ignore;
  window.pet.setIgnoreMouse?.(ignore);
}

function setHoverCursor(kind) {
  const value = kind || "";
  document.documentElement.style.cursor = value;
  document.body.style.cursor = value;
  petStack.style.cursor = value || "";
}

function overPetHit(event) {
  const x = event.clientX;
  const y = event.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const node = document.elementFromPoint(x, y);
  return Boolean(node && (node === petStack || petStack.contains(node)));
}

/**
 * Transparent click-through windows do not deliver reliable mouseenter while
 * ignoreMouseEvents(forward) is on. Track mousemove and only capture the mouse
 * (so CSS pointer can show) when the cursor is over the sprite.
 */
function syncPetMouseTarget(event) {
  if (dockDragging) return;
  const over = overPetHit(event);
  if (over) {
    if (!mouseCaptured) setPetMouseIgnore(false);
    setHoverCursor("pointer");
    return;
  }
  if (mouseCaptured) {
    setHoverCursor("");
    setPetMouseIgnore(true);
  }
}

function clearDockDrag() {
  const pointerId = activePointerId;
  activePointerId = null;
  dockDragging = false;
  petStack.classList.remove("is-dragging");
  if (pointerId !== null && petStack.hasPointerCapture?.(pointerId)) {
    try {
      petStack.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be cleared.
    }
  }
  // Stay clickable if the pointer is still over the pet after a drag.
  if (petStack.matches?.(":hover")) {
    setHoverCursor("pointer");
    setPetMouseIgnore(false);
    return;
  }
  setHoverCursor("");
  setPetMouseIgnore(true);
}

window.addEventListener("mousemove", syncPetMouseTarget, { passive: true });
window.addEventListener("mouseleave", () => {
  if (dockDragging) return;
  setHoverCursor("");
  setPetMouseIgnore(true);
});

petStack.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  setPetMouseIgnore(false);
  dockDragging = true;
  activePointerId = event.pointerId;
  petStack.classList.add("is-dragging");
  setHoverCursor("grabbing");
  petStack.setPointerCapture?.(event.pointerId);
  const point = screenPoint(event);
  window.pet.dockDragStart(point.x, point.y);
});

petStack.addEventListener("pointermove", (event) => {
  if (!dockDragging || event.pointerId !== activePointerId) return;
  const point = screenPoint(event);
  window.pet.dockDragMove(point.x, point.y);
});

function finishDockPointer(event, cancelled) {
  if (!dockDragging || (activePointerId !== null && event.pointerId !== activePointerId)) return;
  const point = screenPoint(event);
  if (cancelled) window.pet.dockDragCancel();
  else window.pet.dockDragEnd(point.x, point.y);
  clearDockDrag();
}

petStack.addEventListener("pointerup", (event) => {
  finishDockPointer(event, false);
});

petStack.addEventListener("pointercancel", (event) => {
  finishDockPointer(event, true);
});

petStack.addEventListener("lostpointercapture", (event) => {
  if (!dockDragging) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  window.pet.dockDragCancel();
  clearDockDrag();
});

window.addEventListener("blur", () => {
  if (!dockDragging) return;
  window.pet.dockDragCancel();
  clearDockDrag();
});

const EDGE_CLASSES = ["edge-left", "edge-right", "edge-top", "edge-bottom"];

function applyDockEdge(edge) {
  const next = edge === "left" || edge === "right" || edge === "top" ? edge : "right";
  for (const name of EDGE_CLASSES) {
    document.body.classList.toggle(name, name === `edge-${next}`);
  }
}

applyDockEdge("right");

window.pet.onState((state) => {
  if (typeof state.dockEdge === "string") applyDockEdge(state.dockEdge);
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applyPetSprite();
  applyChatBubble(state);
});
