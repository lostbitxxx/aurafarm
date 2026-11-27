const petStack = document.getElementById("pet-stack");
const petChat = document.getElementById("pet-chat");
const petBoom = document.getElementById("pet-boom");
const layerNodes = {
  floor: petStack.querySelector('[data-layer="floor"]'),
  chair: petStack.querySelector('[data-layer="chair"]'),
  shadow: petStack.querySelector('[data-layer="shadow"]'),
  legs: petStack.querySelector('[data-layer="legs"]'),
  body: petStack.querySelector('[data-layer="body"]'),
  clothes: petStack.querySelector('[data-layer="clothes"]'),
  face: petStack.querySelector('[data-layer="face"]'),
  hat: petStack.querySelector('[data-layer="hat"]'),
  desk: petStack.querySelector('[data-layer="desk"]'),
  pen: petStack.querySelector('[data-layer="pen"]'),
};

let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownColor = null;
let shownHat = null;
let shownClothes = null;
let shownFlip = false;
let dockDragging = false;
let activePointerId = null;
/** True while the overlay accepts mouse hits for dragging. */
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
  const stack = plainPetStack(shownPet, shownPose, {
    color: shownColor,
    hat: shownHat,
    clothes: shownClothes,
  });
  petStack.classList.toggle("is-study", stack.stage === "study");
  setLayer(layerNodes.floor, stack.floor ? base + stack.floor : null);
  setLayer(layerNodes.chair, stack.chair ? base + stack.chair : null);
  setLayer(layerNodes.shadow, stack.shadow ? base + stack.shadow : null);
  setLayer(layerNodes.legs, base + stack.legs);
  setLayer(layerNodes.body, base + stack.body);
  setLayer(layerNodes.clothes, stack.clothes ? base + stack.clothes : null);
  setLayer(layerNodes.face, base + stack.face);
  setLayer(layerNodes.hat, stack.hat ? base + stack.hat : null);
  if (layerNodes.hat) layerNodes.hat.classList.toggle("is-head", stack.hatPlacement === "head");
  setLayer(layerNodes.desk, stack.desk ? base + stack.desk : null);
  setLayer(layerNodes.pen, stack.pen ? base + stack.pen : null);
  applyPetFlightTransform();
}

let flightAngle = 0;
let flightScaleX = 1;
let flightActive = false;
let boomPlaying = false;

function applyPetFlightTransform() {
  if (!petStack) return;
  if (flightActive) {
    const sx = flightScaleX < 0 ? -1 : 1;
    const flip = shownFlip ? -sx : sx;
    petStack.style.transform = `scaleX(${flip}) rotate(${flightAngle}deg)`;
    return;
  }
  petStack.style.transform = shownFlip ? "scaleX(-1)" : "";
}

function applyFlightFx(state) {
  flightActive = state.flightActive === true;
  flightAngle = Number.isFinite(Number(state.flightAngle)) ? Number(state.flightAngle) : 0;
  flightScaleX = Number(state.flightScaleX) < 0 ? -1 : 1;
  document.body.classList.toggle("is-flight", flightActive);
  const boom = state.flightBoom === true;
  document.body.classList.toggle("is-boom", boom);
  if (petBoom) {
    const base = String(assetOrigin || "").replace(/\/$/, "");
    const src = base ? `${base}/pet-assets/fx/boom.gif` : "";
    if (boom && src && !boomPlaying) {
      // Start once. Later state pushes must not reload it (that would loop).
      boomPlaying = true;
      petBoom.src = `${src}?t=${Date.now()}`;
    } else if (!boom) {
      boomPlaying = false;
      petBoom.removeAttribute("src");
    }
  }
  applyPetFlightTransform();
}

function applyChatBubble(state) {
  if (!petChat) return;
  const scope = state.chatBubbleScope;
  const text = typeof state.chatBubble === "string" ? state.chatBubble : "";
  replayChatBubble(petChat, text, Boolean(text) && scope === "pet");
}

function screenPoint(event) {
  return { x: event.screenX, y: event.screenY };
}

function setPetMouseIgnore(ignore) {
  mouseCaptured = !ignore;
  window.pet.setIgnoreMouse?.(ignore);
}

function overPetHit(event) {
  const x = event.clientX;
  const y = event.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const rect = petStack.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Capture mouse only over the sprite so the transparent pad stays click-through. */
function syncPetMouseTarget(event) {
  if (dockDragging) return;
  const over = overPetHit(event);
  if (over) {
    if (!mouseCaptured) setPetMouseIgnore(false);
    return;
  }
  if (mouseCaptured) setPetMouseIgnore(true);
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
  if (petStack.matches?.(":hover")) {
    setPetMouseIgnore(false);
    return;
  }
  setPetMouseIgnore(true);
}

document.addEventListener("mousemove", syncPetMouseTarget, { passive: true });
window.addEventListener("mouseleave", () => {
  if (dockDragging) return;
  setPetMouseIgnore(true);
});

petStack.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  setPetMouseIgnore(false);
  dockDragging = true;
  activePointerId = event.pointerId;
  petStack.classList.add("is-dragging");
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
  shownColor = typeof state.petColor === "string" ? state.petColor : null;
  shownHat = typeof state.petHat === "string" ? state.petHat : null;
  shownClothes = typeof state.petClothes === "string" ? state.petClothes : null;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applyFlightFx(state);
  applyPetSprite();
  applyChatBubble(state);
});
