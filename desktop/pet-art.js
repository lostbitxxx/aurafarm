/** Layered equipped-pet sprites. Color/hat/clothes can be added later from panel state. */

const PLAIN_PETS = {
  baby_slime: ["cat", "sage"],
  lantern_moth: ["bunny", "lavender"],
  river_newt: ["cat", "honey"],
};

function plainPetPair(petType) {
  return PLAIN_PETS[petType] || PLAIN_PETS.baby_slime;
}

function legModeForPose(pose) {
  if (pose === "walk2" || pose === "study2") return "right-up";
  if (pose === "walk1" || pose === "wait" || pose === "study1") return "left-up";
  return "stand";
}

function faceModeForPose(pose) {
  return pose === "blush" ? "blush" : "normal";
}

function isStudyPose(pose) {
  return pose === "study1" || pose === "study2";
}

/** @deprecated Prefer plainPetStack — kept for tests that still check a single path. */
function plainPetPath(petType, pose) {
  const pair = plainPetPair(petType);
  const frame = pose || "idle";
  if (frame === "idle" || frame === "blush" || frame === "walk1" || frame === "walk2" || frame === "wait") {
    return `/pet-assets/pets/${pair[0]}/colors/${pair[1]}/body.svg`;
  }
  return `/pet-assets/pets/${pair[0]}/colors/${pair[1]}/body.svg`;
}

function plainPetStack(petType, pose) {
  const pair = plainPetPair(petType);
  const frame = pose || "idle";
  const base = `/pet-assets/pets/${pair[0]}/colors/${pair[1]}`;
  const study = isStudyPose(frame);
  return {
    stage: study ? "study" : "pet",
    shadow: study ? null : `${base}/shadow.svg`,
    legs: `${base}/legs/${legModeForPose(frame)}.svg`,
    body: `${base}/body.svg`,
    face: `${base}/face/${faceModeForPose(frame)}.svg`,
    floor: study ? "/pet-assets/props/study/floor.svg" : null,
    chair: study ? "/pet-assets/props/study/chair.svg" : null,
    desk: study ? "/pet-assets/props/study/desk.svg" : null,
    pen: study ? `/pet-assets/props/study/pen-${frame === "study2" ? "2" : "1"}.svg` : null,
  };
}

function clampPetX(x, laneWidth, spriteWidth) {
  const max = Math.max(0, Number(laneWidth) - Number(spriteWidth));
  const next = Number(x);
  if (!Number.isFinite(next)) return 0;
  return Math.min(max, Math.max(0, next));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { clampPetX, plainPetPath, plainPetStack };
}
