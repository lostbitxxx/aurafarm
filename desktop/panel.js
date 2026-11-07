const status = document.getElementById("status");

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
});
