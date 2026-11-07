/** Builds the score the pet submits when the user finishes a session. */

function finishLabel(blockedCount) {
  return blockedCount > 0 ? "Finish distracted session" : "Finish focused session";
}

function wholeSecondsSince(startedAt, nowMs) {
  if (typeof startedAt !== "number" || typeof nowMs !== "number") return 0;
  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}

function scoreRequestBody(study, nowMs) {
  const hosts = Array.isArray(study?.log?.blockedHosts) ? study.log.blockedHosts : [];
  return {
    token: typeof study?.token === "string" ? study.token : "",
    duration_seconds: wholeSecondsSince(study?.startedAt, nowMs),
    blocked_count: Number.isInteger(study?.log?.blockedCount) ? study.log.blockedCount : 0,
    blocked_hosts: hosts.filter((host) => typeof host === "string").slice(0, 20),
  };
}

function scorePageUrl(origin, sessionId) {
  return `${String(origin || "").replace(/\/$/, "")}/dashboard/sessions/${sessionId}`;
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
  finishLabel,
  interpretScoreResponse,
  scorePageUrl,
  scoreRequestBody,
  wholeSecondsSince,
};
