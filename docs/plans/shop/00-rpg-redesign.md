# Phase 0 — RPG restyle

Status: implemented. The pages use the HUD and panel frame. Points are still not shown.

Depends on: the current website. No schema change.

## Goal

Restyle the existing pages so the desk feels like a stylish 2D RPG menu. The reference is a modern game HUD, close to a clean party screen, not an 8-bit or CRT costume. Keep the moss, cream, and slime-green palette. Change the frames, type hierarchy, and layout.

Pages in this pass:

- `/`
- `/login` and `/register`
- `/dashboard`, including the study panel, pet status, inventory section, and Godot frame chrome
- `/dashboard/sessions/[id]`
- `/privacy`

Shop and inventory routes do not exist yet. This phase leaves shared panel and HUD classes so phases 2–4 can use them without a second visual pass.

## Look

- Dark moss field stays. Panels sit on it as ink-glass plates with a 1px gold rule and a 14px radius. Drop the 28px pill cards.
- Titles stay in Fraunces. Body stays in Outfit. No pixel font, scanlines, or chunky beveled borders.
- The top bar becomes a HUD: wordmark on the left, the farmer's name and sign-out on the right. Leave a stat cluster in that right side with no number in it. Phase 2 fills the cluster with `profiles.points`.
- The public header uses the same HUD frame and does not grow a stat cluster.
- Commands are short rounded rectangles, radius 10px. Slime green remains the confirm color. Ghost commands keep a cream outline. Focus rings stay visible. `prefers-reduced-motion` still disables the slime bob.
- The desk reads as a game screen. The Godot frame is the viewport. The side column is a quest log: the download panel, the study session, then owned pets. Inventory rows become slots with a portrait, name, level, and one equip command.
- The study panel includes the "Close blocked tabs" control. Restyle it. Leave it On or Off exactly as it is, and keep the 8 second copy.
- The download panel is a download link only. Do not bring back "Pet is running" or "Pair this computer".
- The privacy page keeps the line that the pet closes the front blocklist tab after 8 seconds. Do not restore "It does not close tabs."
- The homepage is a title screen: the same headline and two actions, with the slime on a framed stage. It does not show a point balance.
- Login and register use one framed panel on that title-screen background.
- The score screen keeps its current words and numbers. Only the frame and type change.

## Out of scope

New routes, copy changes that alter what a button does, `profiles.points`, shop behavior, and any edit under `godot/` or `desktop/`. The iframe may keep the pet type in its query string. That query is a display hint for the web mini-game, not the study-session link.

## Touch

- `app/globals.css` for the HUD, panel, slot, and command classes
- `components/site-header.tsx` and `components/public-header.tsx`
- `components/dashboard-screen.tsx`, `components/pet-inventory.tsx`, `components/study-panel.tsx`, `components/pet-status.tsx`
- `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/privacy/page.tsx`, `app/dashboard/sessions/[id]/page.tsx`
- `app/dashboard/loading.tsx` so the fallback uses the same HUD and viewport shape

## Done when

- The five pages above use the HUD and panel frame, and the public pages still have no point balance.
- Text contrast and keyboard focus still meet the current focus-ring behavior.
- `npm test` passes. This phase adds no test about color values.
- The Godot export and the Electron pet window are unchanged.
