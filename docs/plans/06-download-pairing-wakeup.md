# Phase 6 — Download, pairing, and wake-up

Status: implemented. Run [`supabase/migrations/0006_pet_devices.sql`](../../supabase/migrations/0006_pet_devices.sql). The plan originally named that file `0003`; that number was already used.

Depends on: [phase 2](02-dashboard-study-controls.md) and [phase 5](05-roaming-desktop-pet.md).

## Goal

The desk links to a Windows build and shows whether the pet process is running. The user pairs that install with their account. Starting a study session still shows `aurafarm://session?code=…`. After the user lets the browser open Aurafarm, the pet trades the code for the session secret over HTTPS.

The deployed website does not open `ws://127.0.0.1` or `http://127.0.0.1`.

## Out of scope

Closing tabs, the score button, code signing, and auto-update. The extension's socket is reserved here and used in phase 7. SmartScreen warnings are expected until phase 9.

## Touch

- `supabase/migrations/0006_pet_devices.sql`
- `app/api/pet/pair/route.ts`
- `app/api/pet/heartbeat/route.ts`
- `app/api/sessions/claim/route.ts`
- `lib/pet-device.ts` — token helpers, freshness (`HEARTBEAT_INTERVAL_MS = 10_000`, `HEARTBEAT_FRESH_MS = 30_000`)
- `components/pet-status.tsx` — download link and running / not-running
- `components/study-panel.tsx` — keep the phase 2 link; add a one-line hint to launch the pet
- `desktop/` Godot scripts for pair, heartbeat, and claim
- `desktop/install-protocol.reg` — registers `aurafarm` for the current user's `HKCU`
- `.env.example` — `NEXT_PUBLIC_PET_DOWNLOAD_URL`
- `tests/pet-device.test.ts`

## Data

`public.pet_devices`

- `id uuid primary key`
- `user_id uuid not null references public.profiles (id) on delete cascade`
- `token_hash text not null unique`
- `label text not null default 'Windows pet'`
- `last_seen_at timestamptz`
- `created_at timestamptz not null default now()`

RLS: `authenticated` selects own rows. The pair route generates the device token, then `pair_pet_device(token_hash text, label text)` runs as `security definer`, checks `auth.uid()`, and stores the hash. The route returns the raw token once. Heartbeats go through `touch_pet_device(raw_token text)`, which hashes the token, updates `last_seen_at`, and returns `user_id`, or raises when the token is unknown. Grant execute on `touch_pet_device` to `anon`. Do not grant table update to `anon`.

`claim_study_session(raw_code text, token_hash text)` 

- `security definer`, granted to `anon`
- Finds an `active` session whose `launch_code_hash` matches, whose `launch_code_expires_at` is still in the future, and whose `claimed_at` is null
- Generates the session secret in the Next.js route (so the secret is not invented inside SQL), then this function stores `session_token_hash`, sets `claimed_at`, and returns the session row's id
- The route returns the raw secret once in the HTTP response and does not write it anywhere else

Call shape: the route hashes the launch code, finds the candidate only through the function, and passes the new token hash in: `claim_study_session(raw_code text, token_hash text)`. The function returns `session_id`, `pet_type`, and `level`. A second call finds `claimed_at` set and raises. Expired and unknown codes raise the same way.

The claim response is:

```json
{
  "session_id": "...",
  "token": "<session secret>",
  "blocklist": ["instagram.com", "tiktok.com", "youtube.com"],
  "pet_type": "baby_slime",
  "level": 1
}
```

`pet_type` and `level` come from the user's `is_desktop_active` pet. An expired or reused code is `403`, with the same body shape for unknown and reused codes.

## Desk behavior

`NEXT_PUBLIC_PET_DOWNLOAD_URL` is an absolute URL to a zip or exe hosted outside the Next.js deploy (object storage or a GitHub release). The status panel links there. When the variable is missing, the panel says the desktop build is not published yet and still explains pairing.

Presence is `last_seen_at` within 30 seconds on any of the user's devices. Load it in `loadDashboard`. The panel is a client component that refetches this on an interval of 10 seconds by calling a small server action or route that reads `pet_devices`. A server render on its own shows "not running" until a heartbeat exists.

Pairing controls on the desk, while signed in:

- "Pair this computer" calls `POST /api/pet/pair` with the session cookie and shows the device token once, together with `aurafarm://pair?token=…`. Tell the user the token is shown once.
- The pet stores the token locally in `user://` and heartbeats `POST /api/pet/heartbeat` with `Authorization: Bearer <device token>` every 10 seconds. Bind no port in this phase.

Wake-up:

- The phase 2 link stays `aurafarm://session?code=CODE`.
- `desktop/install-protocol.reg` points the `aurafarm` protocol at the exported exe with a `"%1"` argument.
- On startup the pet reads the argument. `pair` saves the token. `session` POSTs `{ "code": "..." }` to `/api/sessions/claim` using the API origin baked into the export.
- Dev export uses `http://localhost:3000`. The production export uses the deployed origin. One constant in the Godot project, set before export.
- Fallback when the protocol is not registered: the pet has a one-line code field. Pasting the launch code calls the same claim function. This is how the phase is tested without an installer.

## Done when

- `npm test` covers freshness (29 seconds is running, 31 is not) and that dashboard source under `components/` and `app/` does not contain `127.0.0.1` or `localhost:47331`.
- Pairing while signed in returns a device token once. Heartbeat with that token moves `last_seen_at`, and the desk shows the pet as running. A wrong token is rejected.
- Start study, paste the launch code into the pet (or open the protocol link). The pet receives `session_id`, `token`, the blocklist, and the equipped pet. A second claim of the same code fails.
- The download control uses `NEXT_PUBLIC_PET_DOWNLOAD_URL` and does not embed the exe in `public/`.
