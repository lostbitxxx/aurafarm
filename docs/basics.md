# Aurafarm basics

Short notes for everyday git, applying the database SQL in the Supabase dashboard, and starting the website and the Mac desktop pet.

## Git

The repo is [github.com/lostbitxxx/aurafarm](https://github.com/lostbitxxx/aurafarm). Work on a branch, then open a pull request into `main`.

First time on a machine:

```bash
git clone https://github.com/lostbitxxx/aurafarm.git
cd aurafarm
```

Before you change anything, update `main` and start a branch:

```bash
git checkout main
git pull
git checkout -b your-name/short-change
```

See what you changed, then save it:

```bash
git status
git diff
git add path/to/file
git commit -m "Say what changed"
git push -u origin your-name/short-change
```

Useful checks:

- `git status` shows changed files and the current branch.
- `git diff` shows the unstaged edits.
- `git log --oneline -10` shows recent commits.

Leave `.env.local` untracked. It holds Supabase keys. The template to copy is `.env.example`.

## SQL in the Supabase SQL editor

There is no migration runner in this repo. Paste each file into the Supabase SQL editor and run it yourself.

1. Open the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** and choose **New query**.
3. Open the next file under [`supabase/migrations`](../supabase/migrations), copy the whole file, and paste it into the editor.
4. Click **Run**. Wait until it finishes with no error.
5. Repeat for the next file. Run them in filename order. Each file expects the ones before it.

| File | What it adds |
| --- | --- |
| `0001_profiles_and_user_pets.sql` | Profiles, pet inventory, equip, and the signup trigger |
| `0002_study_sessions.sql` | Study sessions and the blocklist |
| `0003_score_submit_status.sql` | Clearer result when a score is submitted twice |
| `0004_profile_display_name.sql` | `display_name` on older profile tables |
| `0005_user_pets_created_at.sql` | `user_pets.created_at` when an older table is missing it |
| `0006_pet_devices.sql` | Pet installs and the one-time study-session claim |
| `0007_close_blocked.sql` | Toggle for closing a blocked tab |
| `0008_pet_shop.sql` | Point balance and `purchase_pet` |
| `0009_score_wallet.sql` | Finished study scores add points |
| `0010_score_wallet_points.sql` | Fixes the points update inside the score function |
| `0011_study_timer_xp.sql` | Study countdown length and pet experience |
| `0012_profile_email_optional.sql` | Lets `profiles.email` be empty on older tables |

A new project starts at `0001` and goes through `0012`. A project that already has some of these applied starts at the first file that has not been run.

In the same dashboard, under **Authentication**, turn **Confirm email** off so a new account opens the desk right away. Signup creates the profile and a level 1 baby slime.

## Run the website

From the repo root, copy the env file and fill in the project URL and publishable key from **Project Settings → API** in Supabase:

```bash
cp .env.example .env.local
```

`SUPABASE_SECRET_KEY` is optional. The signup trigger creates the profile and starter pet without it.

Then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run dev` is the Next.js desk. `npm test` runs the tests in `tests/`.

## Run the desktop pet

The pet is a Mac Electron app. It reads the public Supabase values from the repo-root `.env.local`, the same file the website uses. Start the website first if you want the pet to talk to the local desk.

```bash
cd desktop
npm install
npm start
```

The sprite walks the desktop. Click it to sign in, or paste a launch code from the desk. On startup the pet registers `aurafarm://` for the current user, so `aurafarm://session?code=…` opens this app.

`npm run pack` from `desktop/` writes an unsigned Mac zip to `desktop/dist/`. That folder is not committed. Host the zip somewhere else and set `NEXT_PUBLIC_PET_DOWNLOAD_URL` in `.env.local` so the desk download button points at it.
