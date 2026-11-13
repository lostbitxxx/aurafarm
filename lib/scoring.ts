import { createHash, randomBytes } from "node:crypto";

const LAUNCH_CODE_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";

export function createSessionSecret() {
  return randomBytes(32).toString("base64url");
}

export function createLaunchCode() {
  const bytes = randomBytes(10);
  let code = "";
  for (const byte of bytes) {
    code += LAUNCH_CODE_ALPHABET[byte % LAUNCH_CODE_ALPHABET.length];
  }
  return code;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const MAX_BLOCKED_HOSTS = 20;

export type ScoreRequest = {
  token: string;
  durationSeconds: number;
  blockedCount: number;
  blockedHosts: string[];
  localDay: string;
};

function parseLocalDayField(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value;
}

export function parseScoreRequest(
  body: unknown,
): ({ ok: true } & ScoreRequest) | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "The score body must be an object." };
  }

  const record = body as Record<string, unknown>;
  const durationSeconds = record.duration_seconds;
  const blockedCount = record.blocked_count;
  const blockedHosts = record.blocked_hosts;
  const localDay = parseLocalDayField(record.local_day);
  if (typeof record.token !== "string" || record.token.length === 0) {
    return { ok: false, error: "A session token is required." };
  }
  if (typeof durationSeconds !== "number" || !Number.isInteger(durationSeconds) || durationSeconds < 0) {
    return { ok: false, error: "Duration must be a whole number of seconds." };
  }
  if (typeof blockedCount !== "number" || !Number.isInteger(blockedCount) || blockedCount < 0) {
    return { ok: false, error: "Blocked count must be a whole number." };
  }
  if (!Array.isArray(blockedHosts) || blockedHosts.some((host) => typeof host !== "string")) {
    return { ok: false, error: "Blocked hosts must be a list of names." };
  }
  if (localDay === undefined || localDay === null) {
    return { ok: false, error: "Local day must be YYYY-MM-DD." };
  }

  return {
    ok: true,
    token: record.token,
    durationSeconds,
    blockedCount,
    blockedHosts: blockedHosts.slice(0, MAX_BLOCKED_HOSTS),
    localDay,
  };
}

export function buildScoreResult(
  origin: string,
  sessionId: string,
  xp: number,
  distracted: boolean,
) {
  const normalized = origin.replace(/\/$/, "");
  return {
    xp,
    distracted,
    url: `${normalized}/dashboard/sessions/${sessionId}`,
  };
}
