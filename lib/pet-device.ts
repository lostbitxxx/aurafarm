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
