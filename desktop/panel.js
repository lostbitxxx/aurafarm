const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");

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
  status.textContent = result.error || "Session code accepted.";
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
