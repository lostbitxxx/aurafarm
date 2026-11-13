/** Builds the score the pet submits when the user finishes a session. */

function finishLabel(blockedCount) {
  return blockedCount > 0 ? "Finish distracted session" : "Finish focused session";
}

function wholeSecondsSince(startedAt, nowMs) {
  if (typeof startedAt !== "number" || typeof nowMs !== "number") return 0;
  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}

function openDistractionMs(log, nowMs) {
  const base = Number.isFinite(log?.distractionMs) ? Math.max(0, log.distractionMs) : 0;
  const sampledAt = log?.sampledAt;
  if (log?.onBlocklist && typeof sampledAt === "number" && typeof nowMs === "number" && nowMs >= sampledAt) {
    return base + (nowMs - sampledAt);
  }
  return base;
}

function distractionSeconds(study, nowMs) {
  const duration = wholeSecondsSince(study?.startedAt, nowMs);
  const seconds = Math.floor(openDistractionMs(study?.log, nowMs) / 1000);
  return Math.min(duration, Math.max(0, seconds));
}

function scoreRequestBody(study, nowMs) {
  const hosts = Array.isArray(study?.distractedHosts)
    ? study.distractedHosts
    : Array.isArray(study?.log?.blockedHosts)
      ? study.log.blockedHosts
      : [];
  return {
    token: typeof study?.token === "string" ? study.token : "",
    duration_seconds: wholeSecondsSince(study?.startedAt, nowMs),
    blocked_count: Number.isInteger(study?.log?.blockedCount) ? study.log.blockedCount : 0,
    blocked_hosts: hosts.filter((host) => typeof host === "string").slice(0, 20),
    distraction_seconds: distractionSeconds(study, nowMs),
  };
}

function scorePageUrl(origin, sessionId) {
  return `${String(origin || "").replace(/\/$/, "")}/dashboard/sessions/${sessionId}`;
}

function usableApiOrigin(candidates) {
  const list = Array.isArray(candidates) ? candidates : [candidates];
  for (const candidate of list) {
    const value = String(candidate ?? "").trim().replace(/\/$/, "");
    if (!value || value.startsWith("#")) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      return url.origin;
    } catch {
      continue;
    }
  }
  return "http://localhost:3000";
}

function interpretScoreResponse(status, body, origin, sessionId) {
  if (status === 200 && body && typeof body.url === "string" && body.url) {
    return { ok: true, url: body.url, clearToken: true, message: "Score sent." };
  }
  if (status === 409) {
    return {
      ok: true,
      url: scorePageUrl(origin, sessionId),
      clearToken: true,
      message: "That session was already scored.",
    };
  }
  return {
    ok: false,
    url: "",
    clearToken: false,
    message: "Could not submit the score. Try again.",
  };
}

module.exports = {
  distractionSeconds,
  finishLabel,
  interpretScoreResponse,
  scorePageUrl,
  scoreRequestBody,
  usableApiOrigin,
  wholeSecondsSince,
};
