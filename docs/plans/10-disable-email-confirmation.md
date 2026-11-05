# Disable email confirmation

Status: not started.

Depends on: nothing. It can be done beside the desktop phases.

## Goal

A new account opens the desk immediately. Supabase does not send a confirmation email, and the register form does not ask the person to check their inbox.

## Out of scope

Removing email and password, adding another login provider, and changing how profiles or the starter pet are created. Email-change confirmation stays as it is.

## Why the app already redirects

[`lib/actions/auth.ts`](../../lib/actions/auth.ts) sends the browser to `/dashboard` when `signUp` returns a session. Hosted Supabase returns that session only when **Confirm email** is off. While the toggle is on, there is no session, and the form shows "Confirm your email, then sign in."

The signup trigger in [`supabase/migrations/0001_profiles_and_user_pets.sql`](../../supabase/migrations/0001_profiles_and_user_pets.sql) and [`0004_profile_display_name.sql`](../../supabase/migrations/0004_profile_display_name.sql) already inserts the profile and level 1 baby slime inside the auth transaction. That trigger stays.

## Touch

- Supabase dashboard, not a SQL migration. Authentication → Sign In / Providers → Email → turn **Confirm email** off. This project is hosted, so `supabase/config.toml` would not change the live project.
- [`lib/actions/auth.ts`](../../lib/actions/auth.ts) — when `signUp` returns no session, return an error that the project is still requiring confirmation. Remove both "Confirm your email" messages.
- [`README.md`](../../README.md) — stop describing `SUPABASE_SECRET_KEY` as the way through email confirmation. The key can stay in `.env.example` as an optional server key. The trigger remains the thing that creates the farmer.
- Accounts that were created and never confirmed still cannot sign in. In Authentication → Users, confirm those rows or delete them so those people can register again.

## Done when

- A new email and password land on `/dashboard` without a confirmation message and without opening mail.
- The register form no longer renders "Confirm your email".
- An account that can already sign in still reaches the desk.
