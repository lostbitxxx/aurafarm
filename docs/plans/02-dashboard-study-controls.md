# Phase 2 — Dashboard study controls

Status: done. The desk shows the blocklist, starts one session, shows the `aurafarm://` code once, and cancels it. `npm test` covers the launch URL and the active-session guard. Against the linked Supabase project, a signed-in user can insert one active session, a second insert is rejected, cancel sets `cancelled`, and `session_token_hash` stays null.

Depends on: [phase 1](01-domain-model.md).

## Goal

A signed-in farmer can start one study session, see the blocklist, cancel the session, and see past scores. Starting a session shows an `aurafarm://session?code=…` link. Nothing local has to be listening.

## Out of scope

Claiming the code, pet heartbeat, the download button, changing the Godot iframe, and submitting a score from the browser. Cancelling is the desk's stop button. The score `POST` is phase 3.

## Touch

- `lib/study.ts` — record types and `buildPetLaunchUrl(code: string)`
- `lib/actions/study.ts` — `startStudySession`, `cancelStudySession`
- `lib/dashboard.ts` — also load the active session, the latest 10 scores, and `blocklist_hosts`
- `components/study-panel.tsx` — client panel for the start and cancel buttons
- `components/dashboard-screen.tsx` — render the panel beside the inventory, inside `<main className="desk">`
- `tests/study.test.ts` — launch URL and the "already active" guard's pure decision, if any of that logic is extracted

Follow [`lib/actions/pets.ts`](../../lib/actions/pets.ts): check the Supabase env, `getClaims()`, return `{ error }` strings, and `revalidatePath("/dashboard")`.

## Start

1. Require a signed-in user.
2. If that user already has a row with `status = 'active'`, return an error and leave the row alone. The partial unique index is the race backstop.
3. Generate a launch code with `createLaunchCode`. Store only `launch_code_hash`. Leave `session_token_hash` null. `launch_code_expires_at` is 5 minutes after insert.
4. Insert the session with the user-scoped server client.
5. Return the raw launch code to the panel once. Phase 6 creates the session secret when the pet claims this code, and returns that secret to the pet only.

The panel renders `aurafarm://session?code=CODE` as a link and as selectable text. Say that the desktop pet will open this link later, and that the code expires in 5 minutes.

## Cancel

Call `cancel_study_session` for the active session id. The panel then shows the start button again.

## What the panel shows

- Blocklist labels from `blocklist_hosts`, in host order.
- Active session: started time, the launch link, and Cancel.
- No active session: Start study session.
- Past scores: points, distracted or focused, duration, and blocked hosts. Empty state: no sessions scored yet.
- Errors from the actions use the same `form-error` pattern as the pet inventory.

Format times in the UI. The database stays `timestamptz`.

## Done when

- `npm test` asserts `buildPetLaunchUrl("AB12CD34EF")` is `aurafarm://session?code=AB12CD34EF` and that the code is the only query parameter.
- Starting a session while signed in inserts one `active` row. The page shows the launch link. A second start fails with a visible error and does not create a second active row.
- Cancel sets that row to `cancelled`. The start button comes back.
- The page lists the seeded blocklist and any `study_scores` rows for the user.
- The launch code is in the HTML. `session_token_hash` is still null, and no session secret is rendered.
