import { createSessionSecret, hashSecret } from "./scoring";

export const HEARTBEAT_INTERVAL_MS = 10_000;
export const HEARTBEAT_FRESH_MS = 30_000;

const DEFAULT_LABEL = "Windows pet";

export function createDeviceToken() {
  return createSessionSecret();
}

export function isDeviceFresh(lastSeenAt: string | null, nowMs: number) {
  if (!lastSeenAt) return false;
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return false;
  return nowMs - seen <= HEARTBEAT_FRESH_MS;
}

export function isAnyDeviceFresh(stamps: Array<string | null>, nowMs: number) {
  return stamps.some((stamp) => isDeviceFresh(stamp, nowMs));
}

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

export function buildPairLaunchUrl(token: string) {
  const params = new URLSearchParams({ token });
  return `aurafarm://pair?${params.toString()}`;
}

export function readBearerToken(header: string | null) {
  if (!header) return "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? "";
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

export function normalizeLaunchCode(value: string) {
  const trimmed = value.trim();
  const fromLink = /^aurafarm:\/\/session\?code=([A-Za-z0-9]+)$/i.exec(trimmed);
  return fromLink?.[1] ?? trimmed;
}

export function deviceLabel(value: unknown) {
  if (typeof value !== "string") return DEFAULT_LABEL;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return DEFAULT_LABEL;
  return trimmed.slice(0, 64);
}

export function hashDeviceToken(token: string) {
  return hashSecret(token);
}
