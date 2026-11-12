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

test("profile email may be missing on older tables", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0012_profile_email_optional.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter column email drop not null/);
  assert.match(sql, /contype = 'c'/);
  assert.match(sql, /drop constraint/);
  assert.match(sql, /values \(new\.id, chosen_name, new\.email\)/);
  assert.doesNotMatch(sql, /values \(new\.id, chosen_name, coalesce\(new\.email/);
});

test("older pet tables gain a created_at column", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0005_user_pets_created_at.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /alter table public\.user_pets/);
  assert.match(sql, /add column if not exists created_at/);
});

test("close blocked tabs is a profile flag returned by claim", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/0007_close_blocked.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /add column if not exists close_blocked boolean not null default false/);
  assert.match(migration, /drop function if exists public\.claim_study_session\(text, text\)/);
  assert.match(migration, /close_blocked boolean/);
  assert.match(migration, /profiles\.close_blocked/);
  assert.match(migration, /close_blocked := coalesce\(close_flag, false\)/);
  assert.match(migration, /grant execute on function public\.claim_study_session\(text, text\) to anon/);
});

test("cancelling a session is a separate function from scoring", () => {
  assert.match(sql, /function public\.cancel_study_session/);
  assert.match(sql, /set status = 'cancelled'/);
  assert.match(sql, /grant select on table public\.study_scores to authenticated/);
  assert.doesNotMatch(sql, /grant insert on table public\.study_scores/i);
});
