import { createHash, randomBytes } from "node:crypto";

export const FOCUSED_SCORE = 100;
export const DISTRACTED_SCORE = 40;

const LAUNCH_CODE_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";

export function scoreForBlockedCount(blockedCount: number) {
  return blockedCount > 0 ? DISTRACTED_SCORE : FOCUSED_SCORE;
}

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
};

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

  return {
    ok: true,
    token: record.token,
    durationSeconds,
    blockedCount,
    blockedHosts: blockedHosts.slice(0, MAX_BLOCKED_HOSTS),
  };
}

export function buildScoreResult(
  origin: string,
  sessionId: string,
  points: number,
  distracted: boolean,
) {
  const normalized = origin.replace(/\/$/, "");
  return {
    points,
    distracted,
    url: `${normalized}/dashboard/sessions/${sessionId}`,
  };
}
