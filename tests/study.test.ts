import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { equippedPet, type PetCard } from "../lib/pets";
import {
  buildPetLaunchUrl,
  closeBlockedMigrationMessage,
  DEFAULT_STUDY_SECONDS,
  devTimerPasswordMatches,
  DISTRACTED_PENALTY,
  experienceForDuration,
  experienceForEarlyEnd,
  experienceForSession,
  experienceProgress,
  FINISH_BONUS,
  storedStudySeconds,
  XP_PER_MINUTE,
  focusedSeconds,
  formatClock,
  formatDuration,
  formatTimestamp,
  levelFromExperience,
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
  const sprite = readFileSync(new URL("../desktop/sprite.js", import.meta.url), "utf8");
  assert.match(sprite, /function drawPet\(petType\)/);
  assert.match(sprite, /petType === "lantern_moth"/);
  assert.match(sprite, /petType === "river_newt"/);
  assert.match(sprite, /drawPet\(state\.petType\)/);
  assert.match(desktop, /loadFile\(path\.join\(__dirname, "sprite\.html"\)\)/);
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
  assert.equal(plannedStudySeconds(300), 300);
  assert.equal(plannedStudySeconds(5400), 5400);
  assert.equal(plannedStudySeconds(1500), null);
  assert.equal(storedStudySeconds(1500), 1500);
  assert.equal(plannedStudySeconds("300"), null);
});

test("finish bonus and distracted penalty share one experience rate", () => {
  assert.equal(XP_PER_MINUTE, 2);
  assert.equal(FINISH_BONUS, 1.1);
  assert.equal(DISTRACTED_PENALTY, 0.7);
  assert.equal(experienceForDuration(59), 0);
  assert.equal(experienceForSession(300, false), 11);
  assert.equal(experienceForSession(300, true), 7);
  assert.equal(experienceForSession(1800, false), 66);
  assert.equal(experienceForSession(1800, true), 46);
  assert.equal(experienceForSession(3600, false), 132);
  assert.equal(experienceForSession(5400, false), 198);
  assert.equal(experienceForSession(5400, true), 138);
  assert.equal(experienceForEarlyEnd(59, false), 0);
  assert.equal(experienceForEarlyEnd(300, false), 10);
  assert.equal(experienceForEarlyEnd(300, true), 7);
  assert.equal(experienceForEarlyEnd(1800, false), 60);
  assert.equal(experienceForEarlyEnd(1800, true), 42);
  assert.ok(experienceForEarlyEnd(1800, false) < experienceForSession(1800, false));
  assert.equal(levelFromExperience(0), 1);
  assert.equal(levelFromExperience(99), 1);
  assert.equal(levelFromExperience(100), 2);
  assert.deepEqual(experienceProgress(105), { level: 2, intoLevel: 5, xp: 105 });
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
});

test("the desk title is the equipped pet rather than the first row", () => {
  const pets: PetCard[] = [
    { id: "slime", pet_type: "baby_slime", level: 1, xp: 0, is_desktop_active: false },
    { id: "moth", pet_type: "lantern_moth", level: 1, xp: 25, is_desktop_active: true },
  ];
  assert.equal(equippedPet(pets)?.pet_type, "lantern_moth");
  assert.equal(equippedPet([{ ...pets[0], is_desktop_active: true }])?.pet_type, "baby_slime");
  assert.equal(equippedPet([]), null);

  const desk = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  assert.match(desk, /equippedPet\(pets\)/);
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
