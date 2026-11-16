const petStack = document.getElementById("pet-stack");
const layerNodes = {
  floor: petStack.querySelector('[data-layer="floor"]'),
  chair: petStack.querySelector('[data-layer="chair"]'),
  shadow: petStack.querySelector('[data-layer="shadow"]'),
  legs: petStack.querySelector('[data-layer="legs"]'),
  body: petStack.querySelector('[data-layer="body"]'),
  face: petStack.querySelector('[data-layer="face"]'),
  desk: petStack.querySelector('[data-layer="desk"]'),
  pen: petStack.querySelector('[data-layer="pen"]'),
};

let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownFlip = false;

function setLayer(node, src) {
  if (!node) return;
  if (!src) {
    node.hidden = true;
    node.removeAttribute("src");
    return;
  }
  if (node.getAttribute("src") !== src) node.src = src;
  node.hidden = false;
}

function applyPetSprite() {
  const base = String(assetOrigin || "").replace(/\/$/, "");
  if (!base) return;
  const stack = plainPetStack(shownPet, shownPose);
  petStack.classList.toggle("is-study", stack.stage === "study");
  setLayer(layerNodes.floor, stack.floor ? base + stack.floor : null);
  setLayer(layerNodes.chair, stack.chair ? base + stack.chair : null);
  setLayer(layerNodes.shadow, stack.shadow ? base + stack.shadow : null);
  setLayer(layerNodes.legs, base + stack.legs);
  setLayer(layerNodes.body, base + stack.body);
  setLayer(layerNodes.face, base + stack.face);
  setLayer(layerNodes.desk, stack.desk ? base + stack.desk : null);
  setLayer(layerNodes.pen, stack.pen ? base + stack.pen : null);
  petStack.style.transform = shownFlip ? "scaleX(-1)" : "";
}

window.pet.onState((state) => {
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applyPetSprite();
});
