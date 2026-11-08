const button = document.getElementById("finish");
const note = document.getElementById("note");

button.addEventListener("click", () => {
  window.pet.finish();
});

window.pet.onState((state) => {
  if (state.finishLabel) button.textContent = state.finishLabel;
  note.textContent = state.finishNote || "";
});
