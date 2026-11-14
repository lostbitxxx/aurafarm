/** Asks Safari, Chrome, or Edge for the active tab of the front window. */

const { execFile } = require("node:child_process");

const FRONT_BROWSERS = ["Safari", "Google Chrome", "Microsoft Edge"];
const OSA_TIMEOUT_MS = 20_000;
const CLOSE_TIMEOUT_MS = 8_000;

function frontAppStatement() {
  return 'tell application "System Events" to get name of first application process whose frontmost is true';
}

function frontUrlStatement(appName) {
  if (appName === "Safari") {
    return 'tell application "Safari" to get URL of current tab of front window';
  }
  if (appName === "Google Chrome") {
    return 'tell application "Google Chrome" to get URL of active tab of front window';
  }
  if (appName === "Microsoft Edge") {
    return 'tell application "Microsoft Edge" to get URL of active tab of front window';
  }
  return "";
}

function frontWindowBoundsStatement(appName) {
  if (!supportedFrontBrowser(appName)) return "";
  return `tell application ${JSON.stringify(appName)} to get bounds of front window`;
}

function frontCloseStatement(appName) {
  if (!supportedFrontBrowser(appName)) return "";
  const tab = appName === "Safari" ? "current tab" : "active tab";
  return `tell application ${JSON.stringify(appName)}
set targetTab to ${tab} of front window
close targetTab
end tell`;
}

function supportedFrontBrowser(appName) {
  return FRONT_BROWSERS.includes(appName);
}

function scoreBrowserName(appName) {
  const name = typeof appName === "string" ? appName.trim() : "";
  if (!name || name === "Electron" || name === "Aurafarm") return "";
  return name;
}

function isBrowserBundle(bundleId) {
  const id = String(bundleId || "").toLowerCase();
  return /safari|chrome|firefox|mozilla|edgemac|brave|opera|vivaldi|thebrowser|chromium|duckduckgo|waterfox|librewolf|orion|comet|yandex|whale|floorp|helium/.test(id);
}

const BROWSER_APP_NAMES = new Set([
  "Safari",
  "Safari Technology Preview",
  "Google Chrome",
  "Google Chrome Canary",
  "Microsoft Edge",
  "Arc",
  "Dia",
  "Firefox",
  "Firefox Developer Edition",
  "Brave Browser",
  "Orion",
  "Vivaldi",
  "Opera",
  "Opera GX",
  "Chromium",
  "Comet",
  "Zen Browser",
  "DuckDuckGo",
  "Helium",
  "Floorp",
  "LibreWolf",
  "Waterfox",
  "NAVER Whale",
  "Yandex",
  "Atlas",
  "SigmaOS",
  "Wavebox",
  "Sidekick",
  "Thorium",
  "Mullvad Browser",
]);

function browserAppName(appName, bundleId) {
  const name = scoreBrowserName(appName);
  if (!name) return "";
  if (BROWSER_APP_NAMES.has(name) || isBrowserBundle(bundleId)) return name;
  return "";
}

function frontIdentityStatement() {
  return 'tell application "System Events" to get {name, bundle identifier} of first application process whose frontmost is true';
}

function parseFrontIdentity(value) {
  const text = String(value || "").trim();
  const parts = text.split(", ");
  if (parts.length < 2) return { name: text, bundleId: "" };
  return { name: parts.slice(0, -1).join(", ").trim(), bundleId: parts[parts.length - 1].trim() };
}

function browserRunningStatement(appName) {
  return `tell application "System Events" to (name of processes) contains ${JSON.stringify(appName)}`;
}

function deskTabProbeStatement(appName, host) {
  if (!supportedFrontBrowser(appName)) return "";
  const needle = typeof host === "string" ? host.trim() : "";
  if (!needle) return "";
  return `tell application ${JSON.stringify(appName)}
set needle to ${JSON.stringify(needle)}
repeat with w in windows
repeat with t in tabs of w
try
if URL of t contains needle then return "yes"
end try
end repeat
end repeat
return "no"
end tell`;
}

async function readScoreBrowser(deskHost) {
  if (process.platform !== "darwin") return "";
  const app = await runOsascript(frontAppStatement());
  const named = app.ok ? scoreBrowserName(app.value) : "";
  const host = typeof deskHost === "string" ? deskHost.trim() : "";
  let chosen = named;
  if (!chosen && host) {
    for (const appName of FRONT_BROWSERS) {
      const running = await runOsascript(browserRunningStatement(appName));
      if (!running.ok || running.value !== "true") continue;
      const statement = deskTabProbeStatement(appName, host);
      if (!statement) continue;
      const probe = await runOsascript(statement);
      if (probe.ok && probe.value === "yes") {
        chosen = appName;
        break;
      }
    }
  }
  return chosen;
}

function runOsascript(statement, timeout = OSA_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", statement],
      { timeout },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || error.message || "osascript failed").trim();
          resolve({ ok: false, value: "", error: detail });
          return;
        }
        resolve({ ok: true, value: String(stdout ?? "").trim(), error: "" });
      },
    );
  });
}

async function readFrontAppName() {
  if (process.platform !== "darwin") return { ok: false, name: "", error: "Not macOS." };
  const app = await runOsascript(frontAppStatement());
  if (!app.ok) return { ok: false, name: "", error: app.error };
  return { ok: true, name: app.value, error: "" };
}

async function readFrontIdentity() {
  if (process.platform !== "darwin") return { ok: false, name: "", bundleId: "", error: "" };
  const result = await runOsascript(frontIdentityStatement());
  if (!result.ok) return { ok: false, name: "", bundleId: "", error: result.error };
  const parsed = parseFrontIdentity(result.value);
  return { ok: true, name: parsed.name, bundleId: parsed.bundleId, error: "" };
}

async function readFrontBrowser() {
  if (process.platform !== "darwin") return { app: "", url: "", error: "" };
  const app = await runOsascript(frontAppStatement());
  if (!app.ok) return { app: "", url: "", error: app.error };
  const statement = frontUrlStatement(app.value);
  if (!statement) return { app: app.value, url: "", error: "" };
  const url = await runOsascript(statement);
  if (!url.ok) return { app: app.value, url: "", error: url.error };
  return { app: app.value, url: url.value, error: "" };
}

async function readFrontWindowBounds(appName) {
  if (process.platform !== "darwin") return { ok: false, value: "", error: "Not macOS." };
  const statement = frontWindowBoundsStatement(appName);
  if (!statement) return { ok: false, value: "", error: "" };
  return runOsascript(statement);
}

async function closeFrontWindow(appName) {
  if (process.platform !== "darwin") return { ok: false, error: "Not macOS." };
  const statement = frontCloseStatement(appName);
  if (!statement) return { ok: false, error: "" };
  const result = await runOsascript(statement, CLOSE_TIMEOUT_MS);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, error: "" };
}

module.exports = {
  CLOSE_TIMEOUT_MS,
  FRONT_BROWSERS,
  closeFrontWindow,
  frontAppStatement,
  frontCloseStatement,
  browserAppName,
  deskTabProbeStatement,
  frontIdentityStatement,
  frontUrlStatement,
  isBrowserBundle,
  parseFrontIdentity,
  frontWindowBoundsStatement,
  readFrontAppName,
  readFrontBrowser,
  readFrontIdentity,
  readFrontWindowBounds,
  readScoreBrowser,
  scoreBrowserName,
  supportedFrontBrowser,
};
