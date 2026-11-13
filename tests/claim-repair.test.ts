import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../supabase/migrations/0031_repair_claim.sql", import.meta.url),
  "utf8",
);

test("claim lookup qualifies claimed_at so a correct code is not ambiguous", () => {
  const claim = sql.slice(sql.indexOf("function public.claim_study_session"));
  assert.match(claim, /session\.claimed_at is null/);
  assert.match(claim, /order by session\.started_at desc/);
  assert.match(claim, /raise exception 'Claim rejected'/);
  assert.doesNotMatch(claim, /claimed_at timestamptz/);
  assert.doesNotMatch(claim, /claimed_at :=/);
});

test("score and cancel measure from started_at and drop distraction time", () => {
  assert.match(sql, /drop function if exists public\.submit_study_score\(uuid, text, integer, integer, text\[\], integer\)/);
  assert.match(sql, /drop function if exists public\.cancel_study_session\(uuid, integer\)/);
  assert.match(sql, /drop column if exists distraction_seconds/);
  assert.match(sql, /session_row\.started_at \+ make_interval/);
  assert.match(sql, /now\(\) - session_row\.started_at/);
  assert.match(sql, /Study time has not finished/);
  assert.doesNotMatch(sql, /session_row\.claimed_at/);
  assert.doesNotMatch(sql, /distraction_seconds integer/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
