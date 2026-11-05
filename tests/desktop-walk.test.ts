import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("the desktop pet turns at a screen edge and crosses onto the next monitor", (t) => {
  const probe = spawnSync("godot", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    t.skip("godot is not on PATH");
    return;
  }

  const run = spawnSync(
    "godot",
    ["--headless", "--path", "godot", "--script", "res://scripts/walk_check.gd"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /desktop walk ok/);
});
