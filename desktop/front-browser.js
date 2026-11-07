/** Asks Safari, Chrome, or Edge for the active tab of the front window. */

const { execFile } = require("node:child_process");

const FRONT_BROWSERS = ["Safari", "Google Chrome", "Microsoft Edge"];

function frontBrowserScript() {
  return `
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell
if frontApp is "Safari" then
  tell application "Safari"
    if (count of windows) is 0 then return ""
    return URL of current tab of front window
  end tell
else if frontApp is "Google Chrome" then
  tell application "Google Chrome"
    if (count of windows) is 0 then return ""
    return URL of active tab of front window
  end tell
else if frontApp is "Microsoft Edge" then
  tell application "Microsoft Edge"
    if (count of windows) is 0 then return ""
    return URL of active tab of front window
  end tell
else
  return ""
end if
`.trim();
}

function supportedFrontBrowser(appName) {
  return FRONT_BROWSERS.includes(appName);
}

function readFrontBrowserUrl() {
  if (process.platform !== "darwin") return Promise.resolve("");
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", frontBrowserScript()],
      { timeout: 3000 },
      (error, stdout) => {
        if (error) {
          resolve("");
          return;
        }
        resolve(String(stdout ?? "").trim());
      },
    );
  });
}

module.exports = {
  FRONT_BROWSERS,
  frontBrowserScript,
  readFrontBrowserUrl,
  supportedFrontBrowser,
};
