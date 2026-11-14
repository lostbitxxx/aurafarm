"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { completeStudyTimer, endStudyEarly, setCloseBlocked, startStudySession } from "@/lib/actions/study";
import type { PetCard } from "@/lib/pets";
import {
  buildPetLaunchUrl,
  DEFAULT_STUDY_SECONDS,
  MAX_STUDY_MINUTES,
  MIN_STUDY_MINUTES,
  plannedStudySeconds,
  DEV_TIMER_PASSWORD,
  devTimerPasswordMatches,
  buildStudyHistory,
  formatClock,
  formatDuration,
  formatHistoryTime,
  formatHistoryXp,
  formatTimestamp,
  experienceForSession,
  farmerLocalDay,
  remainingSeconds,
  sessionCountsForStreak,
  STUDY_LENGTHS,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "@/lib/study";
import { HistoryDialog } from "./dashboard-dialogs";
import { LivingRoom } from "./living-room";
import { PetDetailDialog } from "./pet-detail-dialog";
import { PetStatus } from "./pet-status";

function preferredStudySeconds(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < MIN_STUDY_MINUTES) {
    return DEFAULT_STUDY_SECONDS;
  }
  const capped = Math.min(MAX_STUDY_MINUTES, Math.floor(minutes));
  return capped * 60;
}

