export const STUDY_MODES = ["assassin", "knight", "lord"] as const;

export type StudyMode = (typeof STUDY_MODES)[number];

export type BehaviorAnswers = {
  attention: "short" | "medium" | "long";
  lifestyle: "few" | "steady" | "daily";
  distraction: "often" | "sometimes" | "rare";
};

export type StudyPlan = {
  mode: StudyMode;
  sessionMinutes: number;
  monthlySessions: number;
  dailySessions: number;
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
    hint: "Your honest attention span — not your ideal one.",
    options: [
      { value: "short", label: "Under 15 minutes", detail: "Quick bursts fit you best." },
      { value: "medium", label: "About 30–60 minutes", detail: "A normal study block." },
      { value: "long", label: "Over an hour", detail: "You can settle into deep work." },
    ],
  },
  {
    id: "lifestyle",
    prompt: "How many days a week can you realistically study?",
    hint: "Count only days you can protect, not hope for.",
    options: [
      { value: "few", label: "2–3 days", detail: "Sparse but intentional." },
      { value: "steady", label: "4–5 days", detail: "A steady school week." },
      { value: "daily", label: "6–7 days", detail: "Almost every day." },
    ],
  },
  {
    id: "distraction",
    prompt: "When you study, how often do phones or social pull you away?",
    hint: "This shapes how strict your study mode should feel.",
    options: [
      { value: "often", label: "Often", detail: "Distractions pretty easily." },
      { value: "sometimes", label: "Sometimes", detail: "It depends on the day." },
      { value: "rare", label: "Rarely", detail: "You usually stay on track." },
    ],
  },
];

const MODE_META: Record<
  StudyMode,
  { name: string; tagline: string; sessionMinutes: number; baseMonthly: number }
> = {
  assassin: {
    name: "Assassin",
    tagline: "Short strikes for heavy distractors.",
    sessionMinutes: 15,
    baseMonthly: 40,
  },
  knight: {
    name: "Knight",
    tagline: "Steady blocks for a normal focus day.",
    sessionMinutes: 60,
    baseMonthly: 20,
  },
  lord: {
    name: "Lord",
    tagline: "Long sessions for high-focus farmers.",
    sessionMinutes: 90,
    baseMonthly: 12,
  },
};

const LIFESTYLE_DAYS: Record<BehaviorAnswers["lifestyle"], number> = {
  few: 3,
  steady: 5,
  daily: 6,
};

const LIFESTYLE_MONTHLY_FACTOR: Record<BehaviorAnswers["lifestyle"], number> = {
  few: 0.75,
  steady: 1,
  daily: 1.2,
};

export function isStudyMode(value: unknown): value is StudyMode {
  return typeof value === "string" && (STUDY_MODES as readonly string[]).includes(value);
}

export function modeLabel(mode: StudyMode) {
  return MODE_META[mode].name;
}

export function modeTagline(mode: StudyMode) {
  return MODE_META[mode].tagline;
}

export function studyDaysPerWeek(lifestyle: BehaviorAnswers["lifestyle"]) {
  return LIFESTYLE_DAYS[lifestyle];
}

export function dailySessionsFromMonthly(monthlySessions: number, daysPerWeek: number) {
  const monthly = Math.max(1, Math.floor(monthlySessions));
  const weeks = 4;
  const studyDays = Math.max(1, daysPerWeek) * weeks;
  return Math.max(1, Math.round(monthly / studyDays));
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
): StudyPlan {
  const meta = MODE_META[mode];
  const daysPerWeek = studyDaysPerWeek(lifestyle);
  const monthlySessions = Math.max(
    1,
    Math.round(meta.baseMonthly * LIFESTYLE_MONTHLY_FACTOR[lifestyle]),
  );
  return {
    mode,
    sessionMinutes: meta.sessionMinutes,
    monthlySessions,
    dailySessions: dailySessionsFromMonthly(monthlySessions, daysPerWeek),
    studyDaysPerWeek: daysPerWeek,
  };
}

export function adjustPlan(
  mode: StudyMode,
  monthlySessions: number,
  daysPerWeek: number,
): StudyPlan {
  const monthly = Math.max(1, Math.min(120, Math.floor(monthlySessions)));
  const days = Math.max(1, Math.min(7, Math.floor(daysPerWeek)));
  return {
    mode,
    sessionMinutes: MODE_META[mode].sessionMinutes,
    monthlySessions: monthly,
    dailySessions: dailySessionsFromMonthly(monthly, days),
    studyDaysPerWeek: days,
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
  const monthly = Number(formData.get("monthlySessions"));
  if (!answers) return { error: "Answer all three behavior questions." } as const;
  if (!isStudyMode(modeValue)) return { error: "Choose a study mode." } as const;
  if (!Number.isInteger(monthly) || monthly < 1 || monthly > 120) {
    return { error: "Pick a monthly goal between 1 and 120 sessions." } as const;
  }
  const plan = adjustPlan(modeValue, monthly, studyDaysPerWeek(answers.lifestyle));
  return { error: "", answers, plan } as const;
}

export function customizationMigrationMessage(message: string | null) {
  if (!message) return null;
  if (/study_mode|monthly_session_goal|customization_completed|behavior_answers/i.test(message)) {
    return "The study-mode columns are missing. Run migration 0021 in the Supabase SQL editor, then refresh.";
  }
  return message;
}

export function describeDailyBreakdown(plan: StudyPlan) {
  const studyDays = plan.studyDaysPerWeek * 4;
  return {
    sessionMinutes: plan.sessionMinutes,
    monthlySessions: plan.monthlySessions,
    dailySessions: plan.dailySessions,
    studyDaysPerWeek: plan.studyDaysPerWeek,
    studyDaysPerMonth: studyDays,
    monthlyMinutes: plan.monthlySessions * plan.sessionMinutes,
  };
}
