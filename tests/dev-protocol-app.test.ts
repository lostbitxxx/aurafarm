import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  DEV_BUNDLE_ID,
  electronBundleFromExecutable,
  ensureDevProtocolHandler,
  pendingLaunchFile,
  plistWithProtocol,
  protocolHandlerScript,
  takePendingLaunchLinks,
} = require("../desktop/dev-protocol-app.js") as {
  DEV_BUNDLE_ID: string;
  electronBundleFromExecutable: (executable: string) => string;
  ensureDevProtocolHandler: (options: Record<string, unknown>) => {
    destApp: string;
    script: string;
    pendingFile: string;
    electronApp: string;
    appDir: string;
  };
  pendingLaunchFile: (desktopDir: string) => string;
  plistWithProtocol: (xml: string) => string;
  protocolHandlerScript: (options: { electronBin: string; appDir: string; pendingFile: string }) => string;
  takePendingLaunchLinks: (file: string) => string[];
};

const basePlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.apple.ScriptEditor.id.test</string>
	<key>CFBundleName</key>
	<string>Aurafarm Protocol</string>
	<key>CFBundleExecutable</key>
	<string>applet</string>
	<key>LSUIElement</key>
	<false/>
</dict>
</plist>
`;

test("the dev handler launches Electron with the pet directory, not a bare path-to-app", () => {
  const electronBin =
    "/Users/kittykwan/aurafarm/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron";
  const appDir = "/Users/kittykwan/aurafarm/desktop";
  const pendingFile = pendingLaunchFile(appDir);
  const script = protocolHandlerScript({ electronBin, appDir, pendingFile });
  const openLocation = script.slice(script.indexOf("on open location"));

  assert.match(script, /on open location theURL/);
  assert.match(script, /nohup /);
  assert.ok(script.includes(electronBin));
  assert.ok(script.includes(appDir));
  assert.ok(openLocation.includes(pendingFile));
  assert.ok(openLocation.indexOf("printf") < openLocation.indexOf("nohup "));
  assert.equal(electronBundleFromExecutable(electronBin), path.dirname(path.dirname(path.dirname(electronBin))));
  assert.throws(() => electronBundleFromExecutable("/usr/bin/electron"), /Not an Electron app bundle/);
  const quoted = protocolHandlerScript({
    electronBin: "/Users/o\"brien/Electron.app/Contents/MacOS/Electron",
    appDir: "/Users/o'brien/desktop",
    pendingFile: "/Users/o'brien/desktop/.dev-app/pending-link",
  });
  assert.match(quoted, /o\\"brien/);
  assert.match(quoted, /o'brien/);
});

test("the handler plist claims aurafarm and stays an agent app", () => {
  const once = plistWithProtocol(basePlist);
  const twice = plistWithProtocol(once);
  assert.match(once, new RegExp(`<string>${DEV_BUNDLE_ID}</string>`));
  assert.match(once, /<string>aurafarm<\/string>/);
  assert.match(once, /<key>LSUIElement<\/key>\s*<true\/>/);
  assert.match(once, /NSAppleEventsUsageDescription/);
  assert.match(once, /<key>CFBundleExecutable<\/key>\s*<string>applet<\/string>/);
  assert.equal(twice.split("<string>aurafarm</string>").length, 2);
});

test("a pending launch link is claimed once", () => {
  const root = mkdtempSync(path.join(tmpdir(), "aurafarm-pending-"));
  try {
    const file = pendingLaunchFile(root);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "not-a-link\naurafarm://session?code=ABC234\n");
    assert.deepEqual(takePendingLaunchLinks(file), ["aurafarm://session?code=ABC234"]);
    assert.deepEqual(takePendingLaunchLinks(file), []);
    assert.deepEqual(takePendingLaunchLinks(path.join(root, "missing")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installing the handler registers the applet and skips a rebuild", () => {
  const root = mkdtempSync(path.join(tmpdir(), "aurafarm-handler-"));
  const electronApp = path.join(root, "Electron.app");
  const executable = path.join(electronApp, "Contents", "MacOS", "Electron");
  const desktopDir = path.join(root, "desktop");
  const destApp = path.join(desktopDir, ".dev-app", "Aurafarm Protocol.app");
  let compiles = 0;
  let registrations = 0;
  try {
    mkdirSync(path.dirname(executable), { recursive: true });
    writeFileSync(executable, "electron");
    const options = {
      desktopDir,
      appDir: desktopDir,
      electronExecutable: executable,
      destApp,
      registerApp(appPath: string, bundleId: string) {
        registrations += 1;
        assert.equal(appPath, destApp);
        assert.equal(bundleId, DEV_BUNDLE_ID);
      },
      compileApp(script: string, appPath: string) {
        compiles += 1;
        mkdirSync(path.join(appPath, "Contents"), { recursive: true });
        writeFileSync(path.join(appPath, "Contents", "Info.plist"), basePlist);
        writeFileSync(path.join(appPath, "Contents", "script.txt"), script);
      },
    };
    const first = ensureDevProtocolHandler(options);
    const second = ensureDevProtocolHandler(options);
    assert.equal(compiles, 1);
    assert.equal(registrations, 2);
    assert.equal(first.electronApp, electronApp);
    assert.equal(first.appDir, desktopDir);
    assert.equal(second.pendingFile, pendingLaunchFile(desktopDir));
    const plist = readFileSync(path.join(destApp, "Contents", "Info.plist"), "utf8");
    assert.match(plist, /<string>aurafarm<\/string>/);
    const stored = readFileSync(path.join(destApp, "Contents", "script.txt"), "utf8");
    assert.match(stored, /nohup /);
    assert.ok(stored.includes(desktopDir));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dev startup does not register the raw Electron executable", () => {
  const main = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  assert.match(main, /ensureDevProtocolHandler\(\{ electronExecutable: process\.execPath \}\)/);
  assert.doesNotMatch(main, /setAsDefaultProtocolClient\("aurafarm", process\.execPath/);
  assert.match(main, /if \(!app\.isPackaged\)/);
});
