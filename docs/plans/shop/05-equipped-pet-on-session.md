# Phase 5 — Equipped pet on the session link

Status: for review. Do not build this until phase 4 is accepted.

Depends on: [phase 4](04-inventory.md), because equip has to update the same row the pet reads.

## Goal

Opening a study session from the launch link shows the pet that user has equipped, including a pet just equipped from `/inventory`. The link does not choose the pet, and it does not choose the user.

## What already does this

`buildPetLaunchUrl` returns `aurafarm://session?code=…`. The code is the only query parameter. `desktop/links.js` parses that code and nothing else. `aurafarm://pair` is no longer a link, and `parseAurafarmLink` returns null for it.

`claim_study_session` looks up `user_pets` for the session's own `user_id` where `is_desktop_active` is true, and returns that `pet_type` and `level` with the claim. It also returns `close_blocked`. The code does not carry either value.

After the pet has the user's Supabase session, `refreshPet` in `desktop/main.js` selects `pet_type, level` from `user_pets` where `is_desktop_active` is true. It does not send a user id. Row-level security applies `user_id = auth.uid()`, so the same link on two machines returns two different rows. The partial unique index allows one active row per user.

`refreshPet` runs on `PET_REFRESH_MS` (10 seconds). That timer is not a presence heartbeat. Pairing and `/api/pet/heartbeat` are gone. An equip on the website still reaches a running pet on the next tick.

The sprite uses the publishable key and that session. It must keep doing that. The service-role key does not go into `desktop/`.

## This phase

Keep that path. Do not add `/session`. The score screen stays `/dashboard/sessions/[id]`, which is already behind the dashboard auth check.

Add a regression check that the session link cannot carry a pet:

- `buildPetLaunchUrl` still has only the `code` parameter.
- `parseAurafarmLink` still returns the code and no pet field.
- The desktop select stays filtered by `is_desktop_active` and does not read a pet type from the URL.

If a claimed session is open and the farmer equips a different owned pet, the next `refreshPet` publishes that new `pet_type` and `level`. Do not cache the pet type inside the launch code.

## Out of scope

Godot. The desk iframe may still pass `pet` and `level` on `/godot-game/index.html` through `buildGodotFrameSrc`. That query is a hint to the web mini-game. This phase does not remove it and does not teach the web export to call `purchase_pet`.

No new score formula. No wallet award when a session is submitted.

## Touch

- `tests/study.test.ts` or `tests/desktop-links.test.ts` for the link shape
- `desktop/main.js` only if `refreshPet` is reading the pet from anywhere other than `is_desktop_active`

## Done when

- `aurafarm://session?code=ABC234` still parses as a session code and has no pet or user field.
- A signed-in pet querying `is_desktop_active` gets its own row. A pet type passed on the link is ignored.
- Equipping `river_newt` on `/inventory`, then opening the launch link, shows `river_newt` rather than `baby_slime`.
- Two users opening the same path still see their own equipped pet.
