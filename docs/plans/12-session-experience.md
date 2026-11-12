# Session experience

One experience formula for both ways of tracking a study session. The website countdown and the desktop pet grant the same growth, the same finish bonus, and the same distracted penalty. Only the pet equipped when the session starts receives it.

## What the dashboard clock does today

The clock on `/dashboard` is a countdown. `StudyClock` in [components/study-panel.tsx](../../components/study-panel.tsx) counts down in the browser. At zero it calls `completeStudyTimer`, which runs `complete_study_timer`.

That function marks the session `submitted`, stores the full chosen length as `duration_seconds`, and calls `apply_study_experience` for the pet that was equipped when the session started. Experience is one point per whole minute, and the level is `1 + xp / 100`. A finish earlier than the chosen length is rejected unless the dev password is used.

That path does not add wallet points. Those come from the desktop score submit, `submit_study_score`. The dashboard timer also does not watch blocked sites or close tabs. That stays in the desktop app, which today closes the front blocklist tab after 8 seconds.

## Experience, shared by both trackers

The rates are separate constants in [lib/study.ts](../../lib/study.ts). The database function declares the same names.

| Constant | Value |
| --- | --- |
| `XP_PER_MINUTE` | 2 |
| `FINISH_BONUS` | 1.1 |
| `DISTRACTED_PENALTY` | 0.7 |

A leftover under 60 seconds adds nothing. The gain is whole minutes, then the finish bonus, then the distracted penalty when it applies:

```text
minutes = floor(recordedSeconds / 60)
gain = floor(minutes * XP_PER_MINUTE * FINISH_BONUS)
if distracted:
  gain = floor(gain * DISTRACTED_PENALTY)
```

SQL uses `11/10` and `7/10` so the factors stay integer. A focused 30-minute finish is 66 XP. The same session distracted is 46 XP. Level stays `1 + xp / 100`.

Both trackers call this formula. A website session passes `distracted = false`, because the page does not watch the browser. A desktop session passes `distracted = true` only after YouTube, Instagram, or another blocklist host has been the front tab for more than one minute. The first finish awards XP once. A later submit on an already finished session does not add XP or seconds.

Recorded time never grows past the chosen length. When the active countdown reaches zero, the session is finished and no further time is stored. An earlier finish is rejected unless the dev password is used. That rule is the same for the website function and the pet submit.

## Length, then the tracker

Before **Start studying**, the farmer picks the length and whether this session uses the desktop pet.

Lengths, in [components/study-panel.tsx](../../components/study-panel.tsx):

- Suggested buttons: 30, 45, and 60 minutes. The default is 30.
- Custom: a whole number of minutes from 1 to 180.

[lib/study.ts](../../lib/study.ts) replaces the 5 / 25 / 55 / 85 list. `plannedStudySeconds` accepts any whole minute in that range, including an older active session still stored at one of the old lengths.

The tracker is a toggle on the dashboard, chosen before the session starts:

**Yes, use the desktop pet**

- The pet tracks the time. The website countdown is visible, and it does not call `completeStudyTimer`.
- The side study rail starts collapsed.
- The claim response includes `planned_seconds`, so the pet can count the same length.
- At zero the pet submits the finish. The server grants XP with the shared formula and stores the chosen length.
- If YouTube, Instagram, TikTok, or another blocklist host stays in front for more than one minute, the pet comes forward and closes that browser window. That visit makes the session distracted, so the 0.7 penalty applies. `CLOSE_AFTER_MS` in [desktop/frontmost.js](../../desktop/frontmost.js) changes from 8 seconds to 60 seconds.
- The download link and the launch code are shown for this choice.

**No, use the website timer**

- `StudyClock` tracks the time and, at zero, calls `completeStudyTimer`.
- The session is focused. It still receives `XP_PER_MINUTE` and `FINISH_BONUS`.
- The page does not watch blocked sites and does not ask the farmer to open the pet.
- The side rail stays under the farmer's own open and close control.

## Remove the score, the shop balance, and cancel

A finish no longer writes a score and no longer changes a point balance. Cancel is removed because ending a session is a finish.

New migration [supabase/migrations/0012_session_xp.sql](../../supabase/migrations/0012_session_xp.sql). Older migration files stay as history.

- Replace the `planned_seconds` allow-list with a whole-minute range from 60 to 10800 seconds.
- Record `use_desktop_pet` and `xp_awarded` on `study_sessions`.
- Drop `public.study_scores`.
- Drop `profiles.points` after replacing `purchase_pet`. The shop still gives each sale pet once, and still refuses a second copy and the starter slime. It no longer shows a price or a balance.
- Replace `submit_study_score` and `complete_study_timer` so both call one grant function. Neither updates `profiles.points`. A desktop session rejects a website finish, and a website session rejects a pet finish, so only the chosen tracker can award XP.
- Drop `cancel_study_session`.

Remove these call sites:

- The desk **Cancel session** button and `cancelStudySession` in [lib/actions/study.ts](../../lib/actions/study.ts)
- [app/api/sessions/[id]/cancel/route.ts](../../app/api/sessions/[id]/cancel/route.ts)
- The pet panel's cancel button, `cancelStudy` in [desktop/main.js](../../desktop/main.js), and its preload wiring

The pet's finish submit stays on `POST /api/sessions/:id/score` so the current pet can end a desktop session. The response is `{ xp, distracted, url }`. It does not return points.

Surfaces:

- [components/site-header.tsx](../../components/site-header.tsx) drops the Points figure. Study time in the header stays.
- [components/shop-screen.tsx](../../components/shop-screen.tsx), [lib/shop.ts](../../lib/shop.ts), [lib/pets.ts](../../lib/pets.ts), and [lib/actions/pets.ts](../../lib/actions/pets.ts) drop prices, the balance, and "not enough points".
- [lib/dashboard.ts](../../lib/dashboard.ts), [lib/inventory.ts](../../lib/inventory.ts), and [lib/study-score.ts](../../lib/study-score.ts) stop reading `points` and `study_scores`.
- The rail's Scores list and the number on [app/dashboard/sessions/[id]/page.tsx](../../app/dashboard/sessions/[id]/page.tsx) show experience gained, focused or distracted, and the recorded duration.
- [lib/scoring.ts](../../lib/scoring.ts) drops `FOCUSED_SCORE`, `DISTRACTED_SCORE`, and `scoreForBlockedCount`.

## Tests

Update the study, score, shop, and pet tests for the shared constants, the 30 / 45 / 60 lengths, the tracker toggle, the 60 second close, the removed balance, and the removed cancel path. Assert that [supabase/migrations/0012_session_xp.sql](../../supabase/migrations/0012_session_xp.sql) uses `FINISH_BONUS` and `DISTRACTED_PENALTY` from one grant function, and that a website finish and a pet finish cannot both award XP. Leave the assertions on `0002`, `0008`, `0010`, and `0011` in place. Those files stay historical.
