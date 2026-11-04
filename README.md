# Aurafarm

A Next.js desk for a Godot 4 pet. Registration creates a Supabase user, a `public.profiles` row, and a level 1 `baby_slime` in `public.user_pets` with `is_desktop_active` set. The dashboard lists those pets and equips one to the desktop iframe at `/godot-game/index.html`.

## Setup

1. Create a Supabase project and run [`supabase/migrations/0001_profiles_and_user_pets.sql`](supabase/migrations/0001_profiles_and_user_pets.sql), then [`supabase/migrations/0002_study_sessions.sql`](supabase/migrations/0002_study_sessions.sql), in the SQL editor.
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in the project URL and publishable key. Add `SUPABASE_SECRET_KEY` when email confirmation is enabled, so signup can insert the profile and starter pet before a session exists. The migration also installs a signup trigger that creates those rows inside the auth transaction.
3. Install and start the dev server:

```bash
npm install
npm run dev
```

4. Replace [`public/godot-game/index.html`](public/godot-game/index.html) with your Godot 4 web export. Keep the files in that folder so the dashboard iframe keeps loading `/godot-game/index.html`.

## SharedArrayBuffer

`next.config.ts` sends these headers on every dev and production response, including the Godot files:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

The placeholder frame reports whether `SharedArrayBuffer` is available.

## Study sessions

The desktop pet, browser extension, and scoring work is planned in [`docs/PLAN.md`](docs/PLAN.md). Each phase has its own small plan in [`docs/plans`](docs/plans).
