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

There is no migration runner in this repo. Paste each file into the Supabase SQL editor and run it yourself. Environment variables and the rest of setup are in the [README](../README.md).

1. Open the project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** and choose **New query**.
3. Open the next file under [`supabase/migrations`](../supabase/migrations), copy the whole file, and paste it into the editor.
4. Click **Run**. Wait until it finishes with no error.
5. Repeat for the next file. Run them in filename order. Each file expects the ones before it. Two files can share a number prefix; the full filename still decides the order.

A new project starts at `0001_profiles_and_user_pets.sql` and continues through the last file in that folder. A project that already has some of these applied starts at the first file that has not been run.

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

The sprite walks the desktop. Click it to open the panel, then paste the launch code from the desk. On startup the pet registers `aurafarm://` for the current user, so `aurafarm://session?code=…` opens this app.

`npm run pack` from `desktop/` writes an unsigned Mac zip to `desktop/dist/`. That folder is not committed. Host the zip somewhere else and set `NEXT_PUBLIC_PET_DOWNLOAD_URL` in `.env.local` so the desk download button points at it.
