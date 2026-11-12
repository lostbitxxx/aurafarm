# Aurafarm

A Next.js desk for a Godot 4 pet. Registration creates a Supabase user, a `public.profiles` row, and a level 1 `baby_slime` in `public.user_pets` with `is_desktop_active` set. The dashboard lists those pets and equips one to the desktop iframe at `/godot-game/index.html`.

## Setup

1. Create a Supabase project and run the SQL files in [`supabase/migrations`](supabase/migrations) in order, from `0001` through `0021`, in the SQL editor. Later files add study sessions, shop wallet, timers, collection colors, hats, and clothes, and `0021` study-mode customization (mode + monthly/daily goals).
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in the project URL and publishable key. In the Supabase dashboard, turn **Confirm email** off so a new account can continue into `/customize` immediately. The signup trigger creates the profile and level 1 baby slime. `SUPABASE_SECRET_KEY` is an optional server key.
3. Install and start the dev server:

```bash
npm install
npm run dev
```

4. The desk already loads the committed Godot 4.5.2 export in [`public/godot-game`](public/godot-game). Rebuild that folder from [`godot`](godot) with the same editor when the scene changes, and leave thread support off.

The desktop pet is a Mac Electron app. Windows is not built yet. From the repo root, with the public Supabase keys in `.env.local`:

```bash
cd desktop
npm install
npm start
```

The sprite walks the Mac desktop. Click it to sign in or paste a launch code. On startup the pet registers `aurafarm://` for the current user, so `aurafarm://session?code=…` opens this app.

Build a Mac zip from `desktop/` with `npm run pack`. The zip is written to `desktop/dist/` and is not committed. Host that zip outside this app and set `NEXT_PUBLIC_PET_DOWNLOAD_URL` to its address. The desk download button and `GET /api/pet/version` both use that address. A newer version there shows an update line in the pet; the pet opens the zip when asked and does not replace its own files.

`npm run pack` skips code signing. Sign a release with `npm run pack:signed` on a Mac that has `CSC_LINK` and `CSC_KEY_PASSWORD` in the environment. Do not commit the certificate or the password. Until that signed zip is the download URL, the desk says to right-click the app and choose Open.

## SharedArrayBuffer

`next.config.ts` sends these headers on every dev and production response, including the Godot files:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

The placeholder frame reports whether `SharedArrayBuffer` is available.

## Study sessions

Study sessions, the web pet, the Mac Electron pet, the frontmost-site reader, and the Finish score action are in the repo. What the pet can see is on `/privacy`. There is no browser extension, and there is no Windows pet.
