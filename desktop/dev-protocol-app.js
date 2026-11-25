/** macOS dev handler for aurafarm:// when the pet is not already running. */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEV_BUNDLE_ID = "app.aurafarm.pet.protocol";
const HANDLER_VERSION = "1";
const PROTOCOL = "aurafarm";
const HANDLER_APP_NAME = "Aurafarm Protocol.app";

const APPLE_EVENTS_DESCRIPTION =
  "Aurafarm reads the address of the front Safari, Chrome, or Edge tab during a study session, and closes that tab when close blocked tabs is on.";

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function electronBundleFromExecutable(executable) {
  const resolved = path.resolve(executable);
  const contentsDir = path.dirname(path.dirname(resolved));
  const bundle = path.dirname(contentsDir);
  if (path.basename(contentsDir) !== "Contents" || !bundle.endsWith(".app")) {
    throw new Error(`Not an Electron app bundle: ${executable}`);
  }
  return bundle;
}

function defaultElectronExecutable(desktopDir) {
  const packageDir = path.join(desktopDir, "node_modules", "electron");
  const pathFile = path.join(packageDir, "path.txt");
  if (fs.existsSync(pathFile)) {
    const relative = fs.readFileSync(pathFile, "utf8").trim();
    if (relative) return path.join(packageDir, "dist", relative);
  }
  return path.join(packageDir, "dist", "Electron.app", "Contents", "MacOS", "Electron");
}

function pendingLaunchFile(desktopDir) {
  return path.join(desktopDir, ".dev-app", "pending-link");
}

/**
 * AppleScript applet that Launch Services opens for aurafarm://.
 * setAsDefaultProtocolClient ignores the app path on macOS, so a cold open
 * runs Electron.app with no directory and shows the default
 * "Electron path-to-app" window. This applet stores the URL, then starts the
 * Electron binary with the pet directory — the same argv as `electron .`.
 */
function protocolHandlerScript({ electronBin, appDir, pendingFile }) {
  const bin = appleScriptString(electronBin);
  const dir = appleScriptString(appDir);
  const pending = appleScriptString(pendingFile);
  const pendingDir = appleScriptString(path.dirname(pendingFile));
  const launch = `"nohup " & quoted form of ${bin} & " " & quoted form of ${dir} & " >/dev/null 2>&1 &"`;
  return `on run
  do shell script ${launch}
end run

on open location theURL
  do shell script "mkdir -p " & quoted form of ${pendingDir} & " && printf %s " & quoted form of (theURL & linefeed) & " > " & quoted form of ${pending} & " && " & ${launch}
end open location
`;
}

function insertBeforeLastDictClose(xml, entry) {
  const index = xml.lastIndexOf("</dict>");
  if (index === -1) throw new Error("Info.plist is missing a dict");
  return `${xml.slice(0, index)}${entry}${xml.slice(index)}`;
}

function upsertPlistString(xml, key, value) {
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[\\s\\S]*?(</string>)`);
  if (pattern.test(xml)) return xml.replace(pattern, `$1${escaped}$2`);
  return insertBeforeLastDictClose(xml, `\t<key>${key}</key>\n\t<string>${escaped}</string>\n`);
}

function upsertPlistTrue(xml, key) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*)(<true/>|<false/>)`);
  if (pattern.test(xml)) return xml.replace(pattern, "$1<true/>");
  return insertBeforeLastDictClose(xml, `\t<key>${key}</key>\n\t<true/>\n`);
}

function plistWithProtocol(xml) {
  let next = upsertPlistString(xml, "CFBundleIdentifier", DEV_BUNDLE_ID);
  next = upsertPlistString(next, "CFBundleName", "Aurafarm");
  next = upsertPlistString(next, "CFBundleDisplayName", "Aurafarm");
  next = upsertPlistString(next, "NSAppleEventsUsageDescription", APPLE_EVENTS_DESCRIPTION);
  next = upsertPlistTrue(next, "LSUIElement");
  if (!next.includes("<string>aurafarm</string>")) {
    next = insertBeforeLastDictClose(
      next,
      [
        "\t<key>CFBundleURLTypes</key>",
        "\t<array>",
        "\t\t<dict>",
        "\t\t\t<key>CFBundleURLName</key>",
        "\t\t\t<string>Aurafarm</string>",
        "\t\t\t<key>CFBundleURLSchemes</key>",
        "\t\t\t<array>",
        "\t\t\t\t<string>aurafarm</string>",
        "\t\t\t</array>",
        "\t\t</dict>",
        "\t</array>",
        "",
      ].join("\n"),
    );
  }
  return next;
}

