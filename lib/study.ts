export const STUDY_LENGTHS = [
  { minutes: 5, seconds: 300 },
  { minutes: 30, seconds: 1800 },
  { minutes: 60, seconds: 3600 },
  { minutes: 90, seconds: 5400 },
] as const;

const LEGACY_STUDY_SECONDS = [1500, 3300, 5100];

export const DEFAULT_STUDY_SECONDS = 300;
export const MIN_STUDY_MINUTES = 1;
export const MAX_STUDY_MINUTES = 240;
export const XP_PER_LEVEL = 100;
export const XP_PER_MINUTE = 2;
export const FINISH_BONUS = 1.1;
export const DISTRACTED_PENALTY = 0.7;
export const FINISH_BONUS_NUMERATOR = 11;
export const FINISH_BONUS_DENOMINATOR = 10;
export const DISTRACTED_PENALTY_NUMERATOR = 7;
export const DISTRACTED_PENALTY_DENOMINATOR = 10;
export const DEV_TIMER_PASSWORD = "emia";

export type ActiveStudySession = {
  id: string;
  startedAt: string;
  plannedSeconds: number;
  useDesktopPet: boolean;
};

export type RecordedStudySession = {
  id: string;
  status: "submitted" | "cancelled";
  durationSeconds: number;
  endedAt: string;
  /** Null when the row has no xp_awarded value (e.g. cancelled before grant). */
  xpAwarded: number | null;
  /**
   * Per-session tracker from study_sessions.use_desktop_pet.
   * true = Desktop pet, false = Website timer, null = missing/unknown.
   */
  useDesktopPet: boolean | null;
  /**
   * Seconds on a blocklist host. Null when the pet did not record the interval.
   */
  distractionSeconds: number | null;
};

export type StudyScoreCard = {
  id: string;
  xp: number;
  distracted: boolean;
  durationSeconds: number;
  blockedHosts: string[];
  createdAt: string;
};

/** Display helpers: null means the duration is not recorded in existing data. */
export type StudyHistoryTime = number | null;

export type StudyHistoryModeLabel = "With pet" | "Web timer" | "Mode unknown";

export type StudyHistoryCard = {
  id: string;
  status: "submitted" | "cancelled";
  durationSeconds: number;
  endedAt: string;
  /** Null when XP cannot be established for this loaded session. */
  xp: number | null;
  /** Frontend-only label from study_sessions.use_desktop_pet. */
  modeLabel: StudyHistoryModeLabel;
  /** True only when study_sessions.use_desktop_pet is authoritatively true. */
  showFocusDistraction: boolean;
  focusSeconds: StudyHistoryTime;
  distractionSeconds: StudyHistoryTime;
};

/**
 * Merge recorded sessions with XP score rows by session id.
 * Focus and distraction are shown for desktop pet sessions that stored
 * distraction_seconds. Focus is the session length minus that distraction time.
 * A missing interval stays null so the card says "Not available".
 */
export function historyFocusDistraction(
  durationSeconds: number,
  distractionSeconds: number | null,
  showFocusDistraction: boolean,
): { focusSeconds: StudyHistoryTime; distractionSeconds: StudyHistoryTime } {
  if (!showFocusDistraction || distractionSeconds === null || !Number.isFinite(distractionSeconds)) {
    return { focusSeconds: null, distractionSeconds: null };
  }
  const duration = Math.max(0, Math.trunc(durationSeconds));
  const distraction = Math.min(duration, Math.max(0, Math.trunc(distractionSeconds)));
  return { focusSeconds: duration - distraction, distractionSeconds: distraction };
}

export function buildStudyHistory(
  sessions: readonly RecordedStudySession[],
  scores: readonly StudyScoreCard[],
): { cards: StudyHistoryCard[]; unmatchedScores: StudyScoreCard[] } {
  const scoreById = new Map(scores.map((score) => [score.id, score]));
  const usedScoreIds = new Set<string>();

  const cards = sessions.map((session) => {
    const score = scoreById.get(session.id);
    if (score) usedScoreIds.add(session.id);

    let xp: number | null = null;
    if (session.xpAwarded !== null && Number.isFinite(session.xpAwarded)) {
      xp = Math.max(0, Math.trunc(session.xpAwarded));
    } else if (score && Number.isFinite(score.xp)) {
      xp = Math.max(0, Math.trunc(score.xp));
    } else if (session.status === "cancelled") {
      // cancel_study_session never sets xp_awarded and never grants experience.
      xp = 0;
    }

    const showFocusDistraction = session.useDesktopPet === true;
    const times = historyFocusDistraction(
      session.durationSeconds,
      session.distractionSeconds,
      showFocusDistraction,
    );

    return {
      id: session.id,
      status: session.status,
      durationSeconds: session.durationSeconds,
      endedAt: session.endedAt,
      xp,
      modeLabel: formatHistoryMode(session.useDesktopPet),
      showFocusDistraction,
      focusSeconds: times.focusSeconds,
      distractionSeconds: times.distractionSeconds,
    };
  });

  const unmatchedScores = scores.filter((score) => !usedScoreIds.has(score.id));
  return { cards, unmatchedScores };
}

export function formatHistoryMode(useDesktopPet: boolean | null): StudyHistoryModeLabel {
  if (useDesktopPet === true) return "With pet";
  if (useDesktopPet === false) return "Web timer";
  return "Mode unknown";
}

