import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { equippedPet, type PetCard } from "../lib/pets";
import {
  buildPetLaunchUrl,
  buildStudyHistory,
  closeBlockedMigrationMessage,
  countSessionsInLocalMonth,
  countSessionsOnLocalDay,
  DEFAULT_STUDY_SECONDS,
  monthlyPlanEncouragement,
  monthlyPlanPercent,
  displayStreakCount,
  devTimerPasswordMatches,
  DISTRACTED_PENALTY,
  experienceForDuration,
  experienceForEarlyEnd,
  experienceForSession,
  experienceProgress,
  farmerLocalDay,
  FINISH_BONUS,
  formatStreakLabel,
  parseLocalDay,
  sessionCountsForStreak,
  shiftLocalDay,
  storedStudySeconds,
  STREAK_BONUS,
  STREAK_MIN_SECONDS,
  XP_PER_MINUTE,
  focusedSeconds,
  formatClock,
  formatDuration,
  formatHistoryMode,
  formatHistoryTime,
  formatHistoryXp,
  formatTimestamp,
  levelFromExperience,
  MAX_STUDY_MINUTES,
  MIN_STUDY_MINUTES,
  plannedStudySeconds,
  remainingSeconds,
  startSessionDecision,
  STUDY_LENGTHS,
  studyTimerMigrationMessage,
} from "../lib/study";

test("launch url carries only the session code", () => {
  const url = buildPetLaunchUrl("AB12CD34EF");
  assert.equal(url, "aurafarm://session?code=AB12CD34EF");

  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()], ["code"]);
  assert.equal(parsed.searchParams.get("code"), "AB12CD34EF");
  assert.equal(parsed.searchParams.get("pet"), null);
  assert.equal(parsed.searchParams.get("user"), null);
});

test("a study link shows the equipped pet for that session's user", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0007_close_blocked.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /where user_id = session_row\.user_id\s+and is_desktop_active/);
  assert.match(sql, /pet_type := coalesce\(equipped_type, 'baby_slime'\)/);

  const desktop = readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
  const refresh = desktop.slice(
    desktop.indexOf("async function refreshPet"),
    desktop.indexOf("async function signIn"),
  );
  assert.match(refresh, /\.eq\("is_desktop_active", true\)/);
  assert.match(refresh, /petType: data\.pet_type/);
  assert.match(refresh, /\[pet\] equipped /);
  assert.match(refresh, /no signed-in pet session/);
  assert.doesNotMatch(refresh, /searchParams|link\.pet|body\.pet_type/);
  assert.match(desktop, /PET_REFRESH_MS/);
  assert.match(desktop, /void refreshPet\(\)/);
  const panel = readFileSync(new URL("../desktop/panel.html", import.meta.url), "utf8");
  const panelScript = readFileSync(new URL("../desktop/panel.js", import.meta.url), "utf8");
  assert.match(panel, /id="finish"/);
  assert.match(panel, /Finish focused session/);
  assert.doesNotMatch(panel, /id="finish"[^>]*hidden/);
  assert.match(panelScript, /window\.pet\.finish\(\)/);
  assert.match(panelScript, /state\.finishLabel \|\| "Finish focused session"/);
  assert.doesNotMatch(desktop, /sprite\.html/);
  assert.match(desktop, /did-finish-load", publish/);
  assert.match(desktop, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(desktop, /SUPABASE_SECRET_KEY|SERVICE_ROLE/);
});

test("a missing close_blocked column tells the farmer to run migration 0007", () => {
  assert.equal(closeBlockedMigrationMessage(null), null);
  assert.match(
    closeBlockedMigrationMessage("Could not find the 'close_blocked' column of 'profiles' in the schema cache") ?? "",
    /migration 0007/,
  );
  assert.equal(closeBlockedMigrationMessage("Sign in to change this."), "Sign in to change this.");
});

test("a second start is refused while a session is active", () => {
  assert.equal(startSessionDecision(0).error, "");
  assert.match(startSessionDecision(1).error, /already running/);
  assert.match(startSessionDecision(2).error, /already running/);
});

