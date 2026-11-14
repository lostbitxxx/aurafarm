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
  frontUrlStatement,
  readFrontBrowser,
  supportedFrontBrowser,
};