export function StudyPanel({
  activeSession,
  scores,
  recordedSessions,
  studyError,
  closeBlocked,
  closeBlockedError,
  pets,
  petLevel,
  petXp,
  downloadUrl,
  placedIds,
  placementReady,
  preferredSessionMinutes,
  streakBoostActive = false,
  streakQualifiedToday = false,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  onOpenInventory,
  onEquipped,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
}: {
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  recordedSessions: RecordedStudySession[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  pets: PetCard[];
  petName: string;
  petLevel: number | null;
  petXp: number;
  petNote: string;
  downloadUrl: string | null;
  placedIds: ReadonlySet<string>;
  placementReady: boolean;
  preferredSessionMinutes?: number | null;
  streakBoostActive?: boolean;
  streakQualifiedToday?: boolean;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  onOpenInventory: () => void;
  onEquipped?: (petId: string) => void;
  onColorApplied: (petId: string, colorId: string) => void;
  onHatApplied: (petId: string, hatId: string | null) => void;
  onClothesApplied: (petId: string, clothesId: string | null) => void;
}) {
  const signature = [
    activeSession?.id ?? "",
    activeSession?.startedAt ?? "",
    activeSession?.plannedSeconds ?? "",
    activeSession?.useDesktopPet ? "pet" : "web",
    scores.map((score) => score.id).join(","),
    recordedSessions.map((session) => `${session.id}:${session.durationSeconds}`).join(","),
    pets
      .map(
        (pet) =>
          `${pet.id}:${pet.xp}:${pet.is_desktop_active}:${pet.color ?? ""}:${pet.hat ?? ""}:${pet.clothes ?? ""}`,
      )
      .join(","),
    studyError ?? "",
    closeBlocked ? "1" : "0",
    closeBlockedError ?? "",
  ].join("|");
  const [snapshot, setSnapshot] = useState(signature);
  const [error, setError] = useState<string | null>(studyError);
  const [pending, setPending] = useState(false);
  const [launchCode, setLaunchCode] = useState("");
  const [codeSessionId, setCodeSessionId] = useState("");
  const [localStartedAt, setLocalStartedAt] = useState("");
  const [localPlanned, setLocalPlanned] = useState(DEFAULT_STUDY_SECONDS);
  const [localDesktop, setLocalDesktop] = useState(false);
  const [chosenSeconds, setChosenSeconds] = useState(() =>
    preferredStudySeconds(preferredSessionMinutes),
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const preferredSeconds = preferredStudySeconds(preferredSessionMinutes);
  const [preferredSnap, setPreferredSnap] = useState(preferredSeconds);
  if (preferredSeconds !== preferredSnap) {
    setPreferredSnap(preferredSeconds);
    setChosenSeconds(preferredSeconds);
    setCustomOpen(false);
    setCustomMinutes("");
  }
  const [lengthOpen, setLengthOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackerChoice, setTrackerChoice] = useState<boolean | null>(null);
  const [hiddenSessionId, setHiddenSessionId] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [trackedSession, setTrackedSession] = useState(activeSession?.id ?? "");
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devRejected, setDevRejected] = useState(false);
  const [rushed, setRushed] = useState(false);
  const [detailPetId, setDetailPetId] = useState<string | null>(null);
  const [history, setHistory] = useState<"activity" | "download" | "dev-info" | null>(null);
  const drawerHandleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  if (signature !== snapshot) {
    setSnapshot(signature);
    setError(studyError);
    if (!activeSession || activeSession.id !== hiddenSessionId) {
      setHiddenSessionId("");
    }
    if (!activeSession) {
      setLaunchCode("");
      setCodeSessionId("");
      setLocalStartedAt("");
      setRushed(false);
    }
  }

  const serverSession = activeSession && activeSession.id !== hiddenSessionId ? activeSession : null;
  const shownSession =
    serverSession ??
    (codeSessionId && localStartedAt && codeSessionId !== hiddenSessionId
      ? {
          id: codeSessionId,
          startedAt: localStartedAt,
          plannedSeconds: localPlanned,
          useDesktopPet: localDesktop,
        }
      : null);
  const visibleCode = shownSession && codeSessionId === shownSession.id ? launchCode : "";
  const launchUrl = visibleCode ? buildPetLaunchUrl(visibleCode) : "";
  const sessionId = shownSession?.id ?? "";

  if (sessionId !== trackedSession) {
    setTrackedSession(sessionId);
  }

  const railError = error;
  if (railError !== trackedError) {
    setTrackedError(railError);
    if (railError) setRailOpen(true);
  }

  async function finishSession(devPasswordValue: string) {
    if (!shownSession) return { error: "No study session is running." };
    setPending(true);
    setError(null);
    const result = await completeStudyTimer(shownSession.id, devPasswordValue, farmerLocalDay());
    setPending(false);
    if (result.error) {
      setError(result.error);
      return result;
    }
    setLaunchCode("");
    setCodeSessionId("");
    setLocalStartedAt("");
    setRushed(false);
    setHiddenSessionId(shownSession.id);
    return result;
  }

  function onAskTracker() {
    if (pending || shownSession) return;
    setTrackerChoice(null);
    setError(null);
    setTrackerOpen(false);
    setLengthOpen(true);
  }

  function onCloseLength() {
    if (pending) return;
    setLengthOpen(false);
  }

  function onChoosePreset(seconds: number) {
    setCustomOpen(false);
    setCustomMinutes("");
    setChosenSeconds(seconds);
  }

  function onChooseCustom() {
    setCustomOpen(true);
    setCustomMinutes("");
  }

  function onCustomMinutes(value: string) {
    setCustomMinutes(value);
    const minutes = Number(value);
    const seconds = plannedStudySeconds(minutes * 60);
    if (seconds !== null) setChosenSeconds(seconds);
  }

  function selectedLengthSeconds() {
    if (!customOpen) return plannedStudySeconds(chosenSeconds);
    return plannedStudySeconds(Number(customMinutes) * 60);
  }

  function onConfirmLength() {
    const seconds = selectedLengthSeconds();
    if (pending || seconds === null) return;
    setChosenSeconds(seconds);
    setLengthOpen(false);
    setTrackerChoice(null);
    setTrackerOpen(true);
  }

  function onCloseTracker() {
    if (pending) return;
    setTrackerOpen(false);
    setLengthOpen(true);
  }

  async function onConfirmTracker() {
    if (pending || trackerChoice === null) return;
    setPending(true);
    setError(null);
    const result = await startStudySession(chosenSeconds, trackerChoice);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTrackerOpen(false);
    setRushed(false);
    setLaunchCode(result.launchCode);
    setCodeSessionId(result.sessionId);
    setLocalStartedAt(new Date().toISOString());
    setLocalPlanned(chosenSeconds);
    setLocalDesktop(trackerChoice);
    if (trackerChoice) setRailOpen(false);
  }

  async function onToggleClose() {
    if (pending || closeBlockedError) return;
    setPending(true);
    setError(null);
    const result = await setCloseBlocked(!closeBlocked);
    setPending(false);
    if (result.error) setError(result.error);
  }

  function onOpenEarly() {
    if (pending || !shownSession) return;
    setEarlyOpen(true);
  }

  function onCloseEarly() {
    if (pending) return;
    setEarlyOpen(false);
  }

  async function onConfirmEarly() {
    if (pending || !shownSession) return;
    setPending(true);
    setError(null);
    const result = await endStudyEarly(shownSession.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEarlyOpen(false);
    setLaunchCode("");
    setCodeSessionId("");
    setLocalStartedAt("");
    setRushed(false);
    setHiddenSessionId(shownSession.id);
  }

  function onOpenDev() {
    if (pending) return;
    setDevRejected(false);
    setDevOpen(true);
  }

  function onCloseDev() {
    if (pending) return;
    setDevOpen(false);
  }

  async function onDevFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !shownSession || shownSession.useDesktopPet) return;
    if (!devTimerPasswordMatches(devPassword)) {
      setDevRejected(true);
      return;
    }
    setDevRejected(false);
    setRushed(true);
    const result = await finishSession(DEV_TIMER_PASSWORD);
    if (!result.error) {
      setDevPassword("");
      setDevOpen(false);
    }
  }

  const lengthSeconds = selectedLengthSeconds();
  const detailPet = detailPetId ? pets.find((pet) => pet.id === detailPetId) ?? null : null;

  useEffect(() => {
    if (!railOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const drawer = drawerRef.current;
      const active = document.activeElement;
      if (!drawer || !(active instanceof Node) || !drawer.contains(active)) return;
      event.preventDefault();
      setRailOpen(false);
      drawerHandleRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [railOpen]);

  return (
    <main className="desk">
      <section className="scene" aria-label="Study scene">
        <LivingRoom
          pets={pets}
          placedIds={placedIds}
          placementReady={placementReady}
          onOpenPet={setDetailPetId}
          onOpenInventory={onOpenInventory}
        />
        <div className="below-room">
          <div className="session-copy">
            <div className={shownSession ? "session-title-row" : undefined}>
              <p className="pet-name">{shownSession ? "Studying with you" : "Ready for a little focus?"}</p>
              {shownSession ? (
                <button type="button" className="button button-ghost button-end-early" disabled={pending} onClick={onOpenEarly}>
                  End session early
                </button>
              ) : null}
            </div>
            <p className="growth-label">
              {shownSession
                ? shownSession.useDesktopPet
                  ? "Desktop pet is tracking this session."
                  : "Website timer is tracking this session."
                : "Choose the duration and tracker in two steps."}
            </p>
            {shownSession?.useDesktopPet ? (
              <div className="study-active">
                {launchUrl ? (
                  <>
                    <p>Launch the pet, then open this link or paste the code. It expires in 5 minutes.</p>
                    <a className="launch-link" href={launchUrl}>
                      {launchUrl}
                    </a>
                    <CopySessionCode code={visibleCode} />
                  </>
                ) : (
                  <p>The launch code was shown when this session started.</p>
                )}
                <p>
                  Started <time dateTime={shownSession.startedAt}>{formatTimestamp(shownSession.startedAt)}</time>
                </p>
                <p>{formatClock(shownSession.plannedSeconds)} chosen</p>
              </div>
            ) : shownSession ? (
              <StudyClock
                session={shownSession}
                rushed={rushed}
                onFinished={() => finishSession("")}
              />
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          {shownSession ? null : (
            <div className="scene-actions is-start">
              <button type="button" className="button button-start" disabled={pending} onClick={onAskTracker}>
                Start studying →
              </button>
            </div>
          )}
        </div>
      </section>
      <div
        ref={drawerRef}
        className={railOpen ? "companion-drawer is-open" : "companion-drawer"}
      >
        <div className="level-dock">
          <button
            ref={drawerHandleRef}
            type="button"
            className="level-bar"
            aria-expanded={railOpen}
            aria-controls="study-rail"
            aria-label={railOpen ? "Collapse companion panel" : "Expand companion panel"}
            onClick={() => setRailOpen((open) => !open)}
          >
            <span className="level-bar-handle" aria-hidden="true">
              <span className={`level-bar-arrow${railOpen ? " is-expanded" : ""}`}>
                <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
                  <path
                    fill="currentColor"
                    d="M6.7 14.7a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 1 1-1.4 1.4L12 10.8l-3.9 3.9a1 1 0 0 1-1.4 0z"
                  />
                </svg>
              </span>
              <span className="level-bar-rule">
                <span className="level-bar-line" />
                <span className="level-bar-gear">
                  <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                    <path
                      fill="currentColor"
                      d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.4 8.8a.5.5 0 0 0 .1.6l2 1.6a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
                    />
                  </svg>
                </span>
                <span className="level-bar-line" />
              </span>
            </span>
          </button>
          <div className="level-bar-stats">
            <span className="bar-level">{petLevel === null ? "—" : `LV${petLevel}`}</span>
            <div
              className="level-bar-track"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={petXp}
              aria-label={petLevel === null ? "Equipped pet experience" : `Level ${petLevel} experience`}
            >
              <span className="level-bar-fill" style={{ width: `${petXp}%` }} />
            </div>
          </div>
        </div>
        <div
          id="study-rail"
          className="study-rail"
          role="region"
          aria-label="Personalization"
          aria-hidden={!railOpen}
          {...(!railOpen ? { inert: true } : {})}
        >
          <div className="study-rail-inner">
            <h2 className="drawer-heading">Personalization</h2>
            <div className="personalization-actions">
              <button type="button" className="button button-ghost" onClick={() => setHistory("activity")}>
                Sessions & Experience
              </button>
              <button type="button" className="button button-ghost" onClick={() => setHistory("download")}>
                Download the Mac pet
              </button>
              <button type="button" className="button button-ghost" onClick={() => setHistory("dev-info")}>
                Dev tools
              </button>
            </div>
          </div>
        </div>
      </div>
      {lengthOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseLength}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="length-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="length-title">How long will you study?</h2>
              <button type="button" className="dialog-close" onClick={onCloseLength} aria-label="Close dialog">
                ×
              </button>
            </div>
            <div className="length-choices" role="group" aria-label="Study length">
              {STUDY_LENGTHS.map((length) => (
                <button
                  key={length.seconds}
                  type="button"
                  className={!customOpen && chosenSeconds === length.seconds ? "button" : "button button-ghost"}
                  aria-pressed={!customOpen && chosenSeconds === length.seconds}
                  disabled={pending}
                  onClick={() => onChoosePreset(length.seconds)}
                >
                  {length.minutes} min
                </button>
              ))}
              <button
                type="button"
                className={customOpen ? "button" : "button button-ghost"}
                aria-pressed={customOpen}
                disabled={pending}
                onClick={onChooseCustom}
              >
                Custom
              </button>
            </div>
            {customOpen ? (
              <label className="field">
                Custom minutes
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_STUDY_MINUTES}
                  max={MAX_STUDY_MINUTES}
                  step={1}
                  value={customMinutes}
                  placeholder={`${MIN_STUDY_MINUTES}–${MAX_STUDY_MINUTES}`}
                  autoFocus
                  onChange={(event) => onCustomMinutes(event.target.value)}
                />
              </label>
            ) : null}
            {lengthSeconds === null ? (
              <p>Use {MIN_STUDY_MINUTES} to {MAX_STUDY_MINUTES} whole minutes.</p>
            ) : (
              <p>
                A full finish is{" "}
                {experienceForSession(
                  lengthSeconds,
                  false,
                  streakBoostActive && sessionCountsForStreak(lengthSeconds),
                )}{" "}
                XP
                {streakBoostActive && sessionCountsForStreak(lengthSeconds)
                  ? " with streak boost"
                  : ""}
                . Ending early does not count for the streak
                {!sessionCountsForStreak(lengthSeconds)
                  ? ". Custom sessions need at least 5 minutes to count for the streak"
                  : streakQualifiedToday
                    ? ". Today already counts"
                    : ""}
                .
              </p>
            )}
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={onCloseLength}>
                Cancel
              </button>
              <button type="button" className="button" disabled={pending || lengthSeconds === null} onClick={onConfirmLength}>
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {trackerOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseTracker}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="tracker-title">How should this session be tracked?</h2>
              <button type="button" className="dialog-close" onClick={onCloseTracker} aria-label="Close dialog">
                ×
              </button>
            </div>
            <p>The session starts when you confirm.</p>
            <div className="tracker-choices" role="group" aria-label="Session tracker">
              <button
                type="button"
                className={trackerChoice === true ? "button" : "button button-ghost"}
                aria-pressed={trackerChoice === true}
                disabled={pending}
                onClick={() => setTrackerChoice(true)}
              >
                Desktop pet
              </button>
              <button
                type="button"
                className={trackerChoice === false ? "button" : "button button-ghost"}
                aria-pressed={trackerChoice === false}
                disabled={pending}
                onClick={() => setTrackerChoice(false)}
              >
                Website timer
              </button>
            </div>
            {trackerChoice === true ? (
              <>
                <p>
                  The desktop pet tracks the time.
                  {closeBlocked
                    ? " It comes forward and closes a blocklist window after one minute."
                    : " Closing blocklist windows is off."}
                </p>
                <button
                  type="button"
                  className={closeBlocked ? "button" : "button button-ghost"}
                  aria-pressed={closeBlocked}
                  disabled={pending || Boolean(closeBlockedError)}
                  onClick={onToggleClose}
                >
                  Close blocked tabs: {closeBlocked ? "On" : "Off"}
                </button>
                {closeBlockedError ? (
                  <p className="form-error" role="alert">
                    {closeBlockedError}
                  </p>
                ) : null}
                <PetStatus downloadUrl={downloadUrl} />
              </>
            ) : null}
            {trackerChoice === false ? <p>The website countdown tracks the time.</p> : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={onCloseTracker}>
                Back
              </button>
              <button type="button" className="button" disabled={pending || trackerChoice === null} onClick={onConfirmTracker}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {earlyOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseEarly}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="early-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="early-title">End this session early?</h2>
              <button type="button" className="dialog-close" onClick={onCloseEarly} aria-label="Close dialog">
                ×
              </button>
            </div>
            <p>
              The time you have already studied will be saved. Staying until the timer ends gives your pet a
              bigger bonus.
            </p>
            <p className="motivation-quote">A quiet minute still grows. The full session just grows your pet more.</p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={onCloseEarly}>
                Keep studying
              </button>
              <button type="button" className="button" disabled={pending} onClick={onConfirmEarly}>
                End session early
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {devOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseDev}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dev-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="dev-title">Finish this session now</h2>
              <button type="button" className="dialog-close" onClick={onCloseDev} aria-label="Close dialog">
                ×
              </button>
            </div>
            <form onSubmit={onDevFinish}>
              <label className="field">
                Password
                <input
                  type="password"
                  value={devPassword}
                  autoComplete="off"
                  onChange={(event) => setDevPassword(event.target.value)}
                />
              </label>
              {devRejected ? (
                <p className="form-error" role="alert">
                  That password does not match.
                </p>
              ) : null}
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="tracker-actions">
                <button type="button" className="button button-ghost" disabled={pending} onClick={onCloseDev}>
                  Back
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={pending || !shownSession || shownSession.useDesktopPet}
                >
                  Finish now
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {detailPet ? (
        <PetDetailDialog
          pet={detailPet}
          ownedColorIds={ownedColorIds}
          ownedHatIds={ownedHatIds}
          ownedClothesIds={ownedClothesIds}
          sessionActive={Boolean(shownSession)}
          onClose={() => setDetailPetId(null)}
          onEquipped={onEquipped}
          onColorApplied={onColorApplied}
          onHatApplied={onHatApplied}
          onClothesApplied={onClothesApplied}
        />
      ) : null}
      {history === "activity" ? (
        <StudyHistoryDialog
          recordedSessions={recordedSessions}
          scores={scores}
          onClose={() => setHistory(null)}
        />
      ) : null}
      {history === "download" ? (
        <HistoryDialog title="Mac companion" onClose={() => setHistory(null)}>
          <PetStatus downloadUrl={downloadUrl} />
        </HistoryDialog>
      ) : null}
      {history === "dev-info" ? (
        <HistoryDialog title="Developer tools" onClose={() => setHistory(null)}>
          <p className="panel-hint">Finish a website timer early for testing.</p>
          {shownSession && !shownSession.useDesktopPet ? (
            <button type="button" className="button" onClick={() => { setHistory(null); onOpenDev(); }}>
              Open Dev finish
            </button>
          ) : (
            <p className="panel-hint">Start a website timer session to unlock the finish helper.</p>
          )}
        </HistoryDialog>
      ) : null}
    </main>
  );
}

function StudyHistoryDialog({
  recordedSessions,
  scores,
  onClose,
}: {
  recordedSessions: RecordedStudySession[];
  scores: StudyScoreCard[];
  onClose: () => void;
}) {
  const { cards, unmatchedScores } = buildStudyHistory(recordedSessions, scores);

  return (
    <HistoryDialog title="Sessions & Experience" onClose={onClose}>
      <section className="study-history-section" aria-labelledby="study-history-title">
        <h3 id="study-history-title" className="history-section-title">
          Study history
        </h3>
        {cards.length === 0 ? (
          <p className="empty-pets">No study time recorded yet.</p>
        ) : (
          <ul className="study-history">
            {cards.map((card) => {
              const distractionKnown = card.distractionSeconds !== null && card.distractionSeconds > 0;
              return (
                <li key={card.id} className="study-history-card">
                  <div className="study-history-top">
                    <div className="study-history-status">
                      <span className="study-history-badge">
                        {card.status === "cancelled" ? "Cancelled" : "Finished"}
                      </span>
                      <span className="study-history-duration">{formatDuration(card.durationSeconds)}</span>
                    </div>
                    <span className="study-history-xp">{formatHistoryXp(card.xp)}</span>
                  </div>
                  <span
                    className={
                      card.modeLabel === "Mode unknown"
                        ? "study-history-mode is-unknown"
                        : "study-history-mode"
                    }
                  >
                    {card.modeLabel}
                  </span>
                  {card.showFocusDistraction ? (
                    <div className="study-history-times">
                      <div className="study-history-time-row">
                        <span>Focus time</span>
                        <span>{formatHistoryTime(card.focusSeconds)}</span>
                      </div>
                      <div
                        className={
                          distractionKnown
                            ? "study-history-time-row is-distracted"
                            : "study-history-time-row"
                        }
                      >
                        <span>Distraction time</span>
                        <span>{formatHistoryTime(card.distractionSeconds)}</span>
                      </div>
                    </div>
                  ) : null}
                  {card.endedAt ? (
                    <time className="study-history-date" dateTime={card.endedAt}>
                      {formatTimestamp(card.endedAt)}
                    </time>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {unmatchedScores.length > 0 ? (
        <section className="history-section" aria-labelledby="unmatched-xp-title">
          <h3 id="unmatched-xp-title" className="history-section-title">
            Experience not linked in this list
          </h3>
          <p className="panel-hint">
            These XP rows share a session id that is not in the loaded study-history page.
          </p>
          <ul className="score-list">
            {unmatchedScores.map((score) => (
              <li key={score.id}>
                <strong>{formatHistoryXp(score.xp)}</strong>
                <span>Session {score.id}</span>
                {score.createdAt ? (
                  <time dateTime={score.createdAt}>{formatTimestamp(score.createdAt)}</time>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </HistoryDialog>
  );
}

function CopySessionCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="launch-code-row">
      <p className="launch-code">{code}</p>
      <button
        type="button"
        className="button button-small"
        aria-label="Copy session code"
        onClick={() => void onCopy()}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function StudyClock({
  session,
  rushed,
  onFinished,
}: {
  session: ActiveStudySession;
  rushed: boolean;
  onFinished: (() => Promise<{ error: string }>) | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  const attempt = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [session.id]);

  const remaining = rushed
    ? 0
    : now === null
      ? null
      : remainingSeconds(session.startedAt, session.plannedSeconds, now);

  useEffect(() => {
    if (!onFinishedRef.current) return;
    if (now === null || remaining === null || remaining > 0) return;
    if (attempt.current === session.id) return;
    attempt.current = session.id;
    void onFinishedRef.current().then((result) => {
      if (result.error === "Study time has not finished") attempt.current = null;
    });
  }, [now, remaining, session.id]);

  return (
    <p className="study-clock" role="timer">
      {remaining === null ? "—" : formatClock(remaining)}
    </p>
  );
}
