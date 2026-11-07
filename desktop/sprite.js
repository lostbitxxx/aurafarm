const canvas = document.getElementById("sprite");
const caption = document.getElementById("caption");
const context = canvas.getContext("2d");

function draw() {
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = "#c6ef4a";
  context.beginPath();
  context.ellipse(64, 62, 42, 32, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#14211a";
  context.beginPath();
  context.arc(50, 58, 4, 0, Math.PI * 2);
  context.arc(78, 58, 4, 0, Math.PI * 2);
  context.fill();
}

function insideSprite(x, y) {
  const dx = (x - 64) / 42;
  const dy = (y - 62) / 32;
  return dx * dx + dy * dy <= 1;
}

draw();

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  window.pet.setPointerInside(
    insideSprite(event.clientX - rect.left, event.clientY - rect.top),
  );
});

canvas.addEventListener("mouseleave", () => {
  window.pet.setPointerInside(false);
});

canvas.addEventListener("click", () => {
  window.pet.togglePanel();
});

window.pet.onState((state) => {
  const name = state.petType
    ? state.petType
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Baby slime";
  caption.textContent = state.level ? `${name} · ${state.level}` : name;
});
