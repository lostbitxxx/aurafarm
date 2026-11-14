export const ACHIEVEMENTS = [
  {
    id: "true_colors",
    title: "True Colors",
    description: "Bring every pet color into your collection.",
  },
  {
    id: "hats_all",
    title: "Hats All, Folks!",
    description: "Unlock every hat and become a true hat collector.",
  },
  {
    id: "wardrobe",
    title: "Fashionably Complete",
    description: "Complete your pet's wardrobe.",
  },
  {
    id: "week_of_wisdom",
    title: "A Week of Wisdom",
    description: "Keep your study streak going for a full week.",
  },
  {
    id: "thirty_days",
    title: "Thirty Days, Zero Skips",
    description: "Keep your study streak going for an entire month.",
  },
  {
    id: "top_20",
    title: "Welcome to the Top 20",
    description: "Study your way into the top 20.",
  },
  {
    id: "on_your_left",
    title: "On your left",
    description: "Overtake a friend by studying more than they do.",
  },
  {
    id: "blend_in",
    title: "Blend In with Nature",
    description: 'Dress your pet in the "Flower Day: Daisy Clip" and no clothes.',
  },
  {
    id: "new_friend",
    title: "A New Friend",
    description: "Meet your new friend!",
  },
  {
    id: "study_buddies",
    title: "Study Buddies",
    description: "Add a friend.",
  },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((achievement) => achievement.id));

export function earnedAchievementIds(ids: readonly unknown[]): AchievementId[] {
  return ids.filter((id): id is AchievementId => typeof id === "string" && ACHIEVEMENT_IDS.has(id));
}

export function achievementsMigrationMessage(message: string | null) {
  if (!message) return null;
  if (/evaluate_achievements|user_achievements|schema cache/i.test(message)) {
    return "Run migration 0038 before using achievements.";
  }
  return message;
}
