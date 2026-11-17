/** Client-only daily cylinder wipe for admin testing (no DB write). */

const STORAGE_PREFIX = "aurafarm.cylinderReset.";

export type CylinderReset = {
  localDay: string;
  resetAtMs: number;
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function readCylinderReset(userId: string): CylinderReset | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CylinderReset>;
    if (typeof parsed.localDay !== "string" || typeof parsed.resetAtMs !== "number") return null;
    if (!Number.isFinite(parsed.resetAtMs)) return null;
    return { localDay: parsed.localDay, resetAtMs: parsed.resetAtMs };
  } catch {
    return null;
  }
}

export function writeCylinderReset(userId: string, localDay: string, resetAtMs = Date.now()): CylinderReset {
  const next = { localDay, resetAtMs };
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event("aurafarm-cylinder-reset"));
  return next;
}

export function clearCylinderReset(userId: string) {
  localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(new Event("aurafarm-cylinder-reset"));
}

export function subscribeCylinderReset(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener("aurafarm-cylinder-reset", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("aurafarm-cylinder-reset", onChange);
  };
}

/** Drop submitted seconds that ended at or before the reset instant on that local day. */
export function filterSessionsAfterCylinderReset<
  T extends { endedAt: string; status: "submitted" | "cancelled" },
>(sessions: readonly T[], reset: CylinderReset | null, todayLocal: string): readonly T[] {
  if (!reset || reset.localDay !== todayLocal) return sessions;
  return sessions.filter((session) => {
    const ended = new Date(session.endedAt).getTime();
    if (Number.isNaN(ended)) return false;
    return ended > reset.resetAtMs;
  });
}

export function liveSessionCountsAfterCylinderReset(
  startedAt: string,
  reset: CylinderReset | null,
  todayLocal: string,
) {
  if (!reset || reset.localDay !== todayLocal) return true;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return false;
  return started > reset.resetAtMs;
}
