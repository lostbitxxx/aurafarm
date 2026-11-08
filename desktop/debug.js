const debug = document.getElementById("debug");

window.pet.onState((state) => {
  debug.textContent = state.debug || "Debug: starting.";
});