export function formatHistoryTime(seconds: StudyHistoryTime) {
  if (seconds === null) return "Not available";
  if (seconds === 0) return "0m";
  return formatDuration(seconds);
}

export function formatHistoryXp(xp: number | null) {
  if (xp === null) return "Not available";
  return `${xp} XP`;
}

const ACTIVE_SESSION_ERROR = "A study session is already running.";

export function startSessionDecision(activeCount: number) {
  if (activeCount > 0) return { error: ACTIVE_SESSION_ERROR };
  return { error: "" };
}

const CLOSE_BLOCKED_MIGRATION =
  "Run migration 0007 before choosing whether blocked tabs close.";

export function closeBlockedMigrationMessage(message: string | null) {
  if (!message) return null;
  if (/close_blocked|schema cache/i.test(message)) return CLOSE_BLOCKED_MIGRATION;
  return message;
}

export function buildPetLaunchUrl(code: string) {
  const params = new URLSearchParams({ code });
  return `aurafarm://session?${params.toString()}`;
}

export function formatTimestamp(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function plannedStudySeconds(value: unknown) {
  const seconds = typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(seconds) || seconds % 60 !== 0) return null;
  const minutes = seconds / 60;
  if (minutes < MIN_STUDY_MINUTES || minutes > MAX_STUDY_MINUTES) return null;
  return seconds;
}

export function storedStudySeconds(value: unknown) {
  const chosen = plannedStudySeconds(value);
  if (chosen !== null) return chosen;
  const seconds = typeof value === "number" ? value : Number.NaN;
  return LEGACY_STUDY_SECONDS.includes(seconds) ? seconds : null;
}

export function experienceForSession(studiedSeconds: number, distracted: boolean) {
  if (!Number.isFinite(studiedSeconds) || studiedSeconds < 60) return 0;
  const minutes = Math.floor(studiedSeconds / 60);
  let gain = Math.floor((minutes * XP_PER_MINUTE * FINISH_BONUS_NUMERATOR) / FINISH_BONUS_DENOMINATOR);
  if (distracted) {
    gain = Math.floor((gain * DISTRACTED_PENALTY_NUMERATOR) / DISTRACTED_PENALTY_DENOMINATOR);
  }
  return gain;
}

export function experienceForDuration(durationSeconds: number) {
  return experienceForSession(durationSeconds, false);
}

export function experienceForEarlyEnd(studiedSeconds: number, distracted: boolean) {
  if (!Number.isFinite(studiedSeconds) || studiedSeconds < 60) return 0;
  const minutes = Math.floor(studiedSeconds / 60);
  let gain = minutes * XP_PER_MINUTE;
  if (distracted) {
    gain = Math.floor((gain * DISTRACTED_PENALTY_NUMERATOR) / DISTRACTED_PENALTY_DENOMINATOR);
  }
  return gain;
}

export function levelFromExperience(xp: number) {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return 1 + Math.floor(safe / XP_PER_LEVEL);
}

export function experienceProgress(xp: number) {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return {
    level: 1 + Math.floor(safe / XP_PER_LEVEL),
    intoLevel: safe % XP_PER_LEVEL,
    xp: safe,
  };
}

export function devTimerPasswordMatches(value: string) {
  return value === DEV_TIMER_PASSWORD;
}

export function focusedSeconds(startedAtMs: number, nowMs: number, planned: number) {
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const cap = Number.isFinite(planned) ? Math.max(0, Math.floor(planned)) : 0;
  return Math.min(cap, elapsed);
}

export function remainingSeconds(startedAt: string, planned: number, nowMs: number) {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return Math.max(0, Math.floor(planned));
  return Math.max(0, Math.floor(planned) - Math.floor((nowMs - started) / 1000));
}

export function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

const STUDY_TIMER_MIGRATION = "Run migration 0011 before using study timers.";
const SESSION_XP_MIGRATION = "Run migration 0012 before starting a study session.";

export function studyTimerMigrationMessage(message: string | null) {
  if (!message) return null;
  if (/distraction_seconds/i.test(message)) {
    return "Run migration 0028 before reading focus and distraction time.";
  }
  if (/collection_rewards|claim_collection_reward/i.test(message)) {
    return "Run migration 0024 before choosing a level reward.";
  }
  if (/\bclothes\b/i.test(message)) {
    return "Run migration 0020 before using collection clothes.";
  }
  if (/\bhat\b/i.test(message)) {
    return "Run migration 0019 before using collection hats.";
  }
  if (/user_collections|collection_items|\bcolor\b/i.test(message)) {
    return "Run migration 0018 before using collection colors.";
  }
  if (/end_study_early/i.test(message)) {
    return "Run migration 0014 before ending a study session early.";
  }
  if (/study_sessions_planned_seconds_check/i.test(message)) {
    return "Run migration 0017 before choosing a custom study length.";
  }
  if (/use_desktop_pet|xp_awarded|grant_study_experience/i.test(message)) {
    return SESSION_XP_MIGRATION;
  }
  if (/planned_seconds|\bpet_id\b|\bxp\b|complete_study_timer/i.test(message)) {
    return STUDY_TIMER_MIGRATION;
  }
  return message;
}
