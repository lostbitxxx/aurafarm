# Phase 2 — Points in the header

Status: for review. Do not build this until phase 1 is accepted.

Depends on: [phase 1](01-points-and-purchase.md). Uses the HUD stat cluster left empty by [phase 0](00-rpg-redesign.md).

## Goal

Show `profiles.points` on every signed-in page. The public homepage, login, register, and privacy page stay without that number.

## Load

`loadDashboard` already requires `getClaims()` and redirects to `/login`. Extend that profile read to include `points`, and pass the number into `SiteHeader`.

The session score page at `/dashboard/sessions/[id]` uses `SiteHeader` too. Its loader must select the same `points` value for the signed-in user. Do not read another user's balance. The score page already loads the session through the user-scoped client.

`SiteHeader` renders the number in the reserved stat cluster, with a short label such as "Points". Format it as a plain integer. Do not add a plus or minus control.

`PublicHeader` does not accept or render points.

## Out of scope

Links to `/shop` and `/inventory`. Those land with the pages in phases 3 and 4. This phase does not spend points.

## Touch

- `lib/dashboard.ts`
- `lib/study-score.ts`, or the score page loader if the balance is read beside it
- `components/site-header.tsx`
- The dashboard and session score pages, so both pass `points`

## Done when

- A signed-in desk and a signed-in score screen show the profile's current `points`.
- `/`, `/login`, `/register`, and `/privacy` do not show a balance.
- Signing out still returns to `/login`.
- An anonymous request to `/dashboard` still redirects to `/login`.
