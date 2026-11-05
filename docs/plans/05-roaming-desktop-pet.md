# Phase 5 — Roaming desktop pet

Status: implemented. The walk math passed a headless check on Godot 4.5.2. Launching the window over a real desktop still has to be checked on Windows.

Depends on: nothing on the website. Use the same `godot/` project created in phase 4. If phase 4 has not created it yet, create the project here and leave the Web preset for phase 4.

## Goal

A Windows export whose window is about the size of the sprite, transparent, borderless, and always on top. The pet walks across the usable area of every monitor. Clicks outside the sprite go to whatever window is underneath. The browser does not contain this window.

## Out of scope

Study sessions, the extension, pairing, the score button, and publishing the file. Those are phases 6 through 8. This phase is done when the pet can be launched by double-clicking the export and it walks the screen.

## Touch

- `godot/scenes/desktop_pet.tscn` — desktop main scene
- `godot/scripts/desktop_walk.gd` — position math
- `godot/export_presets.cfg` — Windows Desktop preset
- Export output under `desktop/build/`, gitignored
- A headless check, if the Godot binary is available, that runs the walk math without opening a window

Do not commit the `.exe` or `.pck`.

## Window

Project settings for this preset:

- Borderless window
- Per-pixel transparency allowed, transparent viewport background
- `DisplayServer.window_set_flag(WINDOW_FLAG_ALWAYS_ON_TOP, true)`
- Initial window size fits the sprite, on the order of 128×128, not the monitor size
- `DisplayServer.window_set_mouse_passthrough` with a polygon around the visible sprite pixels, so the rectangle's empty corners do not eat clicks

Walk:

- Read every screen with `DisplayServer.get_screen_count`, `screen_get_position`, and `screen_get_usable_rect`.
- Treat those rects as one walkable surface. When the pet reaches an edge, it turns or steps onto the next monitor if the usable rects touch.
- Move the window with `DisplayServer.window_set_position`. Keep the sprite inside the window.
- Skip the taskbar and dock by using the usable rect, not the full screen size.

The always-on-top window is the study-session behavior. Sitting behind other windows, above the wallpaper, needs an extra Win32 owner and is not part of this phase.

## Verify

Automated: extract the next-position function so `godot --headless` can assert a pet at the right edge of a 1920×1080 usable rect moves left or onto a second rect placed at x=1920. Skip that command in `npm test` when `godot` is not on `PATH`, and record the command in this file's implementation notes when it has been run.

Manual, on Windows: launch the export, open a browser, and watch the pet cross that window and the rest of the screen. Click a page beside the sprite and confirm the page receives the click. Click the sprite and confirm the pet receives it.

## Done when

- The Windows export launches as its own process and the pet crosses the usable desktop, including over a browser window.
- The window stays sprite-sized. The rest of the screen stays clickable.
- `desktop/build/` is gitignored and the executable is not in the commit.

## Implementation notes

Headless check, Godot 4.5.2, exit 0, printed `desktop walk ok`:

```text
godot --headless --path godot --script res://scripts/walk_check.gd
```

`npm test` runs that command when `godot` is on `PATH` and skips it otherwise.

Windows export, not committed:

```text
godot --headless --path godot --export-release "Windows Desktop" desktop/build/aurafarm.exe
```

The project keeps `run/main_scene` on the web pet. `run/main_scene.windows` selects `desktop_pet.tscn` for the Windows export, along with the 128×128 transparent borderless window. The export packed those overrides. This machine cannot launch the exe.
