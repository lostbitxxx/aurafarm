/** Counts blocklist visits from the one frontmost browser tab. */

const BLOCKED = ["instagram.com", "tiktok.com", "youtube.com"];

function normalizeHost(host) {
  const normalized = String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!normalized || /[\s/:]/.test(normalized)) return "";
  return normalized;
}

function hostMatchesBlocklist(host, blockedHosts) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return blockedHosts.some((blocked) => {
    const rule = normalizeHost(blocked);
    if (!rule) return false;
    return normalized === rule || normalized.endsWith(`.${rule}`);
  });
}

function hostnameFromUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  return normalizeHost(url.hostname);
}

function deskHostFromOrigin(origin) {
  if (typeof origin !== "string" || !origin.trim()) return "";
  try {
    return normalizeHost(new URL(origin).hostname);
  } catch {
    return "";
  }
}

function createFrontLog() {
  return { blockedCount: 0, blockedHosts: [], currentHost: "" };
}

function recordFrontHost(log, rawUrl, blocklist, deskHost, matches = hostMatchesBlocklist) {
  const host = hostnameFromUrl(rawUrl);
  if (!host) return log;
  if (host === log.currentHost) return log;

  const next = {
    blockedCount: log.blockedCount,
    blockedHosts: log.blockedHosts.slice(),
    currentHost: host,
  };
  if (host === normalizeHost(deskHost)) return next;
  if (matches(host, blocklist ?? BLOCKED)) {
    next.blockedCount += 1;
    if (!next.blockedHosts.includes(host)) next.blockedHosts.push(host);
  }
  return next;
}

function nextFrontLog(active, log, rawUrl, blocklist, deskHost) {
  if (!active) return log;
  return recordFrontHost(log, rawUrl, blocklist, deskHost);
}

module.exports = {
  BLOCKED,
  createFrontLog,
  deskHostFromOrigin,
  hostMatchesBlocklist,
  hostnameFromUrl,
  nextFrontLog,
  recordFrontHost,
};
