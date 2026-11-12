"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { completeStudyTimer, setCloseBlocked, startStudySession } from "@/lib/actions/study";
import { describePet, equippedPet, type PetCard } from "@/lib/pets";
import {
  buildPetLaunchUrl,
  DEFAULT_STUDY_SECONDS,
  DEV_TIMER_PASSWORD,
  devTimerPasswordMatches,
  experienceProgress,
  formatClock,
  formatDuration,
  formatTimestamp,
  remainingSeconds,
  STUDY_LENGTHS,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "@/lib/study";
import { PetStatus } from "./pet-status";

export function StudyPanel({
  activeSession,
  scores,
  recordedSessions,
  studyError,
  closeBlocked,
  closeBlockedError,
  pets,
  petName,
  petLevel,
  petXp,
  petNote,
  downloadUrl,
  extras,
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
  extras?: ReactNode;
}) {
  const signature = [
    activeSession?.id ?? "",
    activeSession?.startedAt ?? "",
    activeSession?.plannedSeconds ?? "",
    activeSession?.useDesktopPet ? "pet" : "web",
    scores.map((score) => score.id).join(","),
    recordedSessions.map((session) => `${session.id}:${session.durationSeconds}`).join(","),
    pets.map((pet) => `${pet.id}:${pet.xp}:${pet.is_desktop_active}`).join(","),
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
  const [chosenSeconds, setChosenSeconds] = useState(DEFAULT_STUDY_SECONDS);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackerChoice, setTrackerChoice] = useState<boolean | null>(null);
  const [hiddenSessionId, setHiddenSessionId] = useState("");
  const [railOpen, setRailOpen] = useState(Boolean(activeSession) && !activeSession?.useDesktopPet);
  const [trackedSession, setTrackedSession] = useState(activeSession?.id ?? "");
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [devRejected, setDevRejected] = useState(false);
  const [rushed, setRushed] = useState(false);

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
    if (sessionId && !shownSession?.useDesktopPet) setRailOpen(true);
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
    const result = await completeStudyTimer(shownSession.id, devPasswordValue);
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
    setTrackerOpen(true);
  }

  function onCloseTracker() {
    if (pending) return;
    setTrackerOpen(false);
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

  function onDevUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!devTimerPasswordMatches(devPassword)) {
      setDevRejected(true);
      setDevUnlocked(false);
      return;
    }
    setDevRejected(false);
    setDevUnlocked(true);
  }

  async function onDevFinish() {
    if (pending || !shownSession) return;
    setRushed(true);
    await finishSession(DEV_TIMER_PASSWORD);
  }

  const levelLabel = petLevel === null ? "No level yet" : `Level ${petLevel}`;
  const equipped = equippedPet(pets);
  const selectedSeconds = shownSession?.plannedSeconds ?? chosenSeconds;

  return (
    <main className={railOpen ? "desk" : "desk is-rail-closed"}>
      <section className="scene" aria-label="Study scene">
        <div className="scene-top">
          <span className={shownSession ? "status" : "status is-off"} aria-hidden="true" />
          <p className="scene-note">
            {shownSession ? "one little step at a time ✦" : "a quiet place to begin ✦"}
          </p>
        </div>
        <div className="scene-foot">
          <div>
            <p className="pet-name">{petName}</p>
            <p className="level-label">{levelLabel}</p>
            <p className="growth-label">{petNote}</p>
            <div
              className="xp-track"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={petXp}
              aria-label={`${petName} experience`}
            >
              <span className="xp-fill" style={{ width: `${petXp}%` }} />
            </div>
            <p className="growth-label">{petXp}/100</p>
            {shownSession?.useDesktopPet ? (
              <div className="study-active">
                <p>
                  Started <time dateTime={shownSession.startedAt}>{formatTimestamp(shownSession.startedAt)}</time>
                </p>
                <p>{formatClock(shownSession.plannedSeconds)} chosen</p>
                {launchUrl ? (
                  <>
                    <p>Launch the pet, then open this link or paste the code. It expires in 5 minutes.</p>
                    <a className="launch-link" href={launchUrl}>
                      {launchUrl}
                    </a>
                    <p className="launch-code">{visibleCode}</p>
                  </>
                ) : (
                  <p>The launch code was shown when this session started.</p>
                )}
              </div>
            ) : shownSession ? (
              <StudyClock
                session={shownSession}
                rushed={rushed}
                onFinished={() => finishSession("")}
              />
            ) : null}
            <div className="length-choices" role="group" aria-label="Study length">
              {STUDY_LENGTHS.map((length) => (
                <button
                  key={length.seconds}
                  type="button"
                  className={
                    selectedSeconds === length.seconds ? "button button-small" : "button button-small button-ghost"
                  }
                  aria-pressed={selectedSeconds === length.seconds}
                  disabled={pending || Boolean(shownSession)}
                  onClick={() => setChosenSeconds(length.seconds)}
                >
                  {length.minutes} min
                </button>
              ))}
            </div>
            {pets.length > 0 ? (
              <ul className="desk-pets">
                {pets.map((pet) => {
                  const copy = describePet(pet.pet_type);
                  const progress = experienceProgress(pet.xp);
                  return (
                    <li key={pet.id} className={pet.is_desktop_active ? "desk-pet is-equipped" : "desk-pet"}>
                      <p>
                        {copy.name}
                        {pet.is_desktop_active ? " · Equipped" : ""}
                      </p>
                      <p className="level-label">Level {progress.level}</p>
                      <div
                        className="xp-track"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.intoLevel}
                        aria-label={`${copy.name} experience`}
                      >
                        <span className="xp-fill" style={{ width: `${progress.intoLevel}%` }} />
                      </div>
                      <p className="growth-label">{progress.intoLevel}/100</p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
            <div className="scene-actions">
            {shownSession ? (
              <button type="button" className="button" onClick={() => setRailOpen(true)}>
                Visit your pet ↗
              </button>
            ) : (
              <button type="button" className="button" disabled={pending} onClick={onAskTracker}>
                Start studying →
              </button>
            )}
          </div>
        </div>
      </section>
      <button
        type="button"
        className="level-bar"
        aria-expanded={railOpen}
        aria-controls="study-rail"
        aria-label={railOpen ? "Hide study notes" : "Show study notes"}
        onClick={() => setRailOpen((open) => !open)}
      >
        <span className="level-bar-track" aria-hidden="true">
          <span className="vertical-fill" style={{ flexBasis: `${petXp}%` }} />
        </span>
        <span className="bar-level">{petLevel === null ? "—" : `L${petLevel}`}</span>
      </button>
      <aside id="study-rail" className="study-rail" aria-label="Study" hidden={!railOpen}>
        <div className="rail-heading">
          <div>
            <p className="panel-kicker">Study · {levelLabel}</p>
            <h2 className="panel-name">{petName}</h2>
          </div>
          <button type="button" className="close-panel" onClick={() => setRailOpen(false)}>
            Close
          </button>
        </div>
        <p className="panel-desc">
          {shownSession ? "Your focus helps me grow." : "A quiet place to begin."}
        </p>
        <p className="panel-hint">
          {shownSession?.useDesktopPet
            ? closeBlocked
              ? "The desktop pet tracks this session. It comes forward and closes a blocklist window after one minute."
              : "The desktop pet tracks this session. Closing blocklist windows is off."
            : shownSession
              ? "The website timer tracks this session."
              : "Choose a length, then start. The next window asks which timer to use."}
        </p>
        <p className="panel-hint">
          {equipped ? `${describePet(equipped.pet_type).name} is equipped.` : "No pet is equipped."}
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dev-finish">
          <button type="button" className="button button-small button-ghost" onClick={() => setDevOpen(true)}>
            Dev
          </button>
          {devOpen && !devUnlocked ? (
            <form onSubmit={onDevUnlock}>
              <label className="field">
                Password
                <input
                  type="password"
                  value={devPassword}
                  autoComplete="off"
                  onChange={(event) => setDevPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="button button-small">
                Unlock
              </button>
              {devRejected ? (
                <p className="form-error" role="alert">
                  That password does not match.
                </p>
              ) : null}
            </form>
          ) : null}
          {devUnlocked ? (
            <button
              type="button"
              className="button button-small"
              disabled={pending || !shownSession || shownSession.useDesktopPet}
              onClick={onDevFinish}
            >
              Finish now
            </button>
          ) : null}
        </div>
        {shownSession?.useDesktopPet ? <PetStatus downloadUrl={downloadUrl} /> : null}
        <div className="score-history">
          <h3>Sessions</h3>
          {recordedSessions.length === 0 ? (
            <p className="empty-pets">No study time recorded yet.</p>
          ) : (
            <ul className="score-list">
              {recordedSessions.map((session) => (
                <li key={session.id}>
                  <span>{session.status === "cancelled" ? "Cancelled" : "Finished"}</span>
                  <span>{formatDuration(session.durationSeconds)}</span>
                  {session.endedAt ? (
                    <time dateTime={session.endedAt}>{formatTimestamp(session.endedAt)}</time>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="score-history">
          <h3>Experience</h3>
          {scores.length === 0 ? (
            <p className="empty-pets">No experience recorded yet.</p>
          ) : (
            <ul className="score-list">
              {scores.map((score) => (
                <li key={score.id}>
                  <strong>{score.xp} XP</strong>
                  <span>{score.distracted ? "Distracted" : "Focused"}</span>
                  <span>{formatDuration(score.durationSeconds)}</span>
                  <span>{score.blockedHosts.length > 0 ? score.blockedHosts.join(", ") : "No blocked sites"}</span>
                  <time dateTime={score.createdAt}>{formatTimestamp(score.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
        {extras}
      </aside>
      {trackerOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseTracker}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="tracker-title">How should this session be tracked?</h2>
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
    </main>
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
