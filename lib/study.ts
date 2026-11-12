export type BlocklistEntry = {
  host: string;
  label: string;
};

export const STUDY_LENGTHS = [
  { minutes: 5, seconds: 300 },
  { minutes: 30, seconds: 1800 },
  { minutes: 60, seconds: 3600 },
  { minutes: 90, seconds: 5400 },
] as const;

const LEGACY_STUDY_SECONDS = [1500, 3300, 5100];

export const DEFAULT_STUDY_SECONDS = 300;
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
};

export type StudyScoreCard = {
  id: string;
  xp: number;
  distracted: boolean;
  durationSeconds: number;
  blockedHosts: string[];
  createdAt: string;
};

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
  return STUDY_LENGTHS.some((length) => length.seconds === seconds) ? seconds : null;
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
  if (/use_desktop_pet|xp_awarded|grant_study_experience/i.test(message)) {
    return SESSION_XP_MIGRATION;
  }
  if (/planned_seconds|\bpet_id\b|\bxp\b|complete_study_timer/i.test(message)) {
    return STUDY_TIMER_MIGRATION;
  }
  return message;
}
