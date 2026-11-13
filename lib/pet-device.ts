export function petDownloadUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseClaimCode(
  body: unknown,
): { ok: true; code: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "The claim body must be an object." };
  }
  const code = (body as { code?: unknown }).code;
  if (typeof code !== "string") {
    return { ok: false, error: "A launch code is required." };
  }
  const normalized = normalizeLaunchCode(code);
  if (!/^[A-Za-z0-9]{4,32}$/.test(normalized)) {
    return { ok: false, error: "A launch code is required." };
  }
  return { ok: true, code: normalized };
}

export type AcceptedClaim = {
  sessionId: string;
  petType: string;
  level: number;
  blocklist: string[];
  closeBlocked: boolean;
  plannedSeconds: number;
  startedAt: string;
  claimedAt: string;
};

function wholeNumber(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

/**
 * A claim is usable when the session id and pet come back.
 * claimed_at is only present after migration 0029. Older functions still
 * claim the code, so a missing timestamp uses the moment this response is read.
 */
export function acceptedClaimRow(data: unknown, now = new Date()): AcceptedClaim | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const level = wholeNumber(record.level);
  const plannedSeconds = wholeNumber(record.planned_seconds);
  if (typeof record.session_id !== "string" || typeof record.pet_type !== "string") return null;
  if (level === null || plannedSeconds === null) return null;
  if (typeof record.started_at !== "string") return null;
  const claimedAt = typeof record.claimed_at === "string" ? record.claimed_at : now.toISOString();
  const blocklist = Array.isArray(record.blocklist)
    ? record.blocklist.filter((host): host is string => typeof host === "string")
    : [];
  return {
    sessionId: record.session_id,
    petType: record.pet_type,
    level,
    blocklist,
    closeBlocked: record.close_blocked === true,
    plannedSeconds,
    startedAt: record.started_at,
    claimedAt,
  };
}

export function normalizeLaunchCode(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "aurafarm:" && url.hostname === "session") {
      return url.searchParams.get("code") ?? "";
    }
  } catch {
    // A pasted launch code is not a URL.
  }
  return trimmed;
}
