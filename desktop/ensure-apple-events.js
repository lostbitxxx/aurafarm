/** Lets the dev Electron app ask macOS before it controls a browser. */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

if (process.platform !== "darwin") process.exit(0);

const app = path.join(__dirname, "node_modules", "electron", "dist", "Electron.app");
const plist = path.join(app, "Contents", "Info.plist");
const key = "NSAppleEventsUsageDescription";
const message =
  "Aurafarm reads the address of the front Safari, Chrome, or Edge tab during a study session.";

if (!fs.existsSync(plist)) process.exit(0);

const xml = fs.readFileSync(plist, "utf8");
if (!xml.includes(`<key>${key}</key>`)) {
  const entry = `\t<key>${key}</key>\n\t<string>${message}</string>\n`;
  fs.writeFileSync(plist, xml.replace("</dict>", `${entry}</dict>`));
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  } catch {
    console.error("Could not re-sign Electron. Start the pet again if macOS refuses to open it.");
  }
}
