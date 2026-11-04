# Phase 4 — Godot web mini-game

Status: done. Editor pinned to Godot 4.5.2-stable.

Depends on: the pet desk iframe. It does not depend on study sessions. It can be built beside phase 5.

## Goal

Replace the placeholder in `public/godot-game/` with a Godot 4 web export. The mini-game stays inside the dashboard iframe and shows the pet that is equipped on the desk.

## Out of scope

The roaming desktop window, study sessions, tab closing, and scoring. Equipping a pet reloads this iframe. It does not move a window on the operating system.

## Touch

- `godot/` — one Godot 4 project. Pin the editor version in `godot/project.godot` and write that version at the top of this plan when the project is created. Use the 4.3 stable line or newer, and then stop moving it inside this phase.
- `godot/scenes/web_pet.tscn` and a script that reads the page query.
- `godot/export_presets.cfg` — Web preset, export path `../public/godot-game/index.html`.
- `public/godot-game/**` — committed export output, replacing the placeholder `index.html`.
- `.gitignore` — ignore `godot/.godot/` and `godot/.import/` if Godot writes those beside the project. Do not ignore `public/godot-game/`.
- `lib/pets.ts` — `buildGodotFrameSrc(pet: { pet_type: string; level: number } | null)`
- `components/godot-frame.tsx` — take the active pet and set `src` from that helper.
- `components/dashboard-screen.tsx` — pass the active pet.
- `tests/pets.test.ts` — the src helper.

Keep the headers in [`lib/cross-origin-isolation.ts`](../../lib/cross-origin-isolation.ts). The export needs `SharedArrayBuffer`.

## Game behavior

A single scene draws a slime (polygon or the existing visual language; no external asset CDN). On `_ready`, when `OS.has_feature("web")`, read `window.location.search` through `JavaScriptBridge.eval` and parse `pet` and `level`. Show that name and level. Unknown `pet` still draws the slime and shows the raw type.

`buildGodotFrameSrc` returns `/godot-game/index.html` when no pet is equipped, and `/godot-game/index.html?pet=baby_slime&level=1` when one is. Encode the pet type. The iframe `key` includes pet type and level so Equip to Desktop loads the new query.

Export with thread support only if the committed `index.html` still works under the existing COOP/COEP headers. Confirm `crossOriginIsolated === true` on `/dashboard` after `npm run dev`. Same-origin files only. Do not point the export shell at a CDN.

## Done when

- `npm test` covers `buildGodotFrameSrc` for a baby slime and for no active pet.
- `npm run dev`, sign in, and the iframe shows the Godot game instead of the placeholder sentence about replacing `public/godot-game`.
- The equipped pet's type and level are visible in the game. Equipping a different pet changes the query and reloads the frame.
- The browser reports `SharedArrayBuffer` as available on that page.
