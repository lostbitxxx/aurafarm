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

function describeFrontRead(reading, log) {
  const error = reading?.error || "";
  if (error) {
    if (/1743|not authorized|not permitted|assistive access/i.test(error)) {
      return "Allow Electron to control System Events and your browser. System Settings, Privacy & Security, Automation. Then click the browser again.";
    }
    return `Could not read the front window. ${error.split("\n")[0]}`;
  }
  const app = reading?.app || "";
  if (app && app !== "Safari" && app !== "Google Chrome" && app !== "Microsoft Edge") {
    return `Watching. ${app} is in front. Click Chrome or Safari and leave it in front.`;
  }
  const host = hostnameFromUrl(reading?.url || "");
  if (!host) {
    return app
      ? `Watching. ${app} has no page address in front.`
      : "Watching. Nothing on the blocklist is in front.";
  }
  if (!log || log.blockedCount === 0) return `Watching. Front: ${host}`;
  return `Watching. Blocked ${log.blockedCount}: ${log.blockedHosts.join(", ")}`;
}

module.exports = {
  BLOCKED,
  createFrontLog,
  deskHostFromOrigin,
  hostMatchesBlocklist,
  hostnameFromUrl,
  describeFrontRead,
  nextFrontLog,
  recordFrontHost,
};
