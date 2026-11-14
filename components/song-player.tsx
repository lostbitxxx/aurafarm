"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { markSongSeen } from "@/lib/actions/songs";
import { describePet, type PetCard } from "@/lib/pets";
import {
  NO_OTHER_SONGS,
  STARTER_SONG_ID,
  nextOwnedSong,
  playableSongIds,
  previousOwnedSong,
  songById,
} from "@/lib/songs";
import { FarmDialog } from "./farm-dialog";
import { PixelPetArt } from "./pixel-pet";

const CONFETTI = [
  { left: "6%", delay: "0s", duration: "1.7s", color: "#c6ef4a", rotate: "-16deg" },
  { left: "14%", delay: "0.15s", duration: "1.9s", color: "#fff8e8", rotate: "12deg" },
  { left: "22%", delay: "0.05s", duration: "1.6s", color: "#e39a45", rotate: "24deg" },
  { left: "31%", delay: "0.28s", duration: "2s", color: "#9bc72d", rotate: "-8deg" },
  { left: "40%", delay: "0.08s", duration: "1.8s", color: "#f7f3e8", rotate: "18deg" },
  { left: "48%", delay: "0.22s", duration: "1.65s", color: "#c6ef4a", rotate: "-22deg" },
  { left: "57%", delay: "0.02s", duration: "1.85s", color: "#e39a45", rotate: "8deg" },
  { left: "66%", delay: "0.18s", duration: "1.75s", color: "#fff8e8", rotate: "-14deg" },
  { left: "74%", delay: "0.1s", duration: "2.05s", color: "#9bc72d", rotate: "20deg" },
  { left: "83%", delay: "0.26s", duration: "1.7s", color: "#c6ef4a", rotate: "-6deg" },
  { left: "91%", delay: "0.04s", duration: "1.9s", color: "#e39a45", rotate: "16deg" },
  { left: "18%", delay: "0.34s", duration: "2.1s", color: "#fff8e8", rotate: "-20deg" },
  { left: "52%", delay: "0.32s", duration: "1.95s", color: "#f7f3e8", rotate: "10deg" },
  { left: "78%", delay: "0.12s", duration: "1.8s", color: "#c6ef4a", rotate: "-12deg" },
];

const DEFAULT_VOLUME = 0.7;

function songStorageKey(userId: string) {
  return `aurafarm.song.${userId}`;
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function readSavedSong(userId: string) {
  const raw = localStorage.getItem(songStorageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      id?: unknown;
      stopped?: unknown;
      volume?: unknown;
    };
    if (typeof parsed.id !== "string" || typeof parsed.stopped !== "boolean") return null;
    if (!songById(parsed.id)) return null;
    return {
      id: parsed.id,
      stopped: parsed.stopped,
      volume: typeof parsed.volume === "number" ? clampVolume(parsed.volume) : DEFAULT_VOLUME,
    };
  } catch {
    return null;
  }
}

function formatSongTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function DeskSong({
  userId,
  ownedIds,
  featuredSongId,
  songsError,
  open,
  onClose,
}: {
  userId: string;
  ownedIds: readonly string[];
  featuredSongId: string | null;
  songsError: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hydratedUser = useRef<string | null>(null);
  const ownedKey = ownedIds.join("|");
  const [ready, setReady] = useState(false);
  const [currentId, setCurrentId] = useState(STARTER_SONG_ID);
  const [stopped, setStopped] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastAudibleVolume = useRef(DEFAULT_VOLUME);
  const current = songById(currentId) ?? songById(STARTER_SONG_ID)!;

  useEffect(() => {
    const ids = playableSongIds(ownedKey.split("|").filter(Boolean));
    if (hydratedUser.current !== userId) {
      hydratedUser.current = userId;
      const saved = readSavedSong(userId);
      if (saved && ids.includes(saved.id)) {
        setCurrentId(saved.id);
        setStopped(saved.stopped);
        setVolume(saved.volume);
        if (saved.volume > 0) lastAudibleVolume.current = saved.volume;
      } else {
        setCurrentId(ids[0] ?? STARTER_SONG_ID);
        setStopped(false);
        setVolume(DEFAULT_VOLUME);
        lastAudibleVolume.current = DEFAULT_VOLUME;
      }
      setReady(true);
      return;
    }
    setCurrentId((id) => (ids.includes(id) ? id : (ids[0] ?? STARTER_SONG_ID)));
  }, [userId, ownedKey]);

  useEffect(() => {
    if (!ready || !featuredSongId || !songById(featuredSongId)) return;
    setCurrentId(featuredSongId);
    setStopped(false);
    setNotice("");
  }, [ready, featuredSongId]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(
      songStorageKey(userId),
      JSON.stringify({ id: currentId, stopped, volume }),
    );
  }, [ready, userId, currentId, stopped, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    audio.volume = volume;
  }, [ready, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    const nextSrc = new URL(current.src, window.location.origin).href;
    const srcChanged = audio.src !== nextSrc;
    if (srcChanged) {
      audio.pause();
      audio.src = current.src;
      audio.load();
      audio.currentTime = 0;
      setElapsed(0);
      setDuration(0);
    }

    if (stopped) {
      audio.pause();
      return;
    }

    let gone = false;
    const tryPlay = () => {
      if (gone) return;
      void audio.play().catch(() => {});
    };
    const onReady = () => {
      audio.removeEventListener("canplay", onReady);
      tryPlay();
    };
    // After a paused track change, src is already updated so srcChanged is
    // false on resume — still wait for canplay if the buffer is not ready.
    const needsReady = srcChanged || audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
    if (needsReady) audio.addEventListener("canplay", onReady);
    tryPlay();
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    return () => {
      gone = true;
      audio.removeEventListener("canplay", onReady);
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [ready, current.src, stopped]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    const syncProgress = () => {
      setElapsed(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    syncProgress();
    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("loadedmetadata", syncProgress);
    audio.addEventListener("durationchange", syncProgress);
    audio.addEventListener("seeked", syncProgress);
    return () => {
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("loadedmetadata", syncProgress);
      audio.removeEventListener("durationchange", syncProgress);
      audio.removeEventListener("seeked", syncProgress);
    };
  }, [ready, current.src]);

  function toggle() {
    setNotice("");
    setStopped((playingStopped) => !playingStopped);
  }

  function changeSong(direction: "next" | "previous") {
    const owned = playableSongIds(ownedKey.split("|").filter(Boolean));
    const result =
      direction === "next" ? nextOwnedSong(owned, currentId) : previousOwnedSong(owned, currentId);
    if (!result.song) {
      setNotice(result.message || NO_OTHER_SONGS);
      return;
    }
    setNotice("");
    setCurrentId(result.song.id);
  }

  function seek(next: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(next)) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : duration;
    const clamped = Math.min(Math.max(0, next), max || 0);
    audio.currentTime = clamped;
    setElapsed(clamped);
  }

  function setSongVolume(next: number) {
    const clamped = clampVolume(next);
    if (clamped > 0) lastAudibleVolume.current = clamped;
    setVolume(clamped);
  }

  function toggleMute() {
    if (volume > 0) {
      lastAudibleVolume.current = volume;
      setVolume(0);
      return;
    }
    setVolume(lastAudibleVolume.current > 0 ? lastAudibleVolume.current : DEFAULT_VOLUME);
  }

  const progressMax = duration > 0 ? duration : 0;
  const progressValue = progressMax > 0 ? Math.min(elapsed, progressMax) : 0;
  const progressPercent = progressMax > 0 ? (progressValue / progressMax) * 100 : 0;
  const volumePercent = volume * 100;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" hidden />
      {open ? (
        <FarmDialog title="Song" onClose={onClose}>
          <p>{stopped ? "Paused" : "Now playing"}</p>
          <p className="song-title">{current.title}</p>
          <div
            className={stopped ? "song-vinyl" : "song-vinyl is-playing"}
            aria-hidden="true"
          >
            <span className="song-vinyl-disc">
              <span className="song-vinyl-grooves" />
              <span className="song-vinyl-label">{current.title.slice(0, 1)}</span>
            </span>
          </div>
          <div className="song-progress">
            <input
              type="range"
              className="song-progress-range"
              min={0}
              max={progressMax || 1}
              step={0.1}
              value={progressValue}
              disabled={progressMax <= 0}
              aria-label="Song progress"
              style={{ "--song-progress": `${progressPercent}%` } as CSSProperties}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <div className="song-progress-times" aria-hidden="true">
              <span>{formatSongTime(progressValue)}</span>
              <span>{formatSongTime(progressMax)}</span>
            </div>
          </div>
          {songsError ? <p className="form-error">{songsError}</p> : null}
          <div className="song-actions">
            <div className="song-transport-group">
              <button
                type="button"
                className="button button-ghost song-transport"
                onClick={() => changeSong("previous")}
                aria-label="Previous song"
              >
                <span className="song-icon song-icon-prev" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button song-transport"
                onClick={toggle}
                aria-label={stopped ? "Play" : "Pause"}
              >
                {stopped ? (
                  <span className="song-icon song-icon-play" aria-hidden="true" />
                ) : (
                  <span className="song-icon song-icon-pause" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="button button-ghost song-transport"
                onClick={() => changeSong("next")}
                aria-label="Next song"
              >
                <span className="song-icon song-icon-next" aria-hidden="true" />
              </button>
            </div>
            <div className="song-volume">
              <button
                type="button"
                className="button button-ghost song-volume-toggle"
                onClick={toggleMute}
                aria-label={volume > 0 ? "Mute" : "Unmute"}
              >
                {volume > 0 ? (
                  <svg className="song-volume-glyph" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M2.5 5.75h2.1L7.8 3.4a.6.6 0 0 1 1 .45v8.3a.6.6 0 0 1-1 .45L4.6 10.25H2.5A.75.75 0 0 1 1.75 9.5v-3a.75.75 0 0 1 .75-.75Zm8.35 1.05a.6.6 0 0 1 .85 0 2.1 2.1 0 0 1 0 3a.6.6 0 1 1-.85-.85 1 1 0 0 0 0-1.3.6.6 0 0 1 0-.85Zm1.7-1.85a.6.6 0 0 1 .85 0 4.75 4.75 0 0 1 0 6.7.6.6 0 1 1-.85-.85 3.55 3.55 0 0 0 0-5 .6.6 0 0 1 0-.85Z"
                    />
                  </svg>
                ) : (
                  <svg className="song-volume-glyph" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M2.5 5.75h2.1L7.8 3.4a.6.6 0 0 1 1 .45v8.3a.6.6 0 0 1-1 .45L4.6 10.25H2.5A.75.75 0 0 1 1.75 9.5v-3a.75.75 0 0 1 .75-.75Zm8.05.15 1.2 1.2 1.2-1.2a.6.6 0 1 1 .85.85l-1.2 1.2 1.2 1.2a.6.6 0 1 1-.85.85l-1.2-1.2-1.2 1.2a.6.6 0 1 1-.85-.85l1.2-1.2-1.2-1.2a.6.6 0 1 1 .85-.85Z"
                    />
                  </svg>
                )}
              </button>
              <input
                type="range"
                className="song-progress-range song-volume-range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                style={{ "--song-progress": `${volumePercent}%` } as CSSProperties}
                onChange={(event) => setSongVolume(Number(event.target.value))}
              />
            </div>
          </div>
          {notice ? (
            <p className="form-error" role="status">
              {notice}
            </p>
          ) : null}
        </FarmDialog>
      ) : null}
    </>
  );
}

export function SongUnlockCelebration({
  songTitle,
  songId,
  pet,
  onContinue,
}: {
  songTitle: string;
  songId: string;
  pet: PetCard;
  onContinue: () => void;
}) {
  const titleId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  const copy = describePet(pet.pet_type);

  useEffect(() => {
    void markSongSeen(songId);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    continueRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onContinue();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        continueRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onContinue, songId]);

  return (
    <div className="level-up" role="presentation" onClick={onContinue}>
      <div
        className="level-up-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="level-up-confetti" aria-hidden="true">
          {CONFETTI.map((bit) => (
            <span
              key={`${bit.left}-${bit.delay}`}
              className="level-up-bit"
              style={{
                left: bit.left,
                background: bit.color,
                animationDelay: bit.delay,
                animationDuration: bit.duration,
                transform: `rotate(${bit.rotate})`,
              }}
            />
          ))}
        </div>
        <div className="level-up-rays" aria-hidden="true" />
        <div className="level-up-light" aria-hidden="true" />
        <PixelPetArt
          petType={pet.pet_type}
          color={pet.color}
          hat={pet.hat}
          clothes={pet.clothes}
          className="level-up-pet"
          alt={copy.name}
        />
        <div className="level-up-copy">
          <p className="level-up-kicker">{songTitle}</p>
          <h2 id={titleId} className="level-up-title">
            New song unlocked
          </h2>
        </div>
        <button ref={continueRef} type="button" className="button" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
