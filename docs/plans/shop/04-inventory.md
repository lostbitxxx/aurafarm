# Phase 4 — Inventory

Status: for review. Do not build this until phases 1 and 2 are accepted. It can follow phase 3 or land beside it.

Depends on: [phase 1](01-points-and-purchase.md) and [phase 2](02-points-header.md). The shop is what puts a second pet in this list.

## Goal

Move the owned-pet list onto `/inventory`. Equipping still updates `user_pets` through `equip_pet_to_desktop`. A pet bought in the shop shows up here because it is a `user_pets` row.

## Auth

Same rule as `/shop`. The proxy redirects anonymous `/inventory` to `/login`, including when Supabase is not configured. The loader calls `getClaims()` and redirects before the query.

The query selects `id, pet_type, level, is_desktop_active` for `user_id = claims.sub`, ordered as the desk orders them today. Row-level security is the backstop. Use the cookie client, not the admin client.

## Page

Use the phase 0 slot frame and the phase 2 header. Move `components/pet-inventory.tsx` onto this page. Keep the optimistic equip and the error rollback.

`equipPetToDesktop` also revalidates `/inventory`. It still revalidates `/dashboard`.

The desk no longer renders the full pet grid. It keeps one line for the equipped pet's name and a link to `/inventory`. The study panel, including the close-blocked control, stays on the desk. The download panel stays a download link, with no pairing control.

Add Inventory to the signed-in HUD. The public header does not link to it.

The starter slime is on this page after signup, already equipped. A purchased pet appears unequipped until the farmer equips it.

## Out of scope

Deleting pets, levels, and changing which scene the Godot iframe draws. The iframe can keep reading the equipped pet the way `buildGodotFrameSrc` does today.

## Touch

- `app/inventory/page.tsx`
- `components/pet-inventory.tsx`
- `components/dashboard-screen.tsx`
- `lib/actions/pets.ts`
- `lib/supabase/proxy.ts`
- `components/site-header.tsx`

## Done when

- Anonymous `/inventory` redirects to `/login`.
- The page lists that user's pets, including `baby_slime` and any pet bought from the shop.
- Equip clears the previous `is_desktop_active` flag and sets it on the chosen row. Another user's pet id still fails.
- The desk shows the equipped name and links here, and it no longer renders the full grid.
