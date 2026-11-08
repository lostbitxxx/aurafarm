# Phase 8 — Pet scoring action

Status: the pet shows one Finish control beside the sprite during a claimed session. A clear session submits `blocked_count: 0`. A blocklist visit switches the label to "Finish distracted session" and submits that count and host. A successful score or a `409` opens the score screen and hides the control. A failed submit leaves the control in place.

Depends on: [phase 3](03-score-api.md) and [phase 7](07-browser-extension.md).

## Goal

The Electron pet keeps the session clock and the blocked count from the frontmost-site reader. When the user finishes, the pet shows one action. Nothing blocked: the action submits the focused score. Something blocked: the action submits the distracted score. The pet then opens the score screen from the API response.

## Out of scope

Changing the point formula, a dashboard button that submits a score, and anti-cheat beyond the single-use token. The pet does not display a second button that would submit the other score. There is no loopback listener to close.

## Touch

- Electron: a small always-on-top window for the Finish label. It stays above other windows and does not grow to the monitor.
- `POST` the phase 3 body with the session token
- `tests/score-api.test.ts` — add the exact JSON example the pet sends, if phase 3's fixture is looser than this

## What the pet remembers

From claim: `session_id`, `token`, `blocklist`, API origin.

While the session runs:

- `started_at` from the moment claim succeeded
- `blocked_count` and `blocked_hosts` from the phase 7 reader
- The label: "Focused" while the count is 0, "Distracted" once it is greater than 0

The user ends the session from the pet (a "Finish" control on the sprite). The pet computes `duration_seconds` as the whole seconds since claim. It POSTs:

```json
{
  "token": "<session secret>",
  "duration_seconds": 1200,
  "blocked_count": 1,
  "blocked_hosts": ["www.instagram.com"]
}
```

to `{API}/api/sessions/{session_id}/score`.

On `200`, hide the action and open the returned `url` with `shell.openExternal`. On `409`, the score is already stored: still open `/dashboard/sessions/{id}` built the same way, and show that it was already submitted. On a network failure or `403`, leave the action in place and show a retry line. Do not clear the token until a `200` or `409`.

The visible wording:

- Count is 0: "Finish focused session"
- Count is greater than 0: "Finish distracted session"

Both call the same POST. Only the counts differ. The server decides `40` or `100`.

## Done when

- A session with no blocklist host in front submits `blocked_count: 0` and the score screen shows 100.
- After the frontmost site is Instagram once, the pet label switches to the distracted wording, the POST sends that host and a count of at least 1, and the score screen shows 40.
- A failed POST leaves the action available. A second successful submit returns `409` from the API and the pet opens the existing score screen instead of showing a new point value of its own.
