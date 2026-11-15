const status = document.getElementById("status");
const timer = document.getElementById("timer");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const finishButton = document.getElementById("finish");
const note = document.getElementById("note");
const bubble = document.getElementById("bubble");
const toggle = document.getElementById("panel-toggle");
const expFill = document.getElementById("exp-fill");
const expLevel = document.getElementById("exp-level");
const petToggle = document.getElementById("pet-toggle");
const tokenForm = document.getElementById("session-token");
const tokenField = document.querySelector("#session-token textarea");
const dockHandle = document.getElementById("dock-handle");

const EDGE_CLASSES = ["edge-left", "edge-right", "edge-top", "edge-bottom"];
let dockEdge = "right";
let panelIsOpen = false;
let dockDragging = false;
let dockMoved = false;
let activePointerId = null;

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

function applyPetVisible(visible) {
  petToggle.setAttribute("aria-checked", visible ? "true" : "false");
}

function applyExpBar(state) {
  const ready = state.petStatsReady === true;
  const level = state.level;
  if (ready && typeof level === "number" && Number.isFinite(level) && level >= 1) {
    expLevel.textContent = `LV${Math.floor(level)}`;
  } else {
    expLevel.textContent = "";
  }

  const into = state.xpIntoLevel;
  const pct =
    ready && typeof into === "number" && Number.isFinite(into)
      ? `${Math.max(0, Math.min(100, Math.round(into)))}%`
      : "0%";

  if (isHorizontalEdge(dockEdge)) {
    expFill.style.width = pct;
    expFill.style.height = "100%";
    expFill.style.left = "0";
    expFill.style.right = "auto";
    expFill.style.top = "0";
    expFill.style.bottom = "0";
  } else {
    expFill.style.height = pct;
    expFill.style.width = "auto";
    expFill.style.left = "0";
    expFill.style.right = "0";
    expFill.style.bottom = "0";
    expFill.style.top = "auto";
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
  if (pointerId !== null && dockHandle.hasPointerCapture?.(pointerId)) {
    try {
      dockHandle.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be cleared.
    }
  }
}

toggle.addEventListener("click", () => {
  if (dockDragging || dockMoved) return;
  window.pet.setOpen(toggle.getAttribute("aria-expanded") !== "true");
});

petToggle.addEventListener("click", () => {
  window.pet.setPetVisible(petToggle.getAttribute("aria-checked") !== "true");
});

dockHandle.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  dockDragging = true;
  dockMoved = false;
  activePointerId = event.pointerId;
  dockHandle.setPointerCapture?.(event.pointerId);
  const point = screenPoint(event);
  window.pet.dockDragStart(point.x, point.y);
});

dockHandle.addEventListener("pointermove", (event) => {
  if (!dockDragging || event.pointerId !== activePointerId) return;
  dockMoved = true;
  const point = screenPoint(event);
  window.pet.dockDragMove(point.x, point.y);
});

function finishDockPointer(event, cancelled) {
  if (!dockDragging || (activePointerId !== null && event.pointerId !== activePointerId)) return;
  const point = screenPoint(event);
  const moved = dockMoved;
  if (cancelled) window.pet.dockDragCancel();
  else window.pet.dockDragEnd(point.x, point.y);
  clearDockDrag();
  if (moved) {
    const blockClick = (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      dockHandle.removeEventListener("click", blockClick, true);
    };
    dockHandle.addEventListener("click", blockClick, true);
  }
}

dockHandle.addEventListener("pointerup", (event) => {
  finishDockPointer(event, false);
});

dockHandle.addEventListener("pointercancel", (event) => {
  finishDockPointer(event, true);
});

dockHandle.addEventListener("lostpointercapture", (event) => {
  // pointerup/cancel already cleared state; only recover unexpected capture loss.
  if (!dockDragging) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  window.pet.dockDragCancel();
  activePointerId = null;
  dockDragging = false;
  dockMoved = false;
});

window.addEventListener("blur", () => {
  if (!dockDragging) return;
  window.pet.dockDragCancel();
  clearDockDrag();
});

function fillSessionCode(text) {
  if (!(tokenField instanceof HTMLTextAreaElement)) return;
  const code = text.trim();
  if (!code) return;
  tokenField.value = code;
  tokenField.focus();
}

document.addEventListener("paste", (event) => {
  if (document.activeElement === tokenField) return;
  const text = event.clipboardData?.getData("text") ?? "";
  if (!text.trim()) return;
  event.preventDefault();
  fillSessionCode(text);
});

document.addEventListener("keydown", (event) => {
  const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "v";
  if (!shortcut || document.activeElement === tokenField) return;
  if (!navigator.clipboard?.readText) return;
  event.preventDefault();
  void navigator.clipboard.readText().then(fillSessionCode).catch(() => {});
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

document.getElementById("session-token").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = await window.pet.useToken(String(data.get("token") ?? ""));
  status.textContent = result.error || "Session token accepted.";
});

applyDockEdge("right");

window.pet.onState((state) => {
  if (typeof state.dockEdge === "string") applyDockEdge(state.dockEdge);
  if (typeof state.panelOpen === "boolean") applyPanelOpen(state.panelOpen);
  if (typeof state.petVisible === "boolean") applyPetVisible(state.petVisible);
  applyExpBar(state);
  timer.hidden = !state.remainingLabel;
  tokenForm.hidden = Boolean(state.remainingLabel);
  timer.textContent = state.remainingLabel || "";
  if (state.status) status.textContent = state.status;
  finishButton.hidden = !state.finishLabel;
  finishButton.textContent = state.finishLabel || "Finish focused session";
  note.textContent = state.finishNote || "";
  bubble.textContent = state.bubble || "";
  bubble.hidden = !state.bubble;
  if (state.updateUrl) {
    update.hidden = false;
    updateLabel.textContent = state.updateLabel || "A newer pet is available.";
  } else {
    update.hidden = true;
  }
});
