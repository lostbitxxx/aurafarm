export const STUDY_MODES = ["assassin", "knight", "lord"] as const;

export type StudyMode = (typeof STUDY_MODES)[number];

/** Monday = 1 … Sunday = 7 (ISO weekday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export const SESSION_MINUTE_OPTIONS = [30, 60, 90] as const;

export const SESSION_MINUTE_COPY: Record<(typeof SESSION_MINUTE_OPTIONS)[number], string> = {
  30: "good for cumulative time",
  60: "Great for focused study sessions",
  90: "Ideal for deep focus",
};

export type BehaviorAnswers = {
  attention: "short" | "medium" | "long";
  lifestyle: "few" | "steady" | "daily";
  distraction: "often" | "sometimes" | "rare";
};

export type StudyPlan = {
  mode: StudyMode;
  /** Daily study goal in minutes on a selected weekday (seeded from mode). */
  sessionMinutes: number;
  /** Which weekdays the farmer plans to study. */
  studyWeekdays: Weekday[];
  studyDaysPerWeek: number;
};

export type BehaviorQuestion = {
  id: keyof BehaviorAnswers;
  prompt: string;
  hint: string;
  options: { value: BehaviorAnswers[keyof BehaviorAnswers]; label: string; detail: string }[];
};

export const BEHAVIOR_QUESTIONS: BehaviorQuestion[] = [
  {
    id: "attention",
    prompt: "How long can you usually focus before you want to switch?",
    hint: "Think about a typical day, not your best day.",
    options: [
      { value: "short", label: "Under 30 minutes", detail: "Short sessions with frequent breaks." },
      { value: "medium", label: "30–60 minutes", detail: "A moderate session before a break." },
      { value: "long", label: "Over 60 minutes", detail: "Longer sessions with fewer interruptions." },
    ],
  },
  {
    id: "lifestyle",
    prompt: "How many days a week can you realistically study?",
    hint: "Count the days you can usually make time for.",
    options: [
      { value: "few", label: "2–3 days", detail: "A few dedicated study days each week." },
      { value: "steady", label: "4–5 days", detail: "A consistent routine on most weekdays." },
      { value: "daily", label: "6–7 days", detail: "Study on most days of the week." },
    ],
  },
  {
    id: "distraction",
    prompt: "When you study, how often do phones or social pull you away?",
    hint: "This shapes how strict your study mode should feel.",
    options: [
      { value: "often", label: "Often", detail: "Distracted pretty easily." },
      { value: "sometimes", label: "Sometimes", detail: "It depends on the day." },
      { value: "rare", label: "Rarely", detail: "You usually stay on track." },
    ],
  },
];

export const STUDY_MODE_ART: Record<StudyMode, string> = {
  assassin: "/pet-assets/ui/assassin.svg",
  knight: "/pet-assets/ui/knight.svg",
  lord: "/pet-assets/ui/lord.svg",
};

const MODE_META: Record<
  StudyMode,
  { name: string; tagline: string; sessionMinutes: number }
> = {
  assassin: {
    name: "Assassin",
    tagline: "Short strikes for heavy distractors.",
    sessionMinutes: 30,
  },
  knight: {
    name: "Knight",
    tagline: "Steady blocks for a normal focus day.",
    sessionMinutes: 60,
  },
  lord: {
    name: "Lord",
    tagline: "Long sessions for high-focus farmers.",
    sessionMinutes: 90,
  },
};

/** Default study weekdays from the lifestyle behavior answer. */
export const LIFESTYLE_WEEKDAYS: Record<BehaviorAnswers["lifestyle"], readonly Weekday[]> = {
  few: [1, 3, 5],
  steady: [1, 2, 3, 4, 5],
  // Leave Sunday off by default so Goals clearly shows rest days are toggleable.
  daily: [1, 2, 3, 4, 5, 6],
};

export function isStudyMode(value: unknown): value is StudyMode {
  return typeof value === "string" && (STUDY_MODES as readonly string[]).includes(value);
}

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;
}

export function isSessionMinutes(value: unknown): value is (typeof SESSION_MINUTE_OPTIONS)[number] {
  return (
    typeof value === "number" &&
    (SESSION_MINUTE_OPTIONS as readonly number[]).includes(value)
  );
}

export function modeLabel(mode: StudyMode) {
  return MODE_META[mode].name;
}

export function modeTagline(mode: StudyMode) {
  return MODE_META[mode].tagline;
}

export function modeSessionMinutes(mode: StudyMode) {
  return MODE_META[mode].sessionMinutes;
}

export function defaultWeekdaysForLifestyle(lifestyle: BehaviorAnswers["lifestyle"]): Weekday[] {
  return [...LIFESTYLE_WEEKDAYS[lifestyle]];
}

/** @deprecated Prefer defaultWeekdaysForLifestyle — kept for callers that only need a count. */
export function studyDaysPerWeek(lifestyle: BehaviorAnswers["lifestyle"]) {
  return LIFESTYLE_WEEKDAYS[lifestyle].length;
}

export function normalizeStudyWeekdays(value: unknown): Weekday[] | null {
  if (!Array.isArray(value)) return null;
  const unique = new Set<Weekday>();
  for (const entry of value) {
    const num = typeof entry === "string" ? Number(entry) : entry;
    if (!isWeekday(num)) return null;
    unique.add(num);
  }
  if (unique.size === 0) return null;
  return WEEKDAYS.filter((day) => unique.has(day));
}

