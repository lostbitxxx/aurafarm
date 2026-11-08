import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../supabase/migrations/0002_study_sessions.sql", import.meta.url),
  "utf8",
);

test("a user can have only one active study session", () => {
  assert.match(sql, /create unique index if not exists study_sessions_one_active/);
  assert.match(sql, /where status = 'active'/);
});

test("scores are only the focused or distracted point values", () => {
  assert.match(sql, /check \(points in \(40, 100\)\)/);
  assert.match(sql, /function public\.submit_study_score/);
  assert.match(sql, /extensions\.digest\(raw_token, 'sha256'\)/);
  assert.match(sql, /grant execute on function public\.submit_study_score/);
});

test("older profile tables gain a display name without dropping email", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0004_profile_display_name.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column if not exists display_name/);
  assert.match(sql, /has_display and has_email/);
  assert.match(sql, /insert into public\.profiles \(id, display_name, email\)/);
});

test("older pet tables gain a created_at column", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0005_user_pets_created_at.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter table public\.user_pets/);
  assert.match(sql, /add column if not exists created_at/);
});

test("cancelling a session is a separate function from scoring", () => {
  assert.match(sql, /function public\.cancel_study_session/);
  assert.match(sql, /set status = 'cancelled'/);
  assert.match(sql, /grant select on table public\.study_scores to authenticated/);
  assert.doesNotMatch(sql, /grant insert on table public\.study_scores/i);
});
