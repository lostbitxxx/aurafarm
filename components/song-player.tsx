"use client";

import { useEffect, useId, useRef, useState } from "react";
import { markSongSeen } from "@/lib/actions/songs";
import { describePet, type PetCard } from "@/lib/pets";
import {
  NO_OTHER_SONGS,
  STARTER_SONG_ID,
  nextOwnedSong,
  playableSongIds,
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

function songStorageKey(userId: string) {
  return `aurafarm.song.${userId}`;
}

function readSavedSong(userId: string) {
  const raw = localStorage.getItem(songStorageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; stopped?: unknown };
    if (typeof parsed.id !== "string" || typeof parsed.stopped !== "boolean") return null;
    if (!songById(parsed.id)) return null;
    return { id: parsed.id, stopped: parsed.stopped };
  } catch {
    return null;
  }
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
  const [notice, setNotice] = useState("");
  const current = songById(currentId) ?? songById(STARTER_SONG_ID)!;

  useEffect(() => {
    const ids = playableSongIds(ownedKey.split("|").filter(Boolean));
    if (hydratedUser.current !== userId) {
      hydratedUser.current = userId;
      const saved = readSavedSong(userId);
      if (saved && ids.includes(saved.id)) {
        setCurrentId(saved.id);
        setStopped(saved.stopped);
      } else {
        setCurrentId(ids[0] ?? STARTER_SONG_ID);
        setStopped(false);
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
    localStorage.setItem(songStorageKey(userId), JSON.stringify({ id: currentId, stopped }));
  }, [ready, userId, currentId, stopped]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    const nextSrc = new URL(current.src, window.location.origin).href;
    if (audio.src !== nextSrc) audio.src = current.src;
    if (stopped) {
      audio.pause();
      return;
    }
    let gone = false;
    const tryPlay = () => {
      if (gone) return;
      void audio.play().catch(() => {});
    };
    tryPlay();
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    return () => {
      gone = true;
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [ready, current, stopped]);

  function toggle() {
    setNotice("");
    setStopped((playingStopped) => !playingStopped);
  }

  function skip() {
    const result = nextOwnedSong(playableSongIds(ownedKey.split("|").filter(Boolean)), currentId);
    if (!result.song) {
      setNotice(result.message || NO_OTHER_SONGS);
      return;
    }
    setNotice("");
    setCurrentId(result.song.id);
  }

  return (
    <>
      <audio ref={audioRef} loop preload="auto" hidden />
      {open ? (
        <FarmDialog title="Song" onClose={onClose}>
          <p>{stopped ? "Paused" : "Now playing"}</p>
          <p className="song-title">{current.title}</p>
          {songsError ? <p className="form-error">{songsError}</p> : null}
          <div className="song-actions">
            <button type="button" className="button" onClick={toggle}>
              {stopped ? "Play" : "Stop"}
            </button>
            <button type="button" className="button button-ghost" onClick={skip}>
              Next song
            </button>
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