test("timestamps render in UTC", () => {
  assert.equal(formatTimestamp("2026-11-04T15:28:00.000Z"), "4 Nov 2026, 15:28");
  assert.equal(formatTimestamp("not-a-time"), "not-a-time");
});

test("durations stay in whole hours, minutes, and seconds", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(125), "2m 5s");
  assert.equal(formatDuration(3661), "1h 1m");
});

test("study lengths default to 5 minutes and offer 30, 60, and 90", () => {
  assert.equal(DEFAULT_STUDY_SECONDS, 300);
  assert.deepEqual(
    STUDY_LENGTHS.map((length) => length.seconds),
    [300, 1800, 3600, 5400],
  );
  assert.equal(MIN_STUDY_MINUTES, 1);
  assert.equal(MAX_STUDY_MINUTES, 240);
  assert.equal(plannedStudySeconds(300), 300);
  assert.equal(plannedStudySeconds(5400), 5400);
  assert.equal(plannedStudySeconds(2700), 2700);
  assert.equal(plannedStudySeconds(60), 60);
  assert.equal(plannedStudySeconds(14400), 14400);
  assert.equal(plannedStudySeconds(1500), 1500);
  assert.equal(storedStudySeconds(1500), 1500);
  assert.equal(plannedStudySeconds(59), null);
  assert.equal(plannedStudySeconds(14460), null);
  assert.equal(plannedStudySeconds("300"), null);
});

test("finish bonus and distracted penalty share one experience rate", () => {
  assert.equal(XP_PER_MINUTE, 2);
  assert.equal(FINISH_BONUS, 1.1);
  assert.equal(STREAK_BONUS, 1.1);
  assert.equal(DISTRACTED_PENALTY, 0.7);
  assert.equal(experienceForDuration(59), 0);
  assert.equal(experienceForSession(300, false), 11);
  assert.equal(experienceForSession(300, true), 7);
  assert.equal(experienceForSession(1800, false), 66);
  assert.equal(experienceForSession(1800, true), 46);
  assert.equal(experienceForSession(3600, false), 132);
  assert.equal(experienceForSession(5400, false), 198);
  assert.equal(experienceForSession(5400, true), 138);
  assert.equal(experienceForSession(300, false, true), 12);
  assert.equal(experienceForSession(300, true, true), 8);
  assert.equal(experienceForSession(1800, false, true), 72);
  assert.equal(experienceForSession(1800, true, true), 50);
  assert.equal(experienceForEarlyEnd(59, false), 0);
  assert.equal(experienceForEarlyEnd(300, false), 10);
  assert.equal(experienceForEarlyEnd(300, true), 7);
  assert.equal(experienceForEarlyEnd(1800, false), 60);
  assert.equal(experienceForSession(2700, false), 99);
  assert.equal(experienceForEarlyEnd(2700, false), 90);
  assert.equal(experienceForEarlyEnd(1800, true), 42);
  assert.ok(experienceForEarlyEnd(1800, false) < experienceForSession(1800, false));
  assert.ok(experienceForSession(1800, false) < experienceForSession(1800, false, true));
  assert.equal(levelFromExperience(0), 1);
  assert.equal(levelFromExperience(99), 1);
  assert.equal(levelFromExperience(100), 2);
  assert.deepEqual(experienceProgress(105), { level: 2, intoLevel: 5, xp: 105 });
});

