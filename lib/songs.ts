export const NO_OTHER_SONGS = "You don't have other songs.";

export type Song = {
  id: string;
  title: string;
  src: string;
  unlockLevel: number;
};

export const SONGS: readonly Song[] = [
  {
    id: "sunday-in-blue",
    title: "Sunday in Blue",
    src: "/audio/SundayinBlue.mp3",
    unlockLevel: 1,
  },
  {
    id: "little-by-little",
    title: "Little by Little",
    src: "/audio/LittlebyLittle.mp3",
    unlockLevel: 2,
  },
  {
    id: "golden-hour",
    title: "Golden Hour",
    src: "/audio/GoldenHour.mp3",
    unlockLevel: 4,
  },
  {
    id: "velvet-afternoon",
    title: "Velvet Afternoon",
    src: "/audio/VelvetAfternoon.mp3",
    unlockLevel: 6,
  },
];

export const STARTER_SONG_ID = SONGS[0].id;

export type OwnedSong = {
  id: string;
  seen: boolean;
};

export function songById(id: string) {
  return SONGS.find((song) => song.id === id) ?? null;
}

export function songsOwnedAtLevel(level: number) {
  const reached = Number.isFinite(level) ? Math.floor(level) : 1;
  return SONGS.filter((song) => song.unlockLevel <= Math.max(1, reached));
}

export function playableSongIds(ownedIds: readonly string[]) {
  const owned = SONGS.filter((song) => ownedIds.includes(song.id)).map((song) => song.id);
  return owned.length > 0 ? owned : [STARTER_SONG_ID];
}

function ownedSongAtOffset(
  ownedIds: readonly string[],
  currentId: string,
  offset: 1 | -1,
) {
  const owned = SONGS.filter((song) => ownedIds.includes(song.id));
  if (owned.length <= 1) return { song: null, message: NO_OTHER_SONGS };
  const index = owned.findIndex((song) => song.id === currentId);
  const from = index >= 0 ? index : 0;
  const next = owned[(from + offset + owned.length) % owned.length];
  if (!next || next.id === currentId) return { song: null, message: NO_OTHER_SONGS };
  return { song: next, message: "" };
}

export function nextOwnedSong(ownedIds: readonly string[], currentId: string) {
  return ownedSongAtOffset(ownedIds, currentId, 1);
}

export function previousOwnedSong(ownedIds: readonly string[], currentId: string) {
  return ownedSongAtOffset(ownedIds, currentId, -1);
}
