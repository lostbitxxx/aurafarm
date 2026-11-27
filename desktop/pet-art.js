/** Layered equipped-pet sprites. Paths match lib/pet-assets.ts worn overlays. */

const PLAIN_PETS = {
  baby_slime: ["cat", "sage"],
  lantern_moth: ["bunny", "lavender"],
  river_newt: ["cat", "honey"],
};

const PET_COLORS = new Set([
  "honey",
  "apricot",
  "rose",
  "coral",
  "lavender",
  "sage",
  "mint",
  "sky",
  "lemon",
  "slate",
  "white",
  "black",
]);

const SAMPLE_HATS = new Set(["hat_a", "hat_b"]);

const WORN_HATS = new Set([
  "hat_a",
  "hat_b",
  "little-gentleman-top-hat",
  "summer-garden-straw-hat",
  "flower-day-daisy-clip",
  "lucky-heart-clover-clip",
  "sleepy-companion-nightcap",
  "little-artist-beret",
  "forest-mushroom-mushroom-cap",
  "little-wizard-star-hat",
]);

const WORN_CLOTHES = new Set([
  "clothes_a",
  "clothes_b",
  "little-gentleman-suit",
  "summer-garden-vest",
  "flower-day-dress",
  "lucky-heart-heart-shorts",
  "sleepy-companion-star-pajamas",
  "little-artist-paint-apron",
  "forest-mushroom-woodland-vest",
  "little-wizard-wizard-robe",
]);

function plainPetPair(petType) {
  return PLAIN_PETS[petType] || PLAIN_PETS.baby_slime;
}

function legModeForPose(pose) {
  if (pose === "walk2" || pose === "study2") return "right-up";
  if (pose === "walk1" || pose === "wait" || pose === "study1") return "left-up";
  return "stand";
}

function faceModeForPose(pose) {
  if (pose === "struggle") return "struggle";
  return pose === "blush" ? "blush" : "normal";
}

/**
 * Resting desktop pose.
 * A focused study session (not on a blocked site, not walking off to close one)
 * sits at the study desk (study1 / study2). Walk frames stay put while the pet is moving.
 * Distracted → idle (pen stops). Mad phase → struggle face.
 * @param {{
 *   sessionActive?: boolean,
 *   onDistracted?: boolean,
 *   mad?: boolean,
 *   closing?: boolean,
 *   animating?: boolean,
 *   currentPose?: string,
 * }} input
 */
function restingPetPose(input = {}) {
  const current = input.currentPose || "idle";
  if (input.animating) {
    if (input.closing && (current === "blush" || current === "idle" || current === "struggle" || isStudyPose(current))) {
      return "idle";
    }
    return current;
  }
  if (input.onDistracted) {
    return input.mad ? "struggle" : "idle";
  }
  if (input.sessionActive && !input.closing) {
    return isStudyPose(current) ? current : "study1";
  }
  return "idle";
}

function isStudyPose(pose) {
  return pose === "study1" || pose === "study2";
}

const HONG_KONG_WEEKDAYS = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function hongKongWeekday(now = new Date()) {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(now);
  return HONG_KONG_WEEKDAYS[label] ?? null;
}

function parseWeekdays(value) {
  let entries = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      entries = trimmed
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    } else if (trimmed.startsWith("[")) {
      try {
        entries = JSON.parse(trimmed);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }
  if (!Array.isArray(entries)) return [];
  const days = [];
  for (const entry of entries) {
    const day = typeof entry === "number" ? entry : Number(entry);
    if (!Number.isInteger(day) || day < 1 || day > 7 || days.includes(day)) continue;
    days.push(day);
  }
  return days.sort((left, right) => left - right);
}

function dayListed(days, weekday) {
  return days.some((day) => Number(day) === weekday);
}

/** Study days fill red, rest days fill blue. No plan yet keeps the green rail. */
function sessionDayKind(state, now = new Date()) {
  const weekday = hongKongWeekday(now);
  const study = parseWeekdays(state?.studyDays);
  const rest = parseWeekdays(state?.restDays);
  if (weekday && dayListed(rest, weekday)) return "rest";
  if (weekday && dayListed(study, weekday)) return "study";
  if (study.length === 0 && rest.length === 0) return "unset";
  return "rest";
}

const SESSION_RAIL_COLORS = {
  study: { liquid: "#c43b2e", track: "#f3c2bc" },
  rest: { liquid: "#3f78c8", track: "#c5d7ee" },
  unset: { liquid: "#5fbf4a", track: "transparent" },
};

function sessionRailColors(kind) {
  return SESSION_RAIL_COLORS[kind] || SESSION_RAIL_COLORS.unset;
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

function wornHatPath(hat) {
  return typeof hat === "string" && WORN_HATS.has(hat)
    ? `/pet-assets/accessories/worn/hats/${hat}.svg`
    : null;
}

/** Sample hats are drawn on the body canvas. Collection hats sit mid-canvas, so they are pinned above the face. */
function hatPlacement(hat) {
  if (typeof hat !== "string" || !WORN_HATS.has(hat)) return "none";
  return SAMPLE_HATS.has(hat) ? "overlay" : "head";
}

function wornClothesPath(clothes, species) {
  return typeof clothes === "string" && WORN_CLOTHES.has(clothes)
    ? `/pet-assets/accessories/worn/${clothes}/${species}.svg`
    : null;
}

function plainPetStack(petType, pose, options = {}) {
  const pair = plainPetPair(petType);
  const frame = pose || "idle";
  const color = PET_COLORS.has(options.color) ? options.color : pair[1];
  const species = pair[0];
  const base = `/pet-assets/pets/${species}/colors/${color}`;
  const study = isStudyPose(frame);
  return {
    stage: study ? "study" : "pet",
    shadow: study ? null : `${base}/shadow.svg`,
    legs: `${base}/legs/${legModeForPose(frame)}.svg`,
    body: `${base}/body.svg`,
    clothes: wornClothesPath(options.clothes, species),
    face: `${base}/face/${faceModeForPose(frame)}.svg`,
    hat: wornHatPath(options.hat),
    hatPlacement: hatPlacement(options.hat),
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
  module.exports = {
    clampPetX,
    parseWeekdays,
    plainPetPath,
    plainPetStack,
    restingPetPose,
    sessionDayKind,
    sessionRailColors,
  };
}