test("streak display uses the farmer local day and ignores broken streaks", () => {
  assert.equal(parseLocalDay("2026-11-13"), "2026-11-13");
  assert.equal(parseLocalDay("2026-11-31"), null);
  assert.equal(parseLocalDay("13-11-2026"), null);
  assert.equal(shiftLocalDay("2026-11-13", -1), "2026-11-12");
  assert.equal(displayStreakCount(3, "2026-11-13", "2026-11-13"), 3);
  assert.equal(displayStreakCount(3, "2026-11-12", "2026-11-13"), 3);
  assert.equal(displayStreakCount(3, "2026-11-11", "2026-11-13"), 0);
  assert.equal(displayStreakCount(0, "2026-11-13", "2026-11-13"), 0);
  assert.equal(formatStreakLabel(1), "1 day");
  assert.equal(formatStreakLabel(2), "2 days");
  assert.match(farmerLocalDay(new Date("2026-11-13T12:00:00")), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(STREAK_MIN_SECONDS, 300);
  assert.equal(sessionCountsForStreak(240), false);
  assert.equal(sessionCountsForStreak(300), true);
  assert.equal(sessionCountsForStreak(1800), true);
});

test("countSessionsInLocalMonth counts submitted sessions in the farmer month", () => {
  const sessions = [
    { status: "submitted" as const, endedAt: "2026-11-10T12:00:00.000Z" },
    { status: "submitted" as const, endedAt: "2026-11-20T12:00:00.000Z" },
    { status: "cancelled" as const, endedAt: "2026-11-15T12:00:00.000Z" },
    { status: "submitted" as const, endedAt: "2026-10-15T12:00:00.000Z" },
    { status: "submitted" as const, endedAt: "2026-12-15T12:00:00.000Z" },
    { status: "submitted" as const, endedAt: "not-a-date" },
  ];
  const month = "2026-11";
  const expected = sessions.filter(
    (session) =>
      session.status === "submitted" &&
      !Number.isNaN(new Date(session.endedAt).getTime()) &&
      farmerLocalDay(new Date(session.endedAt)).startsWith(month),
  ).length;
  assert.equal(countSessionsInLocalMonth(sessions, "2026-11-14"), expected);
  assert.ok(expected >= 1);
  assert.equal(countSessionsInLocalMonth(sessions, "bad-day"), 0);
  assert.equal(countSessionsInLocalMonth([], "2026-11-14"), 0);
});

test("countSessionsOnLocalDay counts submitted sessions on that farmer day", () => {
  const sessions = [
    { status: "submitted" as const, endedAt: "2026-11-14T12:00:00.000Z" },
    { status: "submitted" as const, endedAt: "2026-11-14T18:00:00.000Z" },
    { status: "cancelled" as const, endedAt: "2026-11-14T15:00:00.000Z" },
    { status: "submitted" as const, endedAt: "2026-11-13T12:00:00.000Z" },
  ];
  const day = "2026-11-14";
  const expected = sessions.filter(
    (session) =>
      session.status === "submitted" &&
      !Number.isNaN(new Date(session.endedAt).getTime()) &&
      farmerLocalDay(new Date(session.endedAt)) === day,
  ).length;
  assert.equal(countSessionsOnLocalDay(sessions, day), expected);
  assert.equal(countSessionsOnLocalDay(sessions, "bad-day"), 0);
});

test("monthly plan encouragement tracks progress without overshooting percent", () => {
  assert.equal(monthlyPlanPercent(0, 20), 0);
  assert.equal(monthlyPlanPercent(10, 20), 50);
  assert.equal(monthlyPlanPercent(25, 20), 100);
  assert.match(monthlyPlanEncouragement(0, 20), /start with one/i);
  assert.match(monthlyPlanEncouragement(2, 20), /nice start/i);
  assert.match(monthlyPlanEncouragement(10, 20), /halfway|rhythm/i);
  assert.match(monthlyPlanEncouragement(19, 20), /one left/i);
  assert.match(monthlyPlanEncouragement(20, 20), /reached/i);
  assert.match(monthlyPlanEncouragement(5, 20, 1, 1), /today done/i);
  assert.match(monthlyPlanEncouragement(20, 20, 1, 1), /reached/i);
});

test("the dev timer password is a plain comparison", () => {
  assert.equal(devTimerPasswordMatches("emia"), true);
  assert.equal(devTimerPasswordMatches("Emia"), false);
  assert.equal(devTimerPasswordMatches(""), false);
});

test("focused time is the elapsed seconds capped at the chosen length", () => {
  const started = 1_700_000_000_000;
  assert.equal(focusedSeconds(started, started + 150_000, 300), 150);
  assert.equal(focusedSeconds(started, started + 20_000, 300), 20);
  assert.equal(focusedSeconds(started, started + 900_000, 300), 300);
  assert.equal(remainingSeconds(new Date(started).toISOString(), 300, started + 125_000), 175);
  assert.equal(formatClock(300), "5:00");
  assert.equal(formatClock(65), "1:05");
  assert.equal(formatClock(5100), "85:00");
  assert.equal(formatClock(0), "0:00");
});

test("a missing timer column tells the farmer to run migration 0011", () => {
  assert.equal(studyTimerMigrationMessage(null), null);
  assert.match(
    studyTimerMigrationMessage("Could not find the 'planned_seconds' column of 'study_sessions' in the schema cache") ?? "",
    /migration 0011/,
  );
  assert.match(
    studyTimerMigrationMessage("Could not find the 'use_desktop_pet' column of 'study_sessions' in the schema cache") ?? "",
    /migration 0012/,
  );
  assert.equal(studyTimerMigrationMessage("Sign in to finish a study session."), "Sign in to finish a study session.");
  assert.match(
    studyTimerMigrationMessage("Could not find the table 'public.collection_rewards' in the schema cache") ?? "",
    /migration 0024/,
  );
  assert.match(
    studyTimerMigrationMessage("Could not find the 'streak_count' column of 'profiles' in the schema cache") ?? "",
    /0027 through 0034/,
  );
  assert.match(
    studyTimerMigrationMessage("Streak day is out of range") ?? "",
    /migration 0034/,
  );
  assert.equal(studyTimerMigrationMessage("Streak day is required"), "Streak day is required");
});

test("daily streak migration advances on full finish with a streak XP boost", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0027_daily_streak.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /streak_count integer not null default 0/);
  assert.match(sql, /streak_local_date date/);
  assert.match(sql, /function public\.touch_daily_streak/);
  assert.match(sql, /current_date - 1/);
  assert.match(sql, /current_date \+ 1/);
  assert.match(sql, /streak_bonus constant integer := 11/);
  assert.match(sql, /touch_daily_streak\(session_row\.user_id, local_day\)/);
  assert.match(sql, /gained := gained \* streak_bonus \/ 10/);
  assert.match(sql, /local_day date default null/);
  assert.match(sql, /streak_count = 0/);
  assert.match(sql, /streak_local_date = null/);
  assert.match(
    sql,
    /drop function if exists public\.grant_study_experience\(uuid, integer, boolean, integer, text\[\], boolean, date\)/,
  );

  const grant = sql.slice(sql.indexOf("function public.grant_study_experience"), sql.indexOf("function public.submit_study_score"));
  assert.match(grant, /if apply_finish_bonus then/);
  assert.match(grant, /if local_day is not null then/);
  assert.doesNotMatch(grant.slice(grant.indexOf("if distracted")), /touch_daily_streak/);

  const boostSql = readFileSync(
    new URL("../supabase/migrations/0029_streak_boost_requires_live.sql", import.meta.url),
    "utf8",
  );
  assert.match(boostSql, /streak_was_live/);
  assert.match(boostSql, /prior_day = \(local_day - 1\)/);
  assert.match(boostSql, /if streak_was_live then/);

  const minSql = readFileSync(
    new URL("../supabase/migrations/0030_streak_min_five_minutes.sql", import.meta.url),
    "utf8",
  );
  assert.match(minSql, /streak_min_seconds constant integer := 300/);
  assert.match(minSql, /planned_seconds >= streak_min_seconds/);
  assert.match(minSql, /counts_for_streak/);

  const shortSql = readFileSync(
    new URL("../supabase/migrations/0034_streak_short_session_and_soft_day.sql", import.meta.url),
    "utf8",
  );
  assert.match(shortSql, /when session_row\.planned_seconds >= 300 then local_day/);
  assert.match(shortSql, /local_day >= \(current_date - 1\)/);
  assert.match(shortSql, /local_day <= \(current_date \+ 1\)/);
  assert.match(shortSql, /function public\.complete_study_timer/);
  assert.doesNotMatch(shortSql, /function public\.submit_study_score/);

  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  assert.match(desk, /streakBoostActive=\{liveStreakCount > 0\}/);
  assert.match(desk, /subscribeFarmerLocalDay/);
  assert.match(desk, /1970-01-01/);
  assert.doesNotMatch(desk, /streakLocalDate \?\? "1970-01-01"/);

  const earlyPath = readFileSync(
    new URL("../supabase/migrations/0014_end_study_early.sql", import.meta.url),
    "utf8",
  );
  const early = earlyPath.slice(earlyPath.indexOf("function public.end_study_early"));
  assert.match(early, /false\s*\)/);
  assert.doesNotMatch(early, /local_day/);

  const action = readFileSync(new URL("../lib/actions/study.ts", import.meta.url), "utf8");
  assert.match(action, /local_day: day/);
  assert.match(action, /parseLocalDay\(localDay\)/);
  assert.match(action, /Server strips local_day/);
  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /completeStudyTimer\(shownSession\.id, devPasswordValue, farmerLocalDay\(\)\)/);
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /streakPillLabel/);
  assert.doesNotMatch(header, /Streak coming soon/);
});