function takePendingLaunchLinks(file) {
  if (!file) return [];
  const claimed = `${file}.${process.pid}.${Date.now()}.claimed`;
  try {
    fs.renameSync(file, claimed);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  try {
    const text = fs.readFileSync(claimed, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("aurafarm://"));
  } finally {
    fs.rmSync(claimed, { force: true });
  }
}

function compileWithOsacompile(script, destApp) {
  fs.rmSync(destApp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destApp), { recursive: true });
  execFileSync("osacompile", ["-o", destApp, "-e", script], { stdio: "inherit" });
}

function defaultRegisterApp(destApp, bundleId) {
  const lsregister =
    "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
  execFileSync(lsregister, ["-f", destApp], { stdio: "inherit" });
  const jxa = [
    'ObjC.import("CoreServices");',
    `var status = $.LSSetDefaultHandlerForURLScheme($("${PROTOCOL}"), $("${bundleId}"));`,
    'if (status !== 0) throw new Error("LSSetDefaultHandlerForURLScheme failed: " + status);',
  ].join("\n");
  execFileSync("osascript", ["-l", "JavaScript", "-e", jxa], { stdio: "inherit" });
}

function installProtocolApp(script, destApp, options) {
  fs.rmSync(destApp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destApp), { recursive: true });
  if (typeof options.compileApp === "function") options.compileApp(script, destApp);
  else compileWithOsacompile(script, destApp);

  const plistPath = path.join(destApp, "Contents", "Info.plist");
  if (typeof options.convertPlist === "function") options.convertPlist(plistPath);
  else if (process.platform === "darwin") {
    execFileSync("plutil", ["-convert", "xml1", plistPath], { stdio: "ignore" });
  }
  fs.writeFileSync(plistPath, plistWithProtocol(fs.readFileSync(plistPath, "utf8")));
  if (typeof options.signApp === "function") options.signApp(destApp);
  else if (process.platform === "darwin") {
    execFileSync("codesign", ["--force", "--sign", "-", destApp], { stdio: "inherit" });
  }
}

function ensureDevProtocolHandler(options = {}) {
  const desktopDir = options.desktopDir || __dirname;
  const appDir = options.appDir || desktopDir;
  const electronExecutable = options.electronExecutable || defaultElectronExecutable(desktopDir);
  const electronApp = options.electronApp || electronBundleFromExecutable(electronExecutable);
  const destApp = options.destApp || path.join(desktopDir, ".dev-app", HANDLER_APP_NAME);
  const pendingFile = options.pendingFile || pendingLaunchFile(desktopDir);
  const script = protocolHandlerScript({ electronBin: electronExecutable, appDir, pendingFile });
  const stampPath = path.join(path.dirname(destApp), "protocol-stamp");
  const stamp = `${HANDLER_VERSION}\n${DEV_BUNDLE_ID}\n${script}`;
  const haveApp = fs.existsSync(path.join(destApp, "Contents", "Info.plist"));
  const current = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf8") : "";
  if (current !== stamp || !haveApp) {
    installProtocolApp(script, destApp, options);
    fs.mkdirSync(path.dirname(stampPath), { recursive: true });
    fs.writeFileSync(stampPath, stamp);
  }
  if (options.register !== false) {
    const register = options.registerApp;
    if (typeof register === "function") register(destApp, DEV_BUNDLE_ID);
    else if (process.platform === "darwin") defaultRegisterApp(destApp, DEV_BUNDLE_ID);
  }
  return { ok: true, destApp, script, pendingFile, electronApp, appDir };
}

module.exports = {
  DEV_BUNDLE_ID,
  appleScriptString,
  defaultElectronExecutable,
  electronBundleFromExecutable,
  ensureDevProtocolHandler,
  pendingLaunchFile,
  plistWithProtocol,
  protocolHandlerScript,
  takePendingLaunchLinks,
};
