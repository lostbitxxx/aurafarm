/** Plain equipped-pet sprites. No color, hat, or clothes. */

const PLAIN_PETS = {
  baby_slime: ["cat", "sage"],
  lantern_moth: ["bunny", "lavender"],
  river_newt: ["cat", "honey"],
};

function plainPetPath(petType, pose) {
  const pair = PLAIN_PETS[petType] || PLAIN_PETS.baby_slime;
  const frame = pose || "idle";
  return `/pet-assets/pets/${pair[0]}/${pair[1]}/no-hat-no-clothes/${frame}.svg`;
}

function clampPetX(x, laneWidth, spriteWidth) {
  const max = Math.max(0, Number(laneWidth) - Number(spriteWidth));
  const next = Number(x);
  if (!Number.isFinite(next)) return 0;
  return Math.min(max, Math.max(0, next));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { clampPetX, plainPetPath };
}
