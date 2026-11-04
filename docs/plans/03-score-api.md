# Phase 3 — Score API

Status: done. `POST /api/sessions/:id/score` parses the sample body, writes 40 or 100 through `submit_study_score`, and returns the score-screen URL. A second submit is 409. `/dashboard/sessions/[id]` shows the score to the signed-in owner and redirects everyone else to login. Existing databases need [`0003_score_submit_status.sql`](../../supabase/migrations/0003_score_submit_status.sql). Databases whose `profiles` table has `email` and no `display_name` also need [`0004_profile_display_name.sql`](../../supabase/migrations/0004_profile_display_name.sql) before signup can create a user.

Depends on: [phase 1](01-domain-model.md). It does not need the dashboard panel, but the score screen should sit on the desk the panel will also use.

## Goal

The pet, or any client that has the session token, can submit one result. The server writes `40` or `100`. The response includes the desk URL the pet will open. A signed-in farmer can open that URL and see the score.

## Out of scope

The Godot button that calls this route (phase 8), the extension, and awarding points from a dashboard click. The desk does not get a "give me 100" button.

## Touch

- `app/api/sessions/[id]/score/route.ts`
- `lib/scoring.ts` — request body parser and response shape, next to the formula from phase 1
- `app/dashboard/sessions/[id]/page.tsx` — score screen
- `lib/dashboard.ts` or a sibling `lib/study-score.ts` loader
- `tests/score-api.test.ts` for the parser and for a fixture of the JSON body

## POST `/api/sessions/:id/score`

Body:

```json
{
  "token": "<session secret>",
  "duration_seconds": 1200,
  "blocked_count": 1,
  "blocked_hosts": ["www.instagram.com"]
}
```

- Parse JSON. Reject a missing token, a non-integer duration, a non-integer count, or a `blocked_hosts` value that is not an array of strings. Cap the array at 20 entries before calling SQL.
- Call `submit_study_score` with the service role or an admin client only if the function's execute grant is not enough. Prefer the user-less server client (anon key) because the function is granted to `anon` and checks the token itself. Do not accept a Supabase user JWT as a substitute for the token.
- On success, respond `200` with:

```json
{
  "points": 40,
  "distracted": true,
  "url": "https://<host>/dashboard/sessions/<id>"
}
```

Build `url` from the incoming request origin so dev and production both work.

- On a bad token or a session that is not `active`, respond `403` with `{ "error": "..." }`. On a malformed body, `400`. Do not reveal whether the session id exists separately from whether the token matched.
- A second submit is `409`.

No `Access-Control-Allow-Origin: *` for cookie use. The pet is not a browser page. Same-origin browser calls can still be made later. Skip CORS headers unless a real browser client appears.

## Score screen

`/dashboard/sessions/[id]` uses the normal session cookie via [`lib/supabase/proxy.ts`](../../lib/supabase/proxy.ts). A signed-out visit redirects to `/login`.

Load the score for that id and user. Show points, "Focused" or "Distracted", duration, and the blocked host labels. A session that is still `active` shows that the pet has not submitted yet. A `cancelled` session says it was stopped. Another user's id shows the same not-found state as a missing id.

## Done when

- `npm test` accepts the example body and rejects a string duration, a missing token, and a host list that is not an array.
- Submitting the sample body with a real token against a local Supabase writes `study_scores.points` of `40`, marks the session `submitted`, and returns a `url` on this origin.
- The same call again returns `409`.
- Opening the `url` while signed in as the owner shows 40 and Instagram. Opening it signed out redirects to login.
