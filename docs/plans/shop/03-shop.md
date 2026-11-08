# Phase 3 — Shop

Status: implemented. `/shop` lists the catalog and calls `purchase_pet`. It uses the current desk cards, not the rejected restyle.

Depends on: [phase 1](01-points-and-purchase.md) and [phase 2](02-points-header.md).

## Goal

A signed-in farmer can open `/shop`, see the catalog, and buy a pet for 100 points. The bought pet is a `user_pets` row. The header balance drops by 100.

## Auth

`/shop` requires a session in both places:

- `lib/supabase/proxy.ts` redirects to `/login` when `claims.sub` is missing, the same way `/dashboard` does. Include this path when Supabase is not configured too.
- The page loader calls `getClaims()` and redirects to `/login` before reading pets or points.

Use `createClient()` from `lib/supabase/server.ts`. Do not use `createAdminClient()`.

## Page

The page uses the phase 0 panel frame and the phase 2 header.

List `shopCatalog()` only. `baby_slime` is absent. Each card shows the name, note, and the price 100.

- A type the user already owns says "Owned" and has no buy command.
- A type the user can afford calls a server action.
- A type the user cannot afford keeps the buy command disabled and says the balance is too low.

The server action checks the pet type against the catalog, then calls `purchase_pet`. It returns `{ error }` the way `equipPetToDesktop` does. On success, revalidate `/shop`, `/inventory`, and `/dashboard` so the header and the later inventory page see the new row and the new balance.

Errors to show: already owned, not enough points, unknown type, and not signed in. The balance does not change on an error.

Add Shop to the signed-in HUD. The public header does not link to it.

## Out of scope

Selling pets, changing the 100-point price per pet, earning points, and editing Godot or Electron.

## Touch

- `app/shop/page.tsx`
- `components/shop-screen.tsx`, or the same screen split the way the desk is split
- `lib/actions/pets.ts` for `buyPet(petType: string)`
- `lib/supabase/proxy.ts`
- `components/site-header.tsx` for the Shop link

## Done when

- Anonymous `/shop` redirects to `/login`.
- The page lists the catalog pets at 100 points and does not list `baby_slime`.
- Buying `lantern_moth` with a balance of 100 leaves the balance at 0, inserts one inactive row, and the card switches to Owned.
- Buying an owned pet, `baby_slime`, or any type with a balance under 100 shows an error and leaves `points` and `user_pets` unchanged.
