# Aurafarm study-session plan

This is the master plan. Each phase has a small plan in [`docs/plans`](plans) and should be implemented on its own, after the phase it depends on meets that plan's "Done when".

The desk that already exists (accounts, pets, Equip to Desktop, Godot iframe, cross-origin isolation headers) is the baseline. These plans add study sessions, a roaming desktop pet, a browser extension, and scoring.

## Product

Aurafarm is two programs that share one account.

- The website is the desk: account, pets, a Godot mini-game inside the page, study-session controls, and score history.
- The desktop pet is a separate download. Its window is the size of the sprite and moves across the whole screen, including over the browser.
- A browser extension, installed by the user, is the only piece that can see tab hostnames and close a distracting tab during a session the user started.
- The server stores the score. The pet shows a higher or lower scoring action from what happened in the session, then `POST`s that result and opens the site.

The score trusts the pet's report for this version. The extension is the sensor, the pet forwards the blocked count, and the server applies the point formula. A later version can harden that. This version does not record browsing history. It records how many blocklist hosts were opened, and which of those hosts they were.

## Already built

On the pet-desk branch:

- Registration, login, `public.profiles`, `public.user_pets`, and a level 1 `baby_slime` with `is_desktop_active` set.
- Equip to Desktop calls `equip_pet_to_desktop` and updates the inventory.
- [`components/godot-frame.tsx`](../components/godot-frame.tsx) iframes `/godot-game/index.html`. The file there is a placeholder.
- [`next.config.ts`](../next.config.ts) sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response except the dev HMR socket.
- Tests are `node:test` files in [`tests`](../tests), run with `npm test`. SQL behavior is checked by reading the migration file. Pure helpers live in `lib/` and are what the tests import.

There is no study session, score, installer, desktop export, or extension.

## Rules for every phase

- The user starts and can stop a session. The extension checks hostnames against the blocklist only while that session is active.
- The pet executable does not read the browser. The extension reports block events to the pet.
- Points come from the session record. Focused is `100`. Distracted (`blocked_count > 0`) is `40`. Duration is stored and does not change the points yet.
- Windows is the first desktop target. macOS and Linux stay out of these plans because overlay windows differ, especially on Wayland.
- One Godot project, two exports: Web for the dashboard mini-game, Windows for the roaming pet.
- The website learns whether the pet is running from an API heartbeat. It does not connect to `127.0.0.1`. The isolation headers already on the site, and the browser's local-network permission, make a public page calling loopback a bad wake-up path.
- The pet listens on `127.0.0.1` only, and only for the extension. The session token is not put in a page-to-pet socket or in the `aurafarm://` URL.
- Follow the existing server-action and Supabase cookie patterns in [`lib/actions/pets.ts`](../lib/actions/pets.ts) and [`lib/supabase/server.ts`](../lib/supabase/server.ts). Do not cache session, score, or heartbeat data. Load them the way [`lib/dashboard.ts`](../lib/dashboard.ts) loads pets.
- New tests stay on `node:test` and `npm test`. Do not add a second test runner.

## Phases

| Phase | Plan | Depends on | Outcome |
| --- | --- | --- | --- |
| 1 | [Domain model](plans/01-domain-model.md) | pet desk | Sessions, blocklist, scores, and the score function in Supabase |
| 2 | [Dashboard study controls](plans/02-dashboard-study-controls.md) | 1 | Start, stop, blocklist, past scores, and an `aurafarm://` link |
| 3 | [Score API](plans/03-score-api.md) | 1 | Token-authenticated `POST` that writes points and opens a score screen |
| 4 | [Godot web mini-game](plans/04-godot-web-minigame.md) | pet desk | A real web export in the desk iframe |
| 5 | [Roaming desktop pet](plans/05-roaming-desktop-pet.md) | none (same Godot project as 4) | A Windows pet that walks the whole screen |
| 6 | [Download, pairing, and wake-up](plans/06-download-pairing-wakeup.md) | 2, 5 | Hosted download, device heartbeat, one-time code claim |
| 7 | [Browser extension](plans/07-browser-extension.md) | 6 | Closes blocklist tabs and tells the pet |
| 8 | [Pet scoring action](plans/08-pet-scoring-action.md) | 3, 7 | The pet submits the score and opens the desk |
| 9 | [Packaging](plans/09-packaging.md) | 6, 7, 8 | Signing notes, updates, privacy note, optional native messaging |

Order: 1, then 2 and 3. Phase 4 can proceed beside phase 5. Phase 6 needs 2 and 5. Phase 7 needs 6. Phase 8 needs 3 and 7. Phase 9 is last. Phase 4 and phase 5 stay separate exports so the web game can ship before the desktop pet exists.

## Settled decisions

- Wake-up: `aurafarm://session?code=…`. The pet exchanges that code with the API over HTTPS. The code is single-use, expires in 5 minutes, and is shorter than the session token. The link is safe to land in browser history.
- Presence: the pet heartbeats every 10 seconds. The desk treats a heartbeat newer than 30 seconds as "running".
- Local link: WebSocket on `127.0.0.1:47331` between the extension and the pet. Chrome native messaging can replace it in phase 9.
- Blocklist: server-owned table. The first hosts are `instagram.com`, `tiktok.com`, and `youtube.com`. A host matches itself and its subdomains.
- Score: `scoreForBlockedCount` in `lib/scoring.ts`. The pet does not invent the point value. The database function uses the same two numbers.
- Auth for the exe: a short-lived session token returned when the launch code is claimed. The pet does not store the user's Supabase password. Device heartbeats use a separate device token from pairing.
- First blocklist event during a session is enough to make the score the lower one. Closing the tab is the extension's job. The pet only needs the count and the hostnames that were blocked.

## What a small plan is for

Implement that file only. Leave the later phases' files unbuilt. When a decision in a small plan conflicts with this page, this page wins, and the small plan should be edited before the code changes.
