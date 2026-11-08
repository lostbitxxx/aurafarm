# Phase 6 — Tests

Status: for review. This is the last check for the set. Each earlier phase already names the tests that land with it. This file is the list that must be green before the set is called done.

Depends on: phases [1](01-points-and-purchase.md) through [5](05-equipped-pet-on-session.md).

## Goal

`npm test` locks the wallet, the purchase rules, the auth guards, and the session link. No second test runner. SQL behavior is checked by reading the migration, the same way `tests/pets.test.ts` reads `0001`.

## Cases

Catalog and starter, in `tests/pets.test.ts`:

- `baby_slime` is the starter, level 1, desktop active, and absent from `shopCatalog()`.
- Every `shopCatalog()` entry has price 100.
- `describePet` returns the catalog name for `lantern_moth` and `river_newt`.

Migration `0008_pet_shop.sql`:

- The text adds `profiles.points` with default 100 and a `points >= 0` check.
- It creates `purchase_pet`, locks the profile row, rejects an owned type, subtracts 100, and inserts an inactive `user_pets` row.
- It creates a unique index on `(user_id, pet_type)`.
- It drops the authenticated insert policy on `user_pets`.
- It does not grant `authenticated` an update on `profiles.points`.
- It still grants `authenticated` an update on `profiles.close_blocked`.

Proxy:

- The unauthenticated redirect list includes `/dashboard`, `/shop`, and `/inventory`.
- `/`, `/login`, `/register`, and `/privacy` are not in that list.

Session link, in the existing desktop link test:

- `aurafarm://session?code=ABC234` keeps only `code`.
- `aurafarm://pair?token=…` stays null. Do not teach the parser to read a pair token again.
- A session URL that also has `pet` or `user` is not treated as a pet selector. The parser may ignore the extra field, but no helper may return it as the character to draw.

Header:

- A pure helper is not required for rendering. The review check is that `PublicHeader` has no `points` prop and `SiteHeader` renders the number it is given. If that is awkward to assert without a DOM runner, cover it by reading the component source in the test the way `tests/pets.test.ts` reads `next.config.ts`.

## Out of scope

A live Supabase round trip in `npm test`. The migration text and the pure helpers are the automated check. A manual pass against the linked project is listed in the phase 1 and phase 3 "Done when" sections.

## Done when

- `npm test` passes.
- The cases above fail if the price stops being 100, the starter becomes buyable, the insert policy returns, or the launch link gains a pet parameter.
