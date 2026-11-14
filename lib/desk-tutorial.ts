export const DESK_TUTORIAL_STEPS = [
  {
    id: "shop",
    target: "shop",
    kind: "dialog",
    section: "shop",
    title: "Shop",
    body: "Click Shop to see what is inside.",
  },
  {
    id: "collection",
    target: "collection",
    kind: "dialog",
    section: "collection",
    title: "Collection",
    body: "Click Collection to see what is inside.",
  },
  {
    id: "pets",
    target: "pets",
    kind: "dialog",
    section: "inventory",
    title: "Pets",
    body: "Click Pets to see what is inside.",
  },
  {
    id: "achievements",
    target: "achievements",
    kind: "dialog",
    section: "achievements",
    title: "Achievements",
    body: "Click Achievements to see what is inside.",
  },
  {
    id: "song",
    target: "song",
    kind: "dialog",
    section: "song",
    title: "Song",
    body: "Click Song to see what is inside.",
  },
  {
    id: "social",
    target: "social",
    kind: "social",
    title: "Social",
    body: "Click Social to see what is inside.",
  },
  {
    id: "start",
    target: "start",
    kind: "start",
    title: "Start studying",
    body: "Start a study session when you want a little focus.",
  },
] as const;

export type DeskTutorialStep = (typeof DESK_TUTORIAL_STEPS)[number];

const SOCIAL_SECTIONS = ["friends", "farmcrew", "social-settings", "leaderboard"] as const;

export type TutorialRecord = { status: "active"; step: number } | { status: "done" };

export function progressLabel(stepIndex: number, total = DESK_TUTORIAL_STEPS.length) {
  const current = Math.min(total, Math.max(1, Math.floor(stepIndex) + 1));
  return `${current}/${total}`;
}

export function tutorialStorageKey(userId: string) {
  return `aurafarm.tutorial.${userId}`;
}

export function sectionMatchesStep(step: DeskTutorialStep, section: string) {
  if (step.kind === "dialog") return step.section === section;
  if (step.kind === "social") return (SOCIAL_SECTIONS as readonly string[]).includes(section);
  return false;
}

export function parseTutorialRecord(raw: string | null): TutorialRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { status?: unknown; step?: unknown };
    if (parsed?.status === "done") return { status: "done" };
    if (parsed?.status === "active" && typeof parsed.step === "number" && Number.isInteger(parsed.step)) {
      const last = DESK_TUTORIAL_STEPS.length - 1;
      return { status: "active", step: Math.min(last, Math.max(0, parsed.step)) };
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeTutorialRecord(record: TutorialRecord) {
  return JSON.stringify(record);
}

export function readTutorialRecord(userId: string) {
  if (typeof window === "undefined") return null;
  return parseTutorialRecord(localStorage.getItem(tutorialStorageKey(userId)));
}

export function writeTutorialRecord(userId: string, record: TutorialRecord) {
  if (typeof window === "undefined") return;
  localStorage.setItem(tutorialStorageKey(userId), serializeTutorialRecord(record));
}
