# Aurafarm study-session plan

This is the master plan. Each phase has a small plan in [`docs/plans`](plans) and should be implemented on its own, after the phase it depends on meets that plan's "Done when".

The desk that already exists (accounts, pets, Equip to Desktop, Godot iframe, cross-origin isolation headers) is the baseline. These plans add study sessions, an Electron desktop pet, a frontmost-site reader, and scoring. There is no browser extension.

## Product

Aurafarm is two programs that share one account.

- The website is the desk: account, pets, a Godot mini-game inside the page, study-session controls, and score history.
- The desktop pet is a separate Electron download. Its window is the size of the sprite and moves across the whole screen, including over the browser. It shows the pet equipped in `user_pets`.
- During a study session the user started, the pet reads the address bar of the frontmost browser window. It does not close tabs, and it does not see background tabs.
- The server stores the score. The pet shows a higher or lower scoring action from what happened in the session, then `POST`s that result and opens the site.

The score trusts the pet's report for this version. The pet is the sensor. A later version can harden that. This version does not record browsing history. It records how many blocklist hosts were in front, and which of those hosts they were.

## Already built

On the pet-desk branch:

- Registration, login, `public.profiles`, `public.user_pets`, and a level 1 `baby_slime` with `is_desktop_active` set.
- Equip to Desktop calls `equip_pet_to_desktop` and updates the inventory.
- [`components/godot-frame.tsx`](../components/godot-frame.tsx) iframes the Godot 4.5.2 web export. The query names the pet equipped on the desk.
- [`next.config.ts`](../next.config.ts) sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response except the dev HMR socket.
- Tests are `node:test` files in [`tests`](../tests), run with `npm test`. SQL behavior is checked by reading the migration file. Pure helpers live in `lib/` and are what the tests import.

Phase 1 is in the repo: [`supabase/migrations/0002_study_sessions.sql`](../supabase/migrations/0002_study_sessions.sql), [`lib/scoring.ts`](../lib/scoring.ts), and [`lib/blocklist.ts`](../lib/blocklist.ts). Phase 2 adds the study panel on the desk. Phase 3 adds `POST /api/sessions/:id/score` and the score screen. Phase 4 replaces the desk placeholder with a Godot 4.5.2 web export. The Godot Windows scene from phase 5 has been removed. Phase 6 adds the download link, device pairing, heartbeats, and the launch-code claim. The Electron client for those routes is not built yet.

## Next commit

The Mac Electron pet is the current desktop work, described in [phase 5](plans/05-roaming-desktop-pet.md). Do not add the frontmost-site reader or the Finish button in that work. Those stay in phases 7 and 8. Windows packaging waits.

## Rules for every phase

- The user starts and can stop a session. The pet checks the frontmost address bar against the blocklist only while that session is active.
- The pet reads that address bar itself. It does not use a browser extension, and it does not close tabs.
- Points come from the session record. Focused is `100`. Distracted (`blocked_count > 0`) is `40`. Duration is stored and does not change the points yet.
- macOS is the first desktop target. The pet is an Electron app on the Mac. Windows waits. Linux stays out because overlay windows differ on Wayland.
- Godot is the web mini-game only. The roaming pet is Electron.
- The website learns whether the pet is running from an API heartbeat. It does not connect to `127.0.0.1`. The isolation headers already on the site, and the browser's local-network permission, make a public page calling loopback a bad wake-up path.
- The pet opens no local port. The session token is not put in the `aurafarm://` URL. The equipped character comes from `user_pets`, using the public Supabase key and that user's session. The service-role key stays on the server.
- Follow the existing server-action and Supabase cookie patterns in [`lib/actions/pets.ts`](../lib/actions/pets.ts) and [`lib/supabase/server.ts`](../lib/supabase/server.ts). Do not cache session, score, or heartbeat data. Load them the way [`lib/dashboard.ts`](../lib/dashboard.ts) loads pets.
- New tests stay on `node:test` and `npm test`. Do not add a second test runner.

## Phases

| Phase | Plan | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | [Domain model](plans/01-domain-model.md) | pet desk | Sessions, blocklist, scores, and the score function in Supabase |
| 2 | [Dashboard study controls](plans/02-dashboard-study-controls.md) | 1 | Start, stop, blocklist, past scores, and an `aurafarm://` link |
| 3 | [Score API](plans/03-score-api.md) | 1 | Token-authenticated `POST` that writes points and opens a score screen |
| 4 | [Godot web mini-game](plans/04-godot-web-minigame.md) | pet desk | A real web export in the desk iframe |
| 5 | [Roaming desktop pet](plans/05-roaming-desktop-pet.md) | phase 4 web scene stays | Delete the Godot Windows pet, then build the Electron pet |
| 6 | [Download, pairing, and wake-up](plans/06-download-pairing-wakeup.md) | 2, 5 | Hosted download, device heartbeat, one-time code claim |
| 7 | [Frontmost site](plans/07-browser-extension.md) | 5, 6 | The pet reads the front address bar during a claimed session |
| 8 | [Pet scoring action](plans/08-pet-scoring-action.md) | 3, 7 | The pet submits the score and opens the desk |
| 9 | [Packaging](plans/09-packaging.md) | 6, 7, 8 | Signed Electron build, updates, privacy note |
| 10 | [Disable email confirmation](plans/10-disable-email-confirmation.md) | none | New accounts open the desk without a confirmation email |

Order: the Godot Windows pet is removed. The desktop pet is the Mac Electron app from phase 5. Phases 1 through 4 and the phase 6 server routes are already in the repo. Phase 7 needs that Mac pet and a claimed session. Phase 8 needs 3 and 7. Phase 9 is last. Phase 10 can happen at any time. It does not wait for the desktop pet. Windows is not part of the current work.

## Settled decisions

- Wake-up: `aurafarm://session?code=…`. The pet exchanges that code with the API over HTTPS. The code is single-use, expires in 5 minutes, and is shorter than the session token. The link is safe to land in browser history.
- Presence: the pet heartbeats every 10 seconds. The desk treats a heartbeat newer than 30 seconds as "running".
- The pet does not open a local socket. There is no extension and no native-messaging host.
- Blocklist: server-owned table. The first hosts are `instagram.com`, `tiktok.com`, and `youtube.com`. A host matches itself and its subdomains.
- Score: `scoreForBlockedCount` in `lib/scoring.ts`. The pet does not invent the point value. The database function uses the same two numbers.
- Auth for the pet: a short-lived session token returned when the launch code is claimed. The pet does not store the user's Supabase password. Device heartbeats use a separate device token from pairing. The sprite uses the user's own Supabase session to read `user_pets`.
- The first blocklist host in front during a session is enough to make the score the lower one. The pet records the count and the hostnames. It does not close the tab.

## What a small plan is for

Implement that file only. Leave the later phases' files unbuilt. When a decision in a small plan conflicts with this page, this page wins, and the small plan should be edited before the code changes.
