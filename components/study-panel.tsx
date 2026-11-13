"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { completeStudyTimer, endStudyEarly, setCloseBlocked, startStudySession } from "@/lib/actions/study";
import { describePet, equippedPet, type PetCard } from "@/lib/pets";
import {
  buildPetLaunchUrl,
  DEFAULT_STUDY_SECONDS,
  MAX_STUDY_MINUTES,
  MIN_STUDY_MINUTES,
  plannedStudySeconds,
  DEV_TIMER_PASSWORD,
  devTimerPasswordMatches,
  formatClock,
  formatDuration,
  formatTimestamp,
  experienceForEarlyEnd,
  experienceForSession,
  remainingSeconds,
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
  petName,
  petLevel,
  petXp,
  petNote,
  downloadUrl,
  placedIds,
  placementReady,
  preferredSessionMinutes,
  onOpenInventory,
  onEquipped,
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
  onOpenInventory: () => void;
  onEquipped?: (petId: string) => void;
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
  const [chosenSeconds, setChosenSeconds] = useState(() =>
    preferredStudySeconds(preferredSessionMinutes),
  );
  const preferredSeconds = preferredStudySeconds(preferredSessionMinutes);
  const [preferredSnap, setPreferredSnap] = useState(preferredSeconds);
  if (preferredSeconds !== preferredSnap) {
    setPreferredSnap(preferredSeconds);
    setChosenSeconds(preferredSeconds);
    setCustomOpen(false);
    setCustomMinutes("");
  }
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
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
  const [history, setHistory] = useState<"sessions" | "experience" | "download" | "dev-info" | null>(null);

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

  const levelLabel = petLevel === null ? "No level yet" : `Level ${petLevel}`;
  const lengthSeconds = selectedLengthSeconds();
  const equipped = equippedPet(pets);
  const detailPet = detailPetId ? pets.find((pet) => pet.id === detailPetId) ?? null : null;

  return (
    <main className={railOpen ? "desk" : "desk is-rail-closed"}>
      <section className="scene" aria-label="Study scene">
        <LivingRoom
          pets={pets}
          placedIds={placedIds}
          placementReady={placementReady}
          onOpenPet={setDetailPetId}
          onOpenInventory={onOpenInventory}
        />
        <div className="below-room">
          <div>
            <p className="pet-name">{shownSession ? "Studying with you" : "Ready for a little focus?"}</p>
            <p className="growth-label">
              {shownSession
                ? shownSession.useDesktopPet
                  ? "Desktop pet is tracking this session."
                  : "Website timer is tracking this session."
                : "Choose the duration and tracker in two steps."}
            </p>
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
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="scene-actions">
            {shownSession ? (
              <button type="button" className="button button-ghost" disabled={pending} onClick={onOpenEarly}>
                End session early
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
        aria-label={railOpen ? "Hide personalization" : "Show personalization"}
        onClick={() => setRailOpen((open) => !open)}
      >
        <span className="level-bar-gear" aria-hidden="true">
          ⚙ {railOpen ? "›" : "‹"}
        </span>
        <span className="level-bar-track" aria-hidden="true">
          <span className="vertical-fill" style={{ flexBasis: `${petXp}%` }} />
        </span>
        <span className="bar-level">{petLevel === null ? "—" : `L${petLevel}`}</span>
      </button>
      <aside id="study-rail" className="study-rail" aria-label="Personalization" hidden={!railOpen}>
        <div className="rail-heading">
          <div>
            <p className="panel-kicker">Personalization</p>
            <h2 className="panel-name">{petName}</h2>
          </div>
          <button type="button" className="close-panel" onClick={() => setRailOpen(false)}>
            Close
          </button>
        </div>
        <p className="panel-desc">{levelLabel}</p>
        <p className="panel-hint">{petNote}</p>
        <p className="panel-hint">
          {equipped ? `${describePet(equipped.pet_type).name} is equipped.` : "No pet is equipped."}
        </p>
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
        <div className="personalization-actions">
          <button type="button" className="button button-ghost" onClick={() => setHistory("dev-info")}>
            Dev tools
          </button>
          <button type="button" className="button button-ghost" onClick={() => setHistory("download")}>
            Download the Mac pet
          </button>
          <button type="button" className="button button-ghost" onClick={() => setHistory("sessions")}>
            Sessions
          </button>
          <button type="button" className="button button-ghost" onClick={() => setHistory("experience")}>
            Experience
          </button>
        </div>
      </aside>
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
                A full finish is {experienceForSession(lengthSeconds, false)} XP. Ending early is{" "}
                {experienceForEarlyEnd(lengthSeconds, false)} XP.
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
          sessionActive={Boolean(shownSession)}
          onClose={() => setDetailPetId(null)}
          onEquipped={onEquipped}
        />
      ) : null}
      {history === "sessions" ? (
        <HistoryDialog title="Sessions" onClose={() => setHistory(null)}>
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
        </HistoryDialog>
      ) : null}
      {history === "experience" ? (
        <HistoryDialog title="Experience" onClose={() => setHistory(null)}>
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
        </HistoryDialog>
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
