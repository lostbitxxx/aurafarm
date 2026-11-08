const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "bundled-origin.js");
const previous = fs.readFileSync(target, "utf8");

function readDotEnv(file) {
  if (!fs.existsSync(file)) return "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("AURAFARM_API_ORIGIN=")) continue;
    let value = trimmed.slice("AURAFARM_API_ORIGIN=".length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

const origin = (process.env.AURAFARM_API_ORIGIN || readDotEnv(path.join(__dirname, "..", ".env.local")))
  .trim()
  .replace(/\/$/, "");

fs.writeFileSync(target, `module.exports = ${JSON.stringify(origin)};\n`);

const env = { ...process.env };
if (!process.argv.includes("--signed")) env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
const result = spawnSync("npx", ["electron-builder", "--mac", "zip"], {
  cwd: __dirname,
  stdio: "inherit",
  env,
});

fs.writeFileSync(target, previous);
process.exit(result.status ?? 1);