test("the desk title is the equipped pet rather than the first row", () => {
  const pets: PetCard[] = [
    { id: "slime", pet_type: "baby_slime", level: 1, xp: 0, is_desktop_active: false, color: null, hat: null, clothes: null },
    { id: "moth", pet_type: "lantern_moth", level: 1, xp: 25, is_desktop_active: true, color: null, hat: null, clothes: null },
  ];
  assert.equal(equippedPet(pets)?.pet_type, "lantern_moth");
  assert.equal(equippedPet([{ ...pets[0], is_desktop_active: true }])?.pet_type, "baby_slime");
  assert.equal(equippedPet([]), null);

  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  assert.match(desk, /equippedPet\(localPets\)/);
  assert.match(desk, /describePet/);
  assert.doesNotMatch(desk, /pets\[0\]/);
  assert.match(desk, /No pet is equipped/);
});

test("cancel keeps focused minutes and the dev finish is the only skip", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0011_study_timer_xp.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /planned_seconds in \(300, 1500, 3300, 5100\)/);
  assert.match(sql, /pet_id uuid references public\.user_pets/);
  assert.match(sql, /add column if not exists xp integer not null default 0/);
  assert.match(sql, /gained := studied_seconds \/ 60/);
  assert.match(sql, /level = 1 \+ \(\(user_pets\.xp \+ gained\) \/ 100\)/);
  assert.match(sql, /dev_password = 'emia'/);
  assert.doesNotMatch(sql, /digest\(dev_password/);

  const cancel = sql.slice(sql.indexOf("function public.cancel_study_session"), sql.indexOf("function public.complete_study_timer"));
  assert.match(cancel, /set status = 'cancelled'/);
  assert.match(cancel, /duration_seconds = focused/);
  assert.match(cancel, /floor\(extract\(epoch from \(now\(\) - session_row\.started_at\)\)\)/);
  assert.match(cancel, /least\(\s*session_row\.planned_seconds/);
  assert.match(cancel, /apply_study_experience\(session_row\.user_id, session_row\.pet_id, focused\)/);
  assert.doesNotMatch(cancel, /profiles/);

  const score = sql.slice(sql.indexOf("function public.submit_study_score"), sql.indexOf("function public.cancel_study_session"));
  assert.match(score, /farmer\.points \+ result_points/);
  assert.match(score, /apply_study_experience/);
  const timer = sql.slice(sql.indexOf("function public.complete_study_timer"));
  assert.match(timer, /duration_seconds = session_row\.planned_seconds/);
  assert.match(timer, /Study time has not finished/);
  assert.match(timer, /dev_finish is not true/);
});

