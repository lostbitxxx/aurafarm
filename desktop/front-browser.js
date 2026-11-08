/** Asks Safari, Chrome, or Edge for the active tab of the front window. */

const { execFile } = require("node:child_process");

const FRONT_BROWSERS = ["Safari", "Google Chrome", "Microsoft Edge"];
const OSA_TIMEOUT_MS = 20_000;

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

function supportedFrontBrowser(appName) {
  return FRONT_BROWSERS.includes(appName);
}

function runOsascript(statement) {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", statement],
      { timeout: OSA_TIMEOUT_MS },
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

module.exports = {
  FRONT_BROWSERS,
  frontAppStatement,
  frontUrlStatement,
  readFrontBrowser,
  supportedFrontBrowser,
};
