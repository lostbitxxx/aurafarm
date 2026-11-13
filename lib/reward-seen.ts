const listeners = new Set<() => void>();

function seenRewardKey(userId: string) {
  return `aurafarm.level-reward.seen.${userId}`;
}

export function subscribeSeenRewards(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readSeenSnapshot(userId: string) {
  return localStorage.getItem(seenRewardKey(userId)) ?? "";
}

export function readServerSeenSnapshot() {
  return null;
}

export function parseSeenRewards(raw: string | null) {
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set<string>();
  }
}

export function rememberSeenRewards(userId: string, ids: readonly string[]) {
  const next = parseSeenRewards(localStorage.getItem(seenRewardKey(userId)));
  for (const id of ids) next.add(id);
  const stored = [...next].slice(-200);
  localStorage.setItem(seenRewardKey(userId), JSON.stringify(stored));
  for (const listener of listeners) listener();
}
