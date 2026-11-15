# Aurafarm

Aurafarm is a study desk and a Mac desktop pet that share one account. The website is where a farmer signs up, picks a study plan, and keeps pixel pets in a living room. The pet is a separate Electron app that walks the desktop and, during a study session that farmer started, reads the address bar of the front browser window.

Signup creates a Supabase user, a `public.profiles` row, and a level 1 Baby Slime in `public.user_pets` with `is_desktop_active` set. Finished study sessions award experience. Study days and streaks use the `Asia/Hong_Kong` calendar.

## The two programs

**Desk.** Accounts, `/customize`, a living room, study sessions, a shop, pets, a collection, songs, achievements, friends, leaderboards, and farm crews. Those open as dialogs on the dashboard. A first visit walks through Shop, Collection, Pets, Achievements, Song, Social, and starting a session. A session runs as a website timer or hands off to the desktop pet.

After signup, `/customize` saves a study mode (Assassin, Knight, or Lord) with a session length and monthly and daily goals.

**Desktop pet.** A Mac Electron window the size of the sprite, in [`desktop/`](desktop/). Windows packaging is still waiting. The pet reads the frontmost Safari, Chrome, or Edge address bar itself during a claimed session. It compares that host with `blocklist_hosts` (seeded with Instagram, TikTok, and YouTube; a host matches itself and its subdomains). It reads that front address only: background tabs, page contents, and passwords stay out of reach. When close blocked tabs is on, it closes that front tab after the host has stayed on the blocklist. Stopping the session or quitting the pet stops the check. `/privacy` states the same limits.

The server stores the duration, the experience, and the blocked hostnames for that session. The pet reports the duration and the hosts. The server computes the experience.

## Requirements

- Node.js 20.9 or newer
- A [Supabase](https://supabase.com/dashboard) project
- macOS, to run or pack the desktop pet

## Database

Apply the SQL yourself in the Supabase SQL editor. This repo has no migration runner.

1. Open **SQL Editor** and choose **New query**.
2. Copy the next file under [`supabase/migrations`](supabase/migrations), paste it, and run it.
3. Continue in filename order. Each file expects the ones before it. Two files can share a number prefix; the full filename still decides the order (`0023_assassin_session_30.sql` before `0023_shop_level_unlock.sql`).

A new project starts at `0001_profiles_and_user_pets.sql`. A project that already has some of these applied starts at the first file that has not been run.

In **Authentication**, turn **Confirm email** off so a new account continues into `/customize` immediately. The signup trigger creates the profile and the level 1 baby slime. `SUPABASE_SECRET_KEY` is optional and is not required for that trigger.

## Configure

Copy [`.env.example`](.env.example) to `.env.local` and leave `.env.local` untracked.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL from **Project Settings → API** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key. Older projects can set `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead |
| `SUPABASE_SECRET_KEY` | no | Server key. Older projects can set `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_PET_DOWNLOAD_URL` | no | Absolute URL of the hosted Mac zip. The desk download button and `GET /api/pet/version` both use it |
| `AURAFARM_API_ORIGIN` | no | Desk the packaged pet calls. `npm run pack` bakes this into the Mac zip |

## Run the desk

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | `node:test` files in [`tests/`](tests/), via `tsx`. No database required |

## Run the desktop pet

The pet reads the public Supabase values from the repo-root `.env.local`. Start the desk first when the pet should talk to the local site.

```bash
cd desktop
npm install
npm start
```

The sprite walks the Mac desktop. Click it to open the panel, then paste the launch code from the desk. A saved session token still restores an earlier sign-in. On startup the pet registers `aurafarm://` for the current user, so `aurafarm://session?code=…` opens this app and claims that code over HTTPS. The pet listens on no local port, and the session token stays out of the URL.

Build a Mac zip from `desktop/`:

```bash
npm run pack
```

The zip is written to `desktop/dist/` and is not committed. Host it outside this app and set `NEXT_PUBLIC_PET_DOWNLOAD_URL` to that address. A newer version there shows an update line in the pet. The pet opens the zip when asked and does not replace its own files.

`npm run pack` skips code signing. Sign a release with `npm run pack:signed` on a Mac that has `CSC_LINK` and `CSC_KEY_PASSWORD` in the environment. Keep the certificate and the password out of the repo. Until that signed zip is the download URL, the desk says to right-click the app and choose Open.

## Cross-origin isolation

[`next.config.ts`](next.config.ts) sends these headers on every dev and production response, except the dev HMR socket:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Layout

| Path | What it is |
| --- | --- |
| [`app/`](app/) | Next.js routes: home, login, register, customize, dashboard, session score, farm crew, privacy, admin, and the pet and score APIs |
| [`components/`](components/) | Desk UI |
| [`lib/`](lib/) | Server actions, scoring, study plans, and Supabase clients |
| [`desktop/`](desktop/) | Mac Electron pet |
| [`supabase/migrations/`](supabase/migrations/) | SQL applied by hand, in filename order |
| [`tests/`](tests/) | `node:test` files |
| [`docs/`](docs/) | Day-to-day setup, the study-session plan, and debug notes |

## More

- [docs/basics.md](docs/basics.md) — git, applying SQL, and the same start commands
- [docs/PLAN.md](docs/PLAN.md) — study-session decisions. Later work in the repo goes past that plan
- [docs/debug-pet.md](docs/debug-pet.md) and [docs/debug-score.md](docs/debug-score.md) — what the pet and score logs mean
