export const DESK_TUTORIAL_STEPS = [
  {
    id: "shop",
    target: "shop",
    kind: "dialog",
    section: "inventory",
    title: "Shelter",
    body: "Click the pet shelter to open your pets and unlock the next one.",
    openBody: "Unlock the next pet here, then equip one for the desk.",
  },
  {
    id: "collection",
    target: "collection",
    kind: "dialog",
    section: "collection",
    title: "Collection",
    body: "Click the clothes drawer on the rack to open your Collection.",
    openBody: "Browse and wear colors, hats, and clothes you unlock here.",
  },
  {
    id: "pets",
    target: "shop",
    kind: "dialog",
    section: "inventory",
    title: "Pets",
    body: "Click the pet shelter to view, equip, and customize your pets.",
    openBody: "See your pets, equip one for the desk, and open pet details here.",
  },
  {
    id: "achievements",
    target: "achievements",
    kind: "dialog",
    section: "achievements",
    title: "Achievements",
    body: "Click the trophy on the rack to see your Achievements.",
    openBody: "Track milestones and badges you've earned here.",
  },
  {
    id: "song",
    target: "song",
    kind: "dialog",
    section: "song",
    title: "Song",
    body: "Click the gramophone on the rack to play Song.",
    openBody: "Play unlocked study songs and control volume here.",
  },
  {
    id: "social",
    target: "social",
    kind: "dialog",
    section: "social",
    title: "Blackboard",
    body: "Click the blackboard to open friends, crews, and the leaderboard.",
    openBody: "Manage friends, farm crews, and the leaderboard here.",
  },
  {
    id: "start",
    target: "start",
    kind: "start",
    title: "Start studying",
    body: "Click Start studying to begin a focus session.",
  },
  {
    id: "replay",
    target: "settings",
    kind: "settings",
    title: "Replay later",
    body: "Click Settings anytime, then choose Replay tutorial to see this guide again.",
  },
] as const;

export type DeskTutorialStep = (typeof DESK_TUTORIAL_STEPS)[number];

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
