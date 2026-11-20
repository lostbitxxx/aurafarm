const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const finishButton = document.getElementById("finish");
const note = document.getElementById("note");
const toggle = document.getElementById("panel-toggle");
const sessionFill = document.getElementById("session-fill");
const panelPet = document.getElementById("panel-pet");
const panelPetChat = document.getElementById("panel-pet-chat");
const panelPetStack = document.getElementById("panel-pet-stack");
const panelLayerNodes = {
  floor: panelPetStack.querySelector('[data-layer="floor"]'),
  chair: panelPetStack.querySelector('[data-layer="chair"]'),
  shadow: panelPetStack.querySelector('[data-layer="shadow"]'),
  legs: panelPetStack.querySelector('[data-layer="legs"]'),
  body: panelPetStack.querySelector('[data-layer="body"]'),
  face: panelPetStack.querySelector('[data-layer="face"]'),
  desk: panelPetStack.querySelector('[data-layer="desk"]'),
  pen: panelPetStack.querySelector('[data-layer="pen"]'),
};

const EDGE_CLASSES = ["edge-left", "edge-right", "edge-top", "edge-bottom"];
let dockEdge = "right";
let panelIsOpen = false;
let dockDragging = false;
let dockMoved = false;
let activePointerId = null;
let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownFlip = false;

function isHorizontalEdge(edge) {
  return edge === "top" || edge === "bottom";
}

function applyDockEdge(edge) {
  // Bottom is not a dock target; fall back to right.
  const next = edge === "left" || edge === "right" || edge === "top" ? edge : "right";
  dockEdge = next;
  for (const name of EDGE_CLASSES) document.body.classList.toggle(name, name === `edge-${next}`);
  applyPanelOpen(panelIsOpen);
}

function applyPanelOpen(open) {
  panelIsOpen = Boolean(open);
  document.body.classList.toggle("is-open", panelIsOpen);
  toggle.setAttribute("aria-expanded", panelIsOpen ? "true" : "false");
  toggle.setAttribute("aria-label", panelIsOpen ? "Close Aurafarm" : "Open Aurafarm");
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
  const stack = plainPetStack(shownPet, shownPose);
  panelPetStack.classList.toggle("is-study", stack.stage === "study");
  setLayer(panelLayerNodes.floor, stack.floor ? base + stack.floor : null);
  setLayer(panelLayerNodes.chair, stack.chair ? base + stack.chair : null);
  setLayer(panelLayerNodes.shadow, stack.shadow ? base + stack.shadow : null);
  setLayer(panelLayerNodes.legs, base + stack.legs);
  setLayer(panelLayerNodes.body, base + stack.body);
  setLayer(panelLayerNodes.face, base + stack.face);
  setLayer(panelLayerNodes.desk, stack.desk ? base + stack.desk : null);
  setLayer(panelLayerNodes.pen, stack.pen ? base + stack.pen : null);
  panelPetStack.style.transform = shownFlip ? "scaleX(-1)" : "";
}

function applyPanelPet(state) {
  const show = state.panelPetVisible === true;
  panelPet.classList.toggle("is-visible", show);
  if (!show) {
    panelPetChat.textContent = "";
    panelPetChat.classList.remove("is-on");
    return;
  }
  applyPanelPetSprite();
  const text = typeof state.chatBubble === "string" ? state.chatBubble : "";
  const scope = state.chatBubbleScope;
  const showChat = Boolean(text) && (scope === "pet" || scope === "panel");
  panelPetChat.textContent = showChat ? text : "";
  panelPetChat.classList.toggle("is-on", showChat);
}

function applySessionFill(state) {
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

function screenPoint(event) {
  return { x: event.screenX, y: event.screenY };
}

function clearDockDrag() {
  const pointerId = activePointerId;
  activePointerId = null;
  dockDragging = false;
  dockMoved = false;
  panelPetStack.classList.remove("is-dragging");
  if (pointerId !== null && panelPetStack.hasPointerCapture?.(pointerId)) {
    try {
      panelPetStack.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be cleared.
    }
  }
}

toggle.addEventListener("click", () => {
  if (dockDragging || dockMoved) return;
  window.pet.setOpen(toggle.getAttribute("aria-expanded") !== "true");
});

// Only the pet moves the dock; the EXP rail stays open/close.
panelPetStack.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.stopPropagation();
  dockDragging = true;
  dockMoved = false;
  activePointerId = event.pointerId;
  panelPetStack.classList.add("is-dragging");
  panelPetStack.setPointerCapture?.(event.pointerId);
  const point = screenPoint(event);
  window.pet.dockDragStart(point.x, point.y);
});

panelPetStack.addEventListener("pointermove", (event) => {
  if (!dockDragging || event.pointerId !== activePointerId) return;
  dockMoved = true;
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

panelPetStack.addEventListener("pointerup", (event) => {
  finishDockPointer(event, false);
});

panelPetStack.addEventListener("pointercancel", (event) => {
  finishDockPointer(event, true);
});

panelPetStack.addEventListener("lostpointercapture", (event) => {
  if (!dockDragging) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  window.pet.dockDragCancel();
  activePointerId = null;
  dockDragging = false;
  dockMoved = false;
  panelPetStack.classList.remove("is-dragging");
});

window.addEventListener("blur", () => {
  if (!dockDragging) return;
  window.pet.dockDragCancel();
  clearDockDrag();
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
  if (typeof state.panelOpen === "boolean") applyPanelOpen(state.panelOpen);
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applySessionFill(state);
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
