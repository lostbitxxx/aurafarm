const status = document.getElementById("status");
const timer = document.getElementById("timer");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const finishButton = document.getElementById("finish");
const note = document.getElementById("note");
const bubble = document.getElementById("bubble");
const toggle = document.getElementById("panel-toggle");
const panelArrow = document.getElementById("panel-arrow");
const timerFill = document.getElementById("timer-fill");
const petLane = document.getElementById("pet-lane");
const petSprite = document.getElementById("pet-sprite");
const tokenField = document.querySelector("#session-token textarea");
const PET_WIDTH = 70;
const PET_STEP = 2;
let petX = 0;
let petDir = 1;
let walkFrame = "walk1";
let walkTimer = null;
let frameTimer = null;
let assetOrigin = "";
let shownPet = "baby_slime";

function applyPanelOpen(open) {
  document.body.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? "Close Aurafarm" : "Open Aurafarm");
  panelArrow.textContent = open ? "›" : "‹";
  if (open) startPetWalk();
  else stopPetWalk();
}

toggle.addEventListener("click", () => {
  window.pet.setOpen(toggle.getAttribute("aria-expanded") !== "true");
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

function petSrc(pose) {
  const base = String(assetOrigin || "").replace(/\/$/, "");
  if (!base) return "";
  return base + plainPetPath(shownPet, pose);
}

function applyPetSprite() {
  const src = petSrc(walkTimer ? walkFrame : "idle");
  if (src && petSprite.getAttribute("src") !== src) petSprite.src = src;
}

function stepPet() {
  const laneWidth = petLane.clientWidth;
  const max = Math.max(0, laneWidth - PET_WIDTH);
  const next = petX + petDir * PET_STEP;
  if (next <= 0) petDir = 1;
  if (next >= max) petDir = -1;
  petX = clampPetX(next, laneWidth, PET_WIDTH);
  petSprite.style.left = `${petX}px`;
  petSprite.style.transform = petDir < 0 ? "scaleX(-1)" : "";
}

function startPetWalk() {
  if (walkTimer) return;
  walkTimer = setInterval(stepPet, 40);
  frameTimer = setInterval(() => {
    walkFrame = walkFrame === "walk1" ? "walk2" : "walk1";
    applyPetSprite();
  }, 250);
  applyPetSprite();
  stepPet();
}

function stopPetWalk() {
  if (walkTimer) clearInterval(walkTimer);
  walkTimer = null;
  if (frameTimer) clearInterval(frameTimer);
  frameTimer = null;
  walkFrame = "walk1";
  applyPetSprite();
}

window.pet.onState((state) => {
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  applyPetSprite();
  if (typeof state.panelOpen === "boolean") applyPanelOpen(state.panelOpen);
  timer.hidden = !state.remainingLabel;
  timer.textContent = state.remainingLabel || "";
  const progress = Number(state.timerProgress);
  timerFill.style.height = `${Math.round((Number.isFinite(progress) ? progress : 0) * 100)}%`;
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