test("website and pet finishes share one experience grant", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0012_session_xp.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /planned_seconds in \(300, 1500, 1800, 3300, 3600, 5100, 5400\)/);
  assert.match(sql, /use_desktop_pet boolean not null default false/);
  assert.match(sql, /xp_awarded integer/);
  assert.match(sql, /FINISH_BONUS/);
  assert.match(sql, /DISTRACTED_PENALTY/);
  assert.match(sql, /xp_per_minute constant integer := 2/);
  assert.match(sql, /finish_bonus constant integer := 11/);
  assert.match(sql, /distracted_penalty constant integer := 7/);
  assert.match(sql, /drop table if exists public\.study_scores/);
  assert.match(sql, /drop column if exists points/);
  assert.match(sql, /drop function if exists public\.cancel_study_session\(uuid\)/);
  assert.doesNotMatch(sql, /farmer\.points/);

  const grant = sql.slice(sql.indexOf("function public.grant_study_experience"), sql.indexOf("function public.submit_study_score"));
  assert.match(grant, /minutes \* xp_per_minute \* finish_bonus \/ 10/);
  assert.match(grant, /gained \* distracted_penalty \/ 10/);
  assert.match(grant, /level = 1 \+ \(\(user_pets\.xp \+ gained\) \/ 100\)/);
  assert.match(grant, /duration_seconds = recorded/);

  const score = sql.slice(sql.indexOf("function public.submit_study_score"), sql.indexOf("function public.complete_study_timer"));
  assert.match(score, /use_desktop_pet is not true/);
  assert.match(score, /grant_study_experience\(/);
  assert.match(score, /Study time has not finished/);
  assert.doesNotMatch(score, /profiles/);

  const timer = sql.slice(sql.indexOf("function public.complete_study_timer"), sql.indexOf("function public.purchase_pet"));
  assert.match(timer, /use_desktop_pet then/);
  assert.match(timer, /grant_study_experience\(/);
  assert.match(timer, /false,/);
  assert.match(timer, /dev_password = 'emia'/);
});

