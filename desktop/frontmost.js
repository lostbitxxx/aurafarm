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

const CLOSE_AFTER_MS = 60_000;

function createCloseWatch() {
  return { host: "", since: 0, attemptedHost: "", close: false };
}

function clearedCloseWatch() {
  return createCloseWatch();
}

function nextCloseWatch(watch, input) {
  const current = watch ?? createCloseWatch();
  if (!input?.enabled) return clearedCloseWatch();

  const host = hostnameFromUrl(input.rawUrl);
  if (!host) return { ...current, close: false };

  const desk = normalizeHost(input.deskHost);
  const closeable = host !== desk && hostMatchesBlocklist(host, input.blocklist ?? BLOCKED);
  if (!closeable) return clearedCloseWatch();

  const same = current.host === host && current.since > 0;
  const since = same ? current.since : input.now;
  const attemptedHost = same ? current.attemptedHost : "";
  const close = input.now - since >= CLOSE_AFTER_MS && attemptedHost !== host;
  return { host, since, attemptedHost, close };
}

function describeCloseDebug(input) {
  const toggle = input?.closeBlocked ? "on" : "off";
  const note = input?.preferenceError ? ` ${input.preferenceError}` : "";
  if (!input?.session) {
    return `Debug: no study session, so the pet is not watching the browser.${note}`;
  }
  const reading = input.reading;
  if (!reading) {
    return `Debug: session claimed. Close blocked tabs is ${toggle}.${note}`;
  }
  if (reading.error) {
    const detail = String(reading.error).split("\n")[0];
    return `Debug: close blocked tabs is ${toggle}. Could not read the front window. ${detail}${note}`;
  }
  const app = reading.app || "nothing";
  const host = hostnameFromUrl(reading.url || "");
  if (!host) {
    return `Debug: close blocked tabs is ${toggle}. Front app is ${app}. No page address.${note}`;
  }
  if (!input.closeBlocked) {
    return `Debug: front is ${host} in ${app}. Close blocked tabs is off.${note}`;
  }
  const decision = input.decision;
  if (!decision?.host) {
    return `Debug: front is ${host} in ${app}. Not on the blocklist, so it stays open.${note}`;
  }
  if (input.closeError) {
    const detail = String(input.closeError).split("\n")[0];
    return `Debug: close failed for ${decision.host}. ${detail}${note}`;
  }
  if (decision.close) return `Debug: closing ${decision.host} in ${app} now.${note}`;
  const waited = Math.max(0, Math.floor(((input.now ?? 0) - decision.since) / 1000));
  const limit = Math.round(CLOSE_AFTER_MS / 1000);
  return `Debug: ${decision.host} in ${app} for ${waited}s of ${limit}s.${note}`;
}

function noteCloseAttempt(watch) {
  return {
    host: watch?.host ?? "",
    since: watch?.since ?? 0,
    attemptedHost: watch?.host ?? "",
    close: false,
  };
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
    return `Watching. ${app} is in front.`;
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
  CLOSE_AFTER_MS,
  createCloseWatch,
  createFrontLog,
  deskHostFromOrigin,
  hostMatchesBlocklist,
  hostnameFromUrl,
  describeCloseDebug,
  describeFrontRead,
  nextCloseWatch,
  nextFrontLog,
  noteCloseAttempt,
  recordFrontHost,
};
