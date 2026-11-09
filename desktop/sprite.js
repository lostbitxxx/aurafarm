import { drawBabySlime } from "./pets/baby-slime.js";
import { drawLanternMoth } from "./pets/lantern-moth.js";
import { drawRiverNewt } from "./pets/river-newt.js";

const canvas = document.getElementById("sprite");
const caption = document.getElementById("caption");
const context = canvas.getContext("2d");

function drawPet(petType) {
  context.clearRect(0, 0, 128, 128);
  if (petType === "lantern_moth") drawLanternMoth(context);
  else if (petType === "river_newt") drawRiverNewt(context);
  else drawBabySlime(context);
}

function insideSprite(x, y) {
  const dx = (x - 64) / 48;
  const dy = (y - 68) / 44;
  return dx * dx + dy * dy <= 1;
}

drawPet("baby_slime");

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
  drawPet(state.petType);
  const name = state.petType
    ? state.petType
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Baby slime";
  caption.textContent = state.level ? `${name} · ${state.level}` : name;
});
