# Equipped pet debug

The desktop character stays the green slime when `npm start` cannot read the equipped row. The drawing only changes after the process learns `pet_type`. These lines are printed in the terminal that started the pet. A repeated result is printed once.

## Pet terminal

```sh
cd desktop && npm start
```

Lines start with `[pet]`.

Startup with no saved sign-in:

```text
[pet] no saved sign-in at <userData>/session.json.
[pet] no signed-in pet session, so the equipped row is not read. The character stays baby_slime until a launch code is claimed.
[pet] showing baby_slime level 1
```

The window no longer asks for email or password, so a new install does not write `session.json`. Equipping a pet on the desk does not reach this process until a launch code is claimed, or an older saved sign-in still restores.

Saved sign-in failed:

```text
[pet] saved sign-in rejected: <message>
```

```text
[pet] saved sign-in could not be read.
```

Supabase keys missing from the repo `.env.local`:

```text
[pet] no Supabase client. .env.local needs NEXT_PUBLIC_SUPABASE_URL and the publishable key.
```

Signed in, and the equipped row was read. The user id is the account whose `user_pets` row should match the desk:

```text
[pet] equipped lantern_moth level 1 for <user id>
[pet] showing lantern_moth level 1
```

`showing` is what the sprite window was sent. `baby_slime` draws the green slime, `lantern_moth` the amber moth, and `river_newt` the teal newt. Any other type is sent as itself and still drawn as the slime.

Signed in, but nothing is equipped:

```text
[pet] signed in, but no user_pets row has is_desktop_active = true.
```

The query failed:

```text
[pet] equipped pet query failed: <message>
```

A claimed launch code names the equipped pet for that session's user:

```text
[pet] claim equipped river_newt level 1
[pet] showing river_newt level 1
```

Claim with no pet:

```text
[pet] claim returned no pet_type, so the character stays as it is.
```

If `showing` names the moth or the newt and the window is still a green slime, this terminal is not running the build that redraws from `pet_type`. Stop it and start again from `desktop/`.

## Compare with the database

Use the user id from the `equipped ... for` line:

```sql
select id, pet_type, level, is_desktop_active
from public.user_pets
where user_id = '<user id>'
order by is_desktop_active desc, pet_type;
```

One row should have `is_desktop_active` true. That `pet_type` is the one the pet should draw. If the log's user id is a different account from the desk you equipped, the pet is signed in as someone else.