test("cancelling a session stops it without experience", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0013_cancel_without_xp.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /function public\.cancel_study_session\(target_session_id uuid\)/);
  assert.match(sql, /set status = 'cancelled'/);
  assert.match(sql, /Does not change pet experience or level/);
  assert.doesNotMatch(sql, /grant_study_experience/);
  assert.doesNotMatch(sql, /user_pets/);
  assert.doesNotMatch(sql, /xp =/);
});

test("ending early records studied minutes without the finish bonus", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0014_end_study_early.sql", import.meta.url),
    "utf8",
  );
  const grant = sql.slice(sql.indexOf("function public.grant_study_experience"), sql.indexOf("function public.submit_study_score"));
  assert.match(grant, /gained := minutes \* xp_per_minute/);
  assert.match(grant, /if apply_finish_bonus then/);
  assert.match(grant, /gained := gained \* finish_bonus \/ 10/);
  assert.match(grant, /gained \* distracted_penalty \/ 10/);

  const early = sql.slice(sql.indexOf("function public.end_study_early"));
  assert.match(early, /floor\(extract\(epoch from \(now\(\) - session_row\.started_at\)\)\)/);
  assert.match(early, /least\(\s*session_row\.planned_seconds/);
  assert.match(early, /grant_study_experience\(/);
  assert.match(early, /false\s*\)/);
  assert.match(early, /Does not apply the finish bonus/);
  assert.doesNotMatch(early, /finish_bonus/);
});

test("a custom study length is any whole minute from 1 to 240", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0017_custom_study_length.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /planned_seconds >= 60/);
  assert.match(sql, /planned_seconds <= 14400/);
  assert.match(sql, /planned_seconds % 60 = 0/);
});

test("the admin reset clears only the signed-in farmer", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0016_admin_reset_own.sql", import.meta.url),
    "utf8",
  );
  const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/admin-reset.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../lib/actions/admin.ts", import.meta.url), "utf8");
  assert.match(sql, /dev_password is distinct from 'emia'/);
  assert.match(sql, /farmer := auth\.uid\(\)/);
  assert.match(sql, /delete from public\.study_sessions\s+where user_id = farmer/);
  assert.match(sql, /where user_id = farmer/);
  assert.match(sql, /set xp = 0/);
  assert.match(sql, /level = 1/);
  assert.doesNotMatch(sql, /delete from public\.study_sessions;/);
  assert.doesNotMatch(sql, /delete from public\.user_pets/);
  assert.doesNotMatch(sql, /delete from public\.profiles/);
  assert.match(action, /getClaims/);
  assert.match(action, /Sign in before resetting your pets/);
  assert.match(page, /AdminReset/);
  assert.match(panel, /Set streak/);
  assert.match(panel, /Reset account/);
  assert.match(panel, /deletes your study records/);
  assert.match(panel, /Reset my pets and study records/);
  assert.doesNotMatch(panel, /Type reset to confirm/);
  assert.doesNotMatch(panel, /DEV_TIMER_PASSWORD/);
  assert.match(panel, /resetAllPets/);
  assert.match(panel, /Set my streak/);
  assert.match(panel, /setDailyStreak/);
  assert.match(action, /set_daily_streak/);
  assert.ok(panel.indexOf("Reset account") < panel.indexOf("Set streak"));
  const streakBlock = panel.slice(panel.indexOf("admin-streak-title"));
  assert.ok(streakBlock.indexOf("Streak days") < streakBlock.indexOf("Password"));
});

