# Score debug

Session `b17e90de-eb72-4013-af3e-442037d0a342` is `cancelled` and `has_token` is true. The pet claimed it, then the row was cancelled. `submit_study_score` only accepts `active`, so the finish POST is 403 and the header balance does not move. The `POST /api/pet/heartbeat` 404 is an old pet calling a route that no longer exists. It does not cancel the session and it does not block the score.

The only writer of `cancelled` is the desk button **Cancel session**. That calls `cancelStudySession`, which calls `cancel_study_session`. Quitting the pet does not change the row. A cancelled row cannot be scored later.

## Next terminal

```sh
npm run dev
```

Lines start with `[score]`.

Cancel prints:

```text
[score] cancel <session id> user <user id>
```

A rejected finish prints one of:

```text
[score] <session id> rejected: Score rejected | status=cancelled has_token=true claimed_at=<time> ended_at=<time> | Cancel session on the desk is the only writer of cancelled, and a cancelled session cannot be scored.
[score] <session id> rejected: Score rejected | status=active has_token=true claimed_at=<time> ended_at=null | The token in this request does not match the claim.
[score] <session id> rejected: Score rejected | status=active has_token=false claimed_at=null ended_at=null | The session was never claimed.
[score] <session id> rejected: ... | status unknown
```

`status unknown` means `SUPABASE_SECRET_KEY` is missing, so the route cannot read the row. The token itself is not printed.

`claimed_at` is when the pet claimed the launch code. `ended_at` is when Cancel session ran. If `ended_at` is later than `claimed_at`, the desk cancelled the session after the pet already had it.

A second finish of a session that did save prints:

```text
[score] <session id> already submitted
```

That response is 409, not 403.

## Pet terminal

```sh
cd desktop && npm start
```

While the pet is watching, a cancel on the desk prints:

```text
[score] session <session id> is cancelled, so the pet stops watching
```

Finish prints:

```text
[score] POST <session id> -> 403 Score rejected.
```

`200` and a score URL means the score was saved. The header moves only after `supabase/migrations/0009_score_wallet.sql` has been applied.

## Read the rows

```sql
select id, status, started_at, claimed_at, ended_at,
       session_token_hash is not null as has_token
from public.study_sessions
where id = 'b17e90de-eb72-4013-af3e-442037d0a342';
```

```sql
select id, status, started_at, claimed_at, ended_at
from public.study_sessions
order by created_at desc
limit 10;
```

To get a score, start a new session, claim it from the pet, finish from the pet, and do not click Cancel session before that.
