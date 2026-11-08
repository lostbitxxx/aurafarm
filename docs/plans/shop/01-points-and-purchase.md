# Phase 1 — Points and purchase

Status: implemented. The migration, catalog, and tests are in the repo. Run `0008_pet_shop.sql` after `0007`.

Depends on: [phase 0](00-rpg-redesign.md) for the order of work. The migration itself does not depend on the CSS.

## Goal

Give every profile a spendable balance and one database transaction that buys a catalog pet. The website does not grow a shop page in this phase.

## Wallet

Add `profiles.points integer not null default 100 check (points >= 0)` in `supabase/migrations/0008_pet_shop.sql`, after `0007_close_blocked.sql`.

The default covers two cases:

- `handle_new_user` keeps inserting `(id, display_name)` and the new row starts at 100.
- Existing profiles receive 100 when the column is added, so a current farmer can buy one pet.

Do not add `study_scores.points` into this column. Focused 100 and distracted 40 stay on the session score only.

## Catalog

Keep the catalog in `lib/pets.ts`. Each entry has `pet_type`, `name`, `note`, and `price`.

- `baby_slime` stays the starter. Price is omitted, and the shop helper excludes it.
- Two purchasable pets, both price 100. Names for review: `lantern_moth` ("Lantern Moth") and `river_newt` ("River Newt"). The behavior does not change if the names change before implementation. The price stays 100 for every shop entry.

`describePet` keeps using this catalog.

## Purchase

`public.purchase_pet(target_pet_type text)` is one transaction:

1. Reject an anonymous caller.
2. Reject a type that is not in the shop catalog. `baby_slime` is rejected here.
3. Lock the caller's `profiles` row.
4. Reject the purchase when a `user_pets` row already exists for that user and type.
5. Reject the purchase when `points < 100`.
6. Subtract 100 from `points` and insert `user_pets` with `level = 1` and `is_desktop_active = false`.

`security definer`, `search_path = public`. Revoke from `public`. Grant execute to `authenticated` only.

The price check in SQL must match the catalog constant. A test reads both so they cannot drift.

## Who can write

A signed-in user must not be able to set their own balance or insert a pet.

- Replace the table-wide update grant on `profiles` with update on `display_name` and `close_blocked` only. `setCloseBlocked` writes `close_blocked` as the signed-in user, so that column stays writable. `purchase_pet` updates `points` as definer.
- Replace the table-wide insert grant on `profiles` with insert on `id, display_name` only.
- Drop `user_pets_insert_own` and the `authenticated` insert grant on `user_pets`.
- Leave select and the equip update path. `equip_pet_to_desktop` stays the way to change `is_desktop_active`. The partial unique index still allows one active pet per user.
- Add a unique index on `(user_id, pet_type)`.

`handle_new_user` is already `security definer`, so signup can still insert the starter slime. `saveNewFarmer` stops inserting into `user_pets`. If the trigger already created the starter, the function returns success after the profile upsert. It must not report an error when the insert policy is gone.

## Out of scope

`/shop`, `/inventory`, the header number, awarding points from study sessions, and any Godot or Electron change.

## Touch

- `supabase/migrations/0008_pet_shop.sql`
- `lib/pets.ts` for the catalog and a pure `shopCatalog()` helper
- `lib/farmers.ts` so the client insert of the starter pet is gone
- `tests/pets.test.ts` for the catalog, the starter record, and the migration text

## Done when

- A new profile has `points = 100`. An existing profile has 100 after the migration.
- `purchase_pet('lantern_moth')` subtracts 100 and inserts one inactive row. A second call does not change the balance and does not insert another row.
- `purchase_pet('baby_slime')` and an unknown type do nothing.
- A user with fewer than 100 points cannot buy.
- From the browser session, `insert` into `user_pets` fails, and `update profiles set points = …` fails.
- `setCloseBlocked` still updates `profiles.close_blocked`.
- Signup still creates one active level 1 `baby_slime`.
