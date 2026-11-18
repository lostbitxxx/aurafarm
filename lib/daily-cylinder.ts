/** Daily study cylinder: fill toward goal, heat/tint, fire when goal met. */

export type CylinderTone = "study" | "rest";

export type CylinderProgress = {
  /** 0–1 fill height (capped at the rim). */
  ratio: number;
  /** True when studied minutes reach or pass the daily goal. */
  goalMet: boolean;
  studiedMinutes: number;
  goalMinutes: number;
};

/** How often the desk refreshes live session seconds for the capsule. */
export const CYLINDER_TICK_MS = 10_000;

export function cylinderProgress(studiedMinutes: number, goalMinutes: number): CylinderProgress {
  const goal = Number.isFinite(goalMinutes) ? Math.max(1, Math.floor(goalMinutes)) : 1;
  const done = Number.isFinite(studiedMinutes) ? Math.max(0, Math.floor(studiedMinutes)) : 0;
  return {
    ratio: Math.min(1, done / goal),
    goalMet: done >= goal,
    studiedMinutes: done,
    goalMinutes: goal,
  };
}

/**
 * Warmth 0–1 in eight steps (one per band under the seven ruler marks).
 * Empty = 0; crossing each mark raises heat by 1/8; full = 1.
 */
export function cylinderHeat(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const bands = Math.min(8, Math.floor(Math.min(1, ratio) * 8 + 1e-9));
  return bands / 8;
}

export function cylinderTone(isStudyDay: boolean): CylinderTone {
  return isStudyDay ? "study" : "rest";
}

export type CylinderCaption = {
  /** Mood / status line above the capsule. */
  title: string;
  /** Optional second mood line (rest day). */
  subtitle?: string;
  /** Always `x/y mins` for studied vs daily target. */
  detail: string;
};

/** Label shown above the living-room capsule (two or three lines). */
export function cylinderCaption(
  studiedMinutes: number,
  goalMinutes: number,
  isStudyDay: boolean,
): CylinderCaption {
  const progress = cylinderProgress(studiedMinutes, goalMinutes);
  const detail = `${progress.studiedMinutes}/${progress.goalMinutes} mins`;
  if (!isStudyDay) {
    return { title: "Rest day", subtitle: "Feel free to study~", detail };
  }
  if (progress.goalMet) {
    return { title: "You did it!", detail };
  }
  return { title: "Keep going!", detail };
}

/** Seven ruler marks that split the tube into eight equal bands. */
export const CYLINDER_RULER_LINES = [1, 2, 3, 4, 5, 6, 7] as const;
