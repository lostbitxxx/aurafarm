/** Pet experience progress. Matches lib/pets.wholePoints + lib/study.experienceProgress. */

const XP_PER_LEVEL = 100;

function wholePoints(value) {
  const points = Number(value);
  return Number.isFinite(points) ? Math.trunc(points) : 0;
}

function experienceProgress(xp) {
  const safe = wholePoints(xp);
  return {
    level: 1 + Math.floor(safe / XP_PER_LEVEL),
    intoLevel: safe % XP_PER_LEVEL,
    xp: safe,
  };
}

/**
 * Canonical display stats from a user_pets row.
 * Missing xp is unavailable (not fake zero). Present xp—including 0—uses desk rules.
 */
function petDisplayProgress(row) {
  if (!row || row.xp === null || row.xp === undefined || row.xp === "") {
    return {
      petId: typeof row?.id === "string" ? row.id : null,
      level: null,
      xpIntoLevel: null,
      xp: null,
      ready: false,
    };
  }
  const progress = experienceProgress(row.xp);
  return {
    petId: typeof row.id === "string" ? row.id : null,
    level: progress.level,
    xpIntoLevel: progress.intoLevel,
    xp: progress.xp,
    ready: true,
  };
}

module.exports = { XP_PER_LEVEL, wholePoints, experienceProgress, petDisplayProgress };
