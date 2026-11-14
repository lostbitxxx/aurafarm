import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  NO_OTHER_SONGS,
  SONGS,
  nextOwnedSong,
  songsOwnedAtLevel,
} from "../lib/songs";

test("songs unlock every two levels and skip needs another song", () => {
  assert.deepEqual(
    SONGS.map((song) => [song.title, song.unlockLevel, song.src]),
    [
      ["Sunday in Blue", 1, "/audio/SundayinBlue.mp3"],
      ["Little by Little", 2, "/audio/LittlebyLittle.mp3"],
      ["Golden Hour", 4, "/audio/GoldenHour.mp3"],
      ["Velvet Afternoon", 6, "/audio/VelvetAfternoon.mp3"],
    ],
  );
  assert.deepEqual(
    songsOwnedAtLevel(1).map((song) => song.id),
    ["sunday-in-blue"],
  );
  assert.deepEqual(
    songsOwnedAtLevel(2).map((song) => song.title),
    ["Sunday in Blue", "Little by Little"],
  );
  assert.deepEqual(
    songsOwnedAtLevel(3).map((song) => song.id),
    songsOwnedAtLevel(2).map((song) => song.id),
  );
  assert.equal(songsOwnedAtLevel(4).at(-1)?.title, "Golden Hour");
  assert.equal(songsOwnedAtLevel(5).at(-1)?.id, "golden-hour");
  assert.equal(songsOwnedAtLevel(6).at(-1)?.title, "Velvet Afternoon");
  assert.equal(songsOwnedAtLevel(8).length, 4);

  assert.deepEqual(nextOwnedSong(["sunday-in-blue"], "sunday-in-blue"), {
    song: null,
    message: NO_OTHER_SONGS,
  });
  assert.equal(NO_OTHER_SONGS, "You don't have other songs.");
  assert.equal(
    nextOwnedSong(["sunday-in-blue", "little-by-little"], "sunday-in-blue").song?.id,
    "little-by-little",
  );
  assert.equal(
    nextOwnedSong(
      ["sunday-in-blue", "little-by-little", "golden-hour"],
      "golden-hour",
    ).song?.id,
    "sunday-in-blue",
  );
});

test("song migration grants, backfills, and resets ownership", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0038_user_songs.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.songs/);
  assert.match(sql, /create table if not exists public\.user_songs/);
  assert.match(sql, /primary key \(user_id, song_id\)/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /'sunday-in-blue', 'Sunday in Blue', 1/);
  assert.match(sql, /'little-by-little', 'Little by Little', 2/);
  assert.match(sql, /'golden-hour', 'Golden Hour', 4/);
  assert.match(sql, /'velvet-afternoon', 'Velvet Afternoon', 6/);
  assert.match(sql, /max\(user_pets\.level\)/);
  assert.match(sql, /insert into public\.user_songs \(user_id, song_id, seen_at\)/);

  const grant = sql.slice(
    sql.indexOf("function public.grant_study_experience"),
    sql.indexOf("function public.handle_new_user"),
  );
  assert.match(grant, /insert into public\.user_songs \(user_id, song_id\)/);
  assert.match(grant, /songs\.unlock_level > previous_highest/);
  assert.match(grant, /songs\.unlock_level <= next_highest/);
  assert.match(grant, /select coalesce\(max\(level\), 1\) into previous_highest/);
  assert.doesNotMatch(grant, /seen_at/);

  const signup = sql.slice(
    sql.indexOf("function public.handle_new_user"),
    sql.indexOf("function public.reset_study_world"),
  );
  assert.match(signup, /songs\.id = 'sunday-in-blue'/);
  assert.match(signup, /seen_at/);

  const reset = sql.slice(sql.indexOf("function public.reset_study_world"));
  assert.match(reset, /delete from public\.user_songs/);
  assert.match(reset, /songs\.id = 'sunday-in-blue'/);
  assert.match(reset, /seen_at/);
});

test("the desk opens songs and celebrates an unlock", () => {
  const screen = readFileSync(new URL("../components/dashboard-screen.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const player = readFileSync(new URL("../components/song-player.tsx", import.meta.url), "utf8");
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

  assert.match(header, /onOpenSong/);
  assert.match(header, />\s*Song\s*</);
  assert.match(screen, /DeskSong/);
  assert.match(screen, /SongUnlockCelebration/);
  assert.match(screen, /featuredSongId=\{shownSong && !songBlocked \? shownSong\.id : null\}/);
  assert.match(player, /New song unlocked/);
  assert.match(player, /Next song/);
  assert.match(player, /NO_OTHER_SONGS/);
  assert.match(proxy, /mp3/);
});
