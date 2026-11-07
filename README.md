# Aurafarm

A Next.js desk for a Godot 4 pet. Registration creates a Supabase user, a `public.profiles` row, and a level 1 `baby_slime` in `public.user_pets` with `is_desktop_active` set. The dashboard lists those pets and equips one to the desktop iframe at `/godot-game/index.html`.

## Setup

1. Create a Supabase project and run the SQL files in [`supabase/migrations`](supabase/migrations) in order, from `0001` through `0006`, in the SQL editor. `0005` adds `user_pets.created_at` when an older table is missing it. `0006` adds pet devices, heartbeats, and session claim.
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in the project URL and publishable key. Add `SUPABASE_SECRET_KEY` when email confirmation is enabled, so signup can insert the profile and starter pet before a session exists. The migration also installs a signup trigger that creates those rows inside the auth transaction.
3. Install and start the dev server:

```bash
npm install
npm run dev
```

4. The desk already loads the committed Godot 4.5.2 export in [`public/godot-game`](public/godot-game). Rebuild that folder from [`godot`](godot) with the same editor when the scene changes, and leave thread support off.

The Godot Windows pet has been removed. The next desktop pet is Electron and is not in this repo yet. Pairing routes remain on the desk. Set `NEXT_PUBLIC_PET_DOWNLOAD_URL` when a build is hosted outside this app.

## SharedArrayBuffer

`next.config.ts` sends these headers on every dev and production response, including the Godot files:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

The placeholder frame reports whether `SharedArrayBuffer` is available.

## Study sessions

Study sessions, the web pet, and pairing are in the repo. The Godot Windows pet has been removed. The Electron pet, the frontmost-site reader, and the scoring action are still planned in [`docs/PLAN.md`](docs/PLAN.md). There is no browser extension.
