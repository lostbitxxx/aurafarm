export const DESK_TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome",
    body: "Welcome to Aurafarm! This is your little living room, shared with your pets.",
    targets: ["living-room"],
  },
  {
    id: "pet",
    title: "Pet status",
    body: "Tap your pet to check its status and level — this is your desk buddy.",
    targets: ["pet"],
  },
  {
    id: "rewards",
    title: "Study rewards",
    body: "Study to earn XP for your pets and coins for the room.",
    targets: ["coins", "pet-level"],
  },
  {
    id: "daily",
    title: "Daily goal",
    body: "Hit your daily goal on the cylinder — the calendar keeps your streak.",
    targets: ["daily-goal", "streak-calendar"],
  },
  {
    id: "adopt",
    title: "Adopt pets",
    body: "Level up to unlock more pets, then adopt and manage them here.",
    targets: ["shop"],
  },
  {
    id: "customize",
    title: "Customize",
    body: "Tap Edit Furniture to rearrange the room, then shop for new looks.",
    targets: ["edit-furniture"],
  },
  {
    id: "explore",
    title: "Explore",
    body: "There’s more to discover — rack, blackboard, and more as you progress.",
    targets: ["rack", "social"],
  },
  {
    id: "start",
    title: "Let’s start studying!",
    body: "Click Start studying to begin when you’re ready.",
    targets: ["start"],
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