test("study history merges session and XP rows by session id", () => {
  const sessions = [
    {
      id: "session-a",
      status: "submitted" as const,
      durationSeconds: 1500,
      endedAt: "2026-01-01T12:00:00.000Z",
      xpAwarded: 55,
      useDesktopPet: true,
    },
    {
      id: "session-b",
      status: "cancelled" as const,
      durationSeconds: 120,
      endedAt: "2026-01-01T12:00:00.000Z",
      xpAwarded: null,
      useDesktopPet: false,
    },
    {
      id: "session-c",
      status: "submitted" as const,
      durationSeconds: 300,
      endedAt: "2026-01-02T12:00:00.000Z",
      xpAwarded: null,
      useDesktopPet: null,
    },
  ];
  const scores = [
    {
      id: "session-a",
      xp: 55,
      distracted: false,
      durationSeconds: 1500,
      blockedHosts: [],
      createdAt: "2026-01-01T12:00:00.000Z",
    },
    {
      id: "orphan-xp",
      xp: 12,
      distracted: true,
      durationSeconds: 600,
      blockedHosts: ["example.com"],
      createdAt: "2026-01-03T12:00:00.000Z",
    },
  ];

  const { cards, unmatchedScores } = buildStudyHistory(sessions, scores);
  assert.equal(cards.length, 3);
  assert.equal(cards[0]?.id, "session-a");
  assert.equal(cards[0]?.xp, 55);
  assert.equal(cards[0]?.modeLabel, "With pet");
  assert.equal(cards[0]?.showFocusDistraction, true);
  assert.equal(cards[0]?.focusSeconds, null);
  assert.equal(cards[0]?.distractionSeconds, null);
  assert.equal(cards[1]?.status, "cancelled");
  assert.equal(cards[1]?.xp, 0);
  assert.equal(cards[1]?.modeLabel, "Web timer");
  assert.equal(cards[1]?.showFocusDistraction, false);
  assert.equal(cards[2]?.xp, null);
  assert.equal(cards[2]?.modeLabel, "Mode unknown");
  assert.equal(cards[2]?.showFocusDistraction, false);
  assert.equal(unmatchedScores.length, 1);
  assert.equal(unmatchedScores[0]?.id, "orphan-xp");
  assert.equal(formatHistoryMode(true), "With pet");
  assert.equal(formatHistoryMode(false), "Web timer");
  assert.equal(formatHistoryMode(null), "Mode unknown");
  assert.equal(formatHistoryXp(null), "Not available");
  assert.equal(formatHistoryXp(0), "0 XP");
  assert.equal(formatHistoryTime(null), "Not available");
  assert.equal(formatHistoryTime(0), "0m");

  const panel = readFileSync(new URL("../components/study-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /Study history/);
  assert.match(panel, /Focus time/);
  assert.match(panel, /Distraction time/);
  assert.match(panel, /modeLabel/);
  assert.match(panel, /showFocusDistraction/);
  assert.match(panel, /buildStudyHistory/);
  assert.doesNotMatch(panel, /No blocked sites/);
  assert.doesNotMatch(panel, /history-sessions-title/);

  const dashboard = readFileSync(new URL("../lib/dashboard.ts", import.meta.url), "utf8");
  assert.match(dashboard, /ended_at, xp_awarded, use_desktop_pet/);
});
