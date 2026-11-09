import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { equippedPet, type PetCard } from "../lib/pets";
import {
  buildPetLaunchUrl,
  closeBlockedMigrationMessage,
  DEFAULT_STUDY_SECONDS,
  devTimerPasswordMatches,
  experienceForDuration,
  experienceProgress,
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

test("study lengths default to 5 minutes and stay on the four choices", () => {
  assert.equal(DEFAULT_STUDY_SECONDS, 300);
  assert.deepEqual(
    STUDY_LENGTHS.map((length) => length.seconds),
    [300, 1500, 3300, 5100],
  );
  assert.equal(plannedStudySeconds(300), 300);
  assert.equal(plannedStudySeconds(5100), 5100);
  assert.equal(plannedStudySeconds(301), null);
  assert.equal(plannedStudySeconds("300"), null);
});

test("one finished minute is one experience point and a level needs 100", () => {
  assert.equal(experienceForDuration(59), 0);
  assert.equal(experienceForDuration(150), 2);
  assert.equal(experienceForDuration(300), 5);
  assert.equal(experienceForDuration(1500), 25);
  assert.equal(experienceForDuration(3300), 55);
  assert.equal(experienceForDuration(5100), 85);
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
