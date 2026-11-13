const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");
const tokenField = document.querySelector("#session-token textarea");

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

document.getElementById("cancel").addEventListener("click", async () => {
  const result = await window.pet.cancelStudy();
  status.textContent = result.error || "Study session cancelled.";
});

document.getElementById("session-token").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = await window.pet.useToken(String(data.get("token") ?? ""));
  status.textContent = result.error || "Session token accepted.";
});

window.pet.onState((state) => {
  if (state.status) status.textContent = state.status;
  if (state.updateUrl) {
    update.hidden = false;
    updateLabel.textContent = state.updateLabel || "A newer pet is available.";
  } else {
    update.hidden = true;
  }
});
