const bubble = document.getElementById("bubble");

window.pet.onState((state) => {
  bubble.textContent = state.bubble || "";
});
