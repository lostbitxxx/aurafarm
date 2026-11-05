# Aurafarm

A Next.js desk for a Godot 4 pet. Registration creates a Supabase user, a `public.profiles` row, and a level 1 `baby_slime` in `public.user_pets` with `is_desktop_active` set. The dashboard lists those pets and equips one to the desktop iframe at `/godot-game/index.html`.

## Setup

1. Create a Supabase project and run the SQL files in [`supabase/migrations`](supabase/migrations) in order, from `0001` through `0005`, in the SQL editor. `0005` adds `user_pets.created_at` when an older table is missing it. The desk lists pets without that column.
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in the project URL and publishable key. Add `SUPABASE_SECRET_KEY` when email confirmation is enabled, so signup can insert the profile and starter pet before a session exists. The migration also installs a signup trigger that creates those rows inside the auth transaction.
3. Install and start the dev server:

```bash
npm install
npm run dev
```

4. The desk already loads the committed Godot 4.5.2 export in [`public/godot-game`](public/godot-game). Rebuild that folder from [`godot`](godot) with the same editor when the scene changes, and leave thread support off.

The roaming pet is a separate Windows export and is not committed:

```bash
godot --headless --path godot --export-release "Windows Desktop" desktop/build/aurafarm.exe
```

Double-click `desktop/build/aurafarm.exe` on Windows. The window is the sprite, stays above other windows, and walks the usable area of each monitor. Clicks outside the sprite pass through.

## SharedArrayBuffer

`next.config.ts` sends these headers on every dev and production response, including the Godot files:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

The placeholder frame reports whether `SharedArrayBuffer` is available.

## Study sessions

The desktop pet, browser extension, and scoring work is planned in [`docs/PLAN.md`](docs/PLAN.md). Each phase has its own small plan in [`docs/plans`](docs/plans).
