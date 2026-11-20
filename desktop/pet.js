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
  window.pet.setIgnoreMouse?.(ignore);
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
  setPetMouseIgnore(true);
}

petStack.addEventListener("mouseenter", () => {
  setPetMouseIgnore(false);
});

petStack.addEventListener("mouseleave", () => {
  if (!dockDragging) setPetMouseIgnore(true);
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
  activePointerId = null;
  dockDragging = false;
  petStack.classList.remove("is-dragging");
  setPetMouseIgnore(true);
});

window.addEventListener("blur", () => {
  if (!dockDragging) return;
  window.pet.dockDragCancel();
  clearDockDrag();
});

window.pet.onState((state) => {
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applyPetSprite();
  applyChatBubble(state);
});
