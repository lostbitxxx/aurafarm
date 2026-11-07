# Phase 5 — Roaming desktop pet

Status: the Godot window is removed. The Electron pet has not been started.

Depends on: nothing on the website. The web scene from phase 4 stays.

## Removed

The Windows pet is gone. That commit added no `desktop/` Electron source, sprite, or new scene. The web export, the desk, and the pairing routes stayed.

Delete:

- `godot/scenes/desktop_pet.gd`
- `godot/scenes/desktop_pet.gd.uid`
- `godot/scenes/desktop_pet.tscn`
- `godot/scripts/desktop_walk.gd`
- `godot/scripts/desktop_walk.gd.uid`
- `godot/scripts/walk_check.gd`
- `godot/scripts/walk_check.gd.uid`
- `godot/scripts/pet_link.gd`
- `godot/scripts/pet_link.gd.uid`
- `tests/desktop-walk.test.ts`
- `desktop/install-protocol.reg`

In `godot/export_presets.cfg`, remove preset.1, the Windows Desktop preset whose `export_path` is `../desktop/build/aurafarm.exe`. Keep the Web preset that writes `../public/godot-game/index.html`.

In `godot/project.godot`, remove every `.windows` override, including `run/main_scene.windows`. The web pet remains `run/main_scene`. Update the header comment so it no longer says the project has a Windows export.

Delete a local `desktop/build/` if one exists. It is gitignored.

Leave `godot/scenes/web_pet.*`, `public/godot-game/`, `user_pets`, Equip to Desktop, and the phase 6 routes. There is no `extension/` directory.

## Next

Build the Electron pet in `desktop/`.

The window is sprite-sized, frameless, transparent, and always on top. It walks the usable area of each monitor. Clicks outside the sprite pass through. Windows is the first target. One local image is `baby_slime`.

The pet signs in with the public Supabase key and stores the session with `safeStorage`. It reads the equipped row:

```ts
supabase
  .from("user_pets")
  .select("pet_type, level")
  .eq("is_desktop_active", true)
  .maybeSingle()
```

Row-level security already limits that to the signed-in user. When `pet_type` changes, the sprite swaps. `SUPABASE_SECRET_KEY` stays on the server.

Ignore `desktop/node_modules` and `desktop/dist`. Do not commit the packaged app.

The same app then calls the phase 6 routes that already exist: pair, heartbeat, and launch-code claim. It registers `aurafarm://` for the current user and points that protocol at the Electron executable. The dev app uses `http://localhost:3000`.

## Out of scope

The frontmost address-bar reader, the Finish button, packaging, and a browser extension. Those are phases 7 through 9. No Chrome extension is part of this plan.

## Done when

- The deletion landed with no Electron source. The Web preset is the only export preset, and `run/main_scene` is the web pet.
- A later commit launches the Electron window on Windows, shows the equipped pet from `user_pets`, and still walks over other windows with the surrounding screen clickable.
