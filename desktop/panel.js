const status = document.getElementById("status");
const update = document.getElementById("update");
const updateLabel = document.getElementById("update-label");

document.getElementById("update-button").addEventListener("click", () => {
  window.pet.openUpdate();
});

document.getElementById("quit").addEventListener("click", () => {
  window.pet.quit();
});

document.getElementById("sign-in").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = await window.pet.signIn(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
  status.textContent = result.error || "Signed in.";
});

document.getElementById("claim").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = await window.pet.claim(String(data.get("code") ?? ""));
  status.textContent = result.error || "Session claimed.";
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
