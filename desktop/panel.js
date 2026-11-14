const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const finishButton = document.getElementById("finish");
const note = document.getElementById("note");
const bubble = document.getElementById("bubble");
const toggle = document.getElementById("panel-toggle");
const tokenField = document.querySelector("#session-token textarea");

function applyPanelOpen(open) {
  document.body.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? "Close Aurafarm" : "Open Aurafarm");
  toggle.textContent = open ? "›" : "‹";
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

window.pet.onState((state) => {
  if (typeof state.panelOpen === "boolean") applyPanelOpen(state.panelOpen);
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
