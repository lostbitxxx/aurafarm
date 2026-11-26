/**
 * Header streak calendar tone + recent daily study totals (farmer local days).
 */

import { shiftLocalDay, studySecondsOnLocalDay } from "@/lib/study";

export type StreakCalendarTone = "study-pending" | "study-done" | "rest-pending" | "rest-done";

export type RecentStudyDay = {
  day: string;
  seconds: number;
};

/** Visual tone for today's calendar icon. */
export function streakCalendarTone(isStudyDay: boolean, goalMet: boolean): StreakCalendarTone {
  if (isStudyDay) return goalMet ? "study-done" : "study-pending";
  return goalMet ? "rest-done" : "rest-pending";
}

export function goalMetToday(studiedMinutes: number, goalMinutes: number | null | undefined) {
  if (goalMinutes == null || !Number.isFinite(goalMinutes) || goalMinutes <= 0) {
    return studiedMinutes > 0;
  }
  return studiedMinutes >= goalMinutes;
}

/**
 * Last `count` farmer-local days ending at `todayLocal`, newest first.
 * Seconds are submitted session totals for each day.
 */
export function recentStudyDays(
  sessions: readonly {
    status: "submitted" | "cancelled";
    endedAt: string;
    durationSeconds?: number;
  }[],
  todayLocal: string,
  count = 7,
): RecentStudyDay[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0 || !todayLocal) return [];
  const days: RecentStudyDay[] = [];
  for (let offset = 0; offset < safeCount; offset += 1) {
    const day = offset === 0 ? todayLocal : shiftLocalDay(todayLocal, -offset);
    if (!day) break;
    days.push({ day, seconds: studySecondsOnLocalDay(sessions, day) });
  }
  return days;
}

/**
 * Seven-day history from the full submitted list, with today replaced by the
 * cylinder's live total (reset filter + in-progress session).
 */
export function calendarRecentDays(
  sessions: Parameters<typeof recentStudyDays>[0],
  todayLocal: string,
  todaySeconds: number,
  count = 7,
): RecentStudyDay[] {
  const days = recentStudyDays(sessions, todayLocal, count);
  const seconds = Number.isFinite(todaySeconds) ? Math.max(0, Math.floor(todaySeconds)) : 0;
  return days.map((row) => (row.day === todayLocal ? { day: row.day, seconds } : row));
}

/** Sum pet levels from XP progress maps. */
export function sumPetLevels(levels: readonly number[]) {
  let total = 0;
  for (const level of levels) {
    if (!Number.isFinite(level)) continue;
    total += Math.max(0, Math.floor(level));
  }
  return total;
}
