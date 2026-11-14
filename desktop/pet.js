const petSprite = document.getElementById("pet-sprite");
let assetOrigin = "";
let shownPet = "baby_slime";
let shownPose = "idle";
let shownFlip = false;

function applyPetSprite() {
  const base = String(assetOrigin || "").replace(/\/$/, "");
  if (!base) return;
  const src = base + plainPetPath(shownPet, shownPose);
  if (petSprite.getAttribute("src") !== src) petSprite.src = src;
  petSprite.style.transform = shownFlip ? "scaleX(-1)" : "";
}

window.pet.onState((state) => {
  if (typeof state.assetOrigin === "string") assetOrigin = state.assetOrigin;
  if (state.petType) shownPet = state.petType;
  if (state.petPose) shownPose = state.petPose;
  if (typeof state.petFlip === "boolean") shownFlip = state.petFlip;
  applyPetSprite();
});