export function parseStudyWeekdaysInput(raw: string): Weekday[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return normalizeStudyWeekdays(trimmed.split(",").map((part) => Number(part.trim())));
}

/** ISO weekday for a farmer local day string (YYYY-MM-DD). */
export function weekdayFromLocalDay(localDay: string): Weekday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDay)) return null;
  const year = Number(localDay.slice(0, 4));
  const month = Number(localDay.slice(5, 7));
  const day = Number(localDay.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  const jsDay = utc.getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

export function isScheduledStudyDay(studyWeekdays: readonly Weekday[], localDay: string) {
  const weekday = weekdayFromLocalDay(localDay);
  if (!weekday) return false;
  return studyWeekdays.includes(weekday);
}

export function formatStudyWeekdays(studyWeekdays: readonly Weekday[]) {
  return studyWeekdays.map((day) => WEEKDAY_LABELS[day]).join(" ");
}

export function recommendStudyMode(answers: BehaviorAnswers): StudyMode {
  const scores: Record<StudyMode, number> = { assassin: 0, knight: 0, lord: 0 };

  if (answers.attention === "short") scores.assassin += 2;
  if (answers.attention === "medium") scores.knight += 2;
  if (answers.attention === "long") scores.lord += 2;

  if (answers.distraction === "often") scores.assassin += 2;
  if (answers.distraction === "sometimes") scores.knight += 2;
  if (answers.distraction === "rare") scores.lord += 2;

  if (answers.lifestyle === "few") scores.assassin += 1;
  if (answers.lifestyle === "steady") scores.knight += 1;
  if (answers.lifestyle === "daily") scores.lord += 1;

  let best: StudyMode = "knight";
  for (const mode of STUDY_MODES) {
    if (scores[mode] > scores[best]) best = mode;
  }
  return best;
}

export function planForMode(
  mode: StudyMode,
  lifestyle: BehaviorAnswers["lifestyle"] = "steady",
  studyWeekdays?: readonly Weekday[],
  sessionMinutes?: number,
): StudyPlan {
  const weekdays = normalizeStudyWeekdays(studyWeekdays ?? defaultWeekdaysForLifestyle(lifestyle));
  const days = weekdays ?? defaultWeekdaysForLifestyle(lifestyle);
  const minutes = isSessionMinutes(sessionMinutes) ? sessionMinutes : MODE_META[mode].sessionMinutes;
  return {
    mode,
    sessionMinutes: minutes,
    studyWeekdays: days,
    studyDaysPerWeek: days.length,
  };
}

export function adjustPlan(
  mode: StudyMode,
  sessionMinutes: number,
  studyWeekdays: readonly Weekday[],
): StudyPlan {
  const days = normalizeStudyWeekdays(studyWeekdays) ?? defaultWeekdaysForLifestyle("steady");
  const minutes = isSessionMinutes(sessionMinutes)
    ? sessionMinutes
    : MODE_META[mode].sessionMinutes;
  return {
    mode,
    sessionMinutes: minutes,
    studyWeekdays: days,
    studyDaysPerWeek: days.length,
  };
}

export function parseBehaviorAnswers(value: unknown): BehaviorAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const attention = record.attention;
  const lifestyle = record.lifestyle;
  const distraction = record.distraction;
  if (attention !== "short" && attention !== "medium" && attention !== "long") return null;
  if (lifestyle !== "few" && lifestyle !== "steady" && lifestyle !== "daily") return null;
  if (distraction !== "often" && distraction !== "sometimes" && distraction !== "rare") {
    return null;
  }
  return { attention, lifestyle, distraction };
}

export function parseCustomizationInput(formData: FormData) {
  const answers = parseBehaviorAnswers({
    attention: String(formData.get("attention") ?? ""),
    lifestyle: String(formData.get("lifestyle") ?? ""),
    distraction: String(formData.get("distraction") ?? ""),
  });
  const modeValue = String(formData.get("studyMode") ?? "");
  const minutes = Number(formData.get("sessionMinutes"));
  const weekdays = parseStudyWeekdaysInput(String(formData.get("studyWeekdays") ?? ""));
  if (!answers) return { error: "Answer all three behavior questions." } as const;
  if (!isStudyMode(modeValue)) return { error: "Choose a study mode." } as const;
  if (!isSessionMinutes(minutes)) {
    return { error: "Pick a daily goal of 30, 60, or 90 minutes." } as const;
  }
  if (!weekdays) return { error: "Pick at least one study day this week." } as const;
  const plan = adjustPlan(modeValue, minutes, weekdays);
  return { error: "", answers, plan } as const;
}

export function customizationMigrationMessage(message: string | null) {
  if (!message) return null;
  if (/permission denied/i.test(message)) {
    return "The study plan could not be saved. Run migration 0022 (and 0044 if needed) in the Supabase SQL editor, then try again.";
  }
  if (
    /study_mode|monthly_session_goal|weekly_study_days|customization_completed|behavior_answers|schema cache/i.test(
      message,
    )
  ) {
    return "The study-mode columns are missing. Run migrations 0021 and 0044 in the Supabase SQL editor, then refresh.";
  }
  return null;
}

export function describeWeeklyBreakdown(plan: StudyPlan) {
  return {
    sessionMinutes: plan.sessionMinutes,
    studyWeekdays: plan.studyWeekdays,
    studyDaysPerWeek: plan.studyDaysPerWeek,
    weeklyMinutes: plan.studyDaysPerWeek * plan.sessionMinutes,
    weekdayLabels: formatStudyWeekdays(plan.studyWeekdays),
  };
}
