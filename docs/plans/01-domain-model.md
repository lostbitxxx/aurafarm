# Phase 1 — Domain model

Status: done. The migration, helpers, and tests are in the repo. `npm test` covers the formula, hashes, hostname matching, and the migration text. The migration was applied after `0001` on PostgreSQL 16: a signed-in role can insert and read its own session, cannot insert a score or a second active session, and `submit_study_score` writes 100 or 40, rejects a null or wrong token, and rejects a second submit.

Depends on: the pet desk (`profiles`, `user_pets`, signup trigger).

## Goal

Store a study session, the global blocklist, and one score per session. A SQL function accepts a session token and writes the points. The website can create and read this data before any pet exists.

## Out of scope

Desktop pet, the frontmost-site reader, download, pairing, heartbeat, and any new page. Launch-code columns belong here so phase 2 can fill them without another migration. Claiming a code is phase 6. There is no browser extension.

## Touch

- `supabase/migrations/0002_study_sessions.sql`
- `lib/scoring.ts` for the point formula and token/code helpers that do not need Supabase
- `lib/blocklist.ts` for hostname matching
- `tests/scoring.test.ts`
- `tests/study-schema.test.ts` reading the migration the way [`tests/pets.test.ts`](../../tests/pets.test.ts) reads `0001`

## Tables

`public.blocklist_hosts`

- `host text primary key` stored in lowercase, no scheme, no path
- `label text not null`
- Seed: `instagram.com` / Instagram, `tiktok.com` / TikTok, `youtube.com` / YouTube
- Select granted to `authenticated`. No insert or update for `authenticated`.

`public.study_sessions`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references public.profiles (id) on delete cascade`
- `status text not null default 'active'` check in `active`, `submitted`, `cancelled`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz`
- `session_token_hash text` — null until phase 6 claims the launch code, then SHA-256 hex of the secret returned once to the pet
- `launch_code_hash text not null` — SHA-256 hex of the short code put in `aurafarm://`
- `launch_code_expires_at timestamptz not null`
- `claimed_at timestamptz`
- `blocked_count integer not null default 0` check `blocked_count >= 0`
- `blocked_hosts text[] not null default '{}'`
- `duration_seconds integer` check `duration_seconds is null or duration_seconds >= 0`
- `created_at timestamptz not null default now()`

Partial unique index on `user_id` where `status = 'active'`, so a user has one open session.

`public.study_scores`

- `id uuid primary key default gen_random_uuid()`
- `session_id uuid not null unique references public.study_sessions (id) on delete cascade`
- `user_id uuid not null references public.profiles (id) on delete cascade`
- `points integer not null` check `points in (40, 100)`
- `distracted boolean not null`
- `duration_seconds integer not null`
- `blocked_count integer not null`
- `blocked_hosts text[] not null`
- `created_at timestamptz not null default now()`

Enable RLS on all three tables.

- `study_sessions`: `authenticated` can select and insert own rows (`user_id = auth.uid()`). Users can update a row only to set `status` from `active` to `cancelled` and set `ended_at`. They cannot change token hashes, blocked counts, or flip a row to `submitted`.
- `study_scores`: `authenticated` can select own rows. No insert or update policy. The score function writes the row as `security definer`.
- `blocklist_hosts`: select for `authenticated`.

Grants match those policies. `anon` gets no table access.

## Function

`public.submit_study_score(target_session_id uuid, raw_token text, duration_seconds integer, blocked_count integer, blocked_hosts text[]) returns table (points integer, distracted boolean)`

- `security definer`, `search_path = public`
- Revoke from `public`. Grant execute to `anon` and `authenticated`. The pet has no user cookie. The token is the credential.
- Reject when the session is missing, the token hash does not match, or `status` is not `active`.
- Reject `duration_seconds < 0` or `blocked_count < 0`.
- Keep only hosts that exist in `blocklist_hosts` or are subdomains of those hosts. Ignore everything else.
- `distracted` is `blocked_count > 0`. Points are `40` when distracted, otherwise `100`. Use the filtered host list's length if it disagrees with `blocked_count` by taking the greater of the two, so dropping hosts from the list cannot raise the score.
- Set the session `status` to `submitted`, fill `ended_at`, `duration_seconds`, `blocked_count`, and `blocked_hosts`, and insert `study_scores`.
- A second call raises an exception. The unique `session_id` on `study_scores` is the backstop.

`public.cancel_study_session(target_session_id uuid)` 

- `security invoker`
- Caller must own the row. Only an `active` row becomes `cancelled`, with `ended_at = now()`.

`submit_study_score` hashes `raw_token` with `encode(extensions.digest(raw_token, 'sha256'), 'hex')` via `pgcrypto`, and compares it to `session_token_hash`. Enable `pgcrypto` in the migration if the project does not already have it. A null `session_token_hash` rejects the call. The app helper must use the same encoding (UTF-8 bytes, SHA-256, lowercase hex).

Phase 2 stores only the launch-code hash. Phase 6 generates the session secret at claim time, stores this hash, and returns the raw secret once. The desk never receives that secret, so it does not need to be encrypted at rest for the dashboard.

## App helpers

`lib/scoring.ts`

- `FOCUSED_SCORE = 100`, `DISTRACTED_SCORE = 40`
- `scoreForBlockedCount(blockedCount: number)`
- `createSessionSecret()` — 32 random bytes, base64url
- `createLaunchCode()` — 10 characters from an unambiguous alphabet (no `0`, `O`, `1`, `l`)
- `hashSecret(value: string)` — SHA-256 hex

`lib/blocklist.ts`

- `hostMatchesBlocklist(host: string, blockedHosts: readonly string[]): boolean`
- Compare lowercase hostnames. `instagram.com` matches `instagram.com` and `www.instagram.com`. It does not match `notinstagram.com`.

## Done when

- `npm test` covers the point formula, both hash helpers, subdomain matching, and the migration text for the partial unique index, the score checks `(40, 100)`, and `submit_study_score`.
- Applying `0002` in the Supabase SQL editor succeeds after `0001`.
- A signed-in SQL session can insert and select its own `study_sessions` row and cannot insert into `study_scores` directly.
- Calling `submit_study_score` with the raw token, after `session_token_hash` is set to that token's hash, writes `100` or `40`. A second call fails. A row whose hash is still null rejects the call.
