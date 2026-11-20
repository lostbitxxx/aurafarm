"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  formatClock,
  formatDuration,
  experienceForSession,
  farmerLocalDay,
  remainingSeconds,
  sessionCountsForStreak,
  STUDY_LENGTHS,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "@/lib/study";
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
  petLevel: _petLevel,
  petXp: _petXp,
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
  deskRefreshing = false,
  tutorialCurrent = false,
  onTutorialStart,
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
  deskRefreshing?: boolean;
  tutorialCurrent?: boolean;
  onTutorialStart?: () => void;
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
  const [desktopStep, setDesktopStep] = useState<0 | 1 | 2>(0);
  const [hiddenSessionId, setHiddenSessionId] = useState("");
  const [trackedSession, setTrackedSession] = useState(activeSession?.id ?? "");
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [earlyOpen, setEarlyOpen] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devRejected, setDevRejected] = useState(false);
  const [rushed, setRushed] = useState(false);
  const [detailPetId, setDetailPetId] = useState<string | null>(null);

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
    setDesktopStep(0);
    setTrackerOpen(true);
  }

  function onCloseTracker() {
    if (pending) return;
    setDesktopStep(0);
    setTrackerOpen(false);
    setLengthOpen(true);
  }

  function onBackTracker() {
    if (pending) return;
    if (desktopStep === 2) {
      setDesktopStep(1);
      return;
    }
    if (desktopStep === 1) {
      setDesktopStep(0);
      return;
    }
    onCloseTracker();
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
  const desktopPetSession = shownSession?.useDesktopPet === true;
  const router = useRouter();
  const [sessionRefreshing, startSessionRefresh] = useTransition();
  const checkingSession = desktopPetSession && (sessionRefreshing || deskRefreshing);

  useEffect(() => {
    if (!desktopPetSession) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      startSessionRefresh(() => {
        router.refresh();
      });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [desktopPetSession, router]);

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
            <div className={shownSession && !checkingSession ? "session-title-row" : undefined}>
              <p className="pet-name">
                {checkingSession ? "Checking this session" : shownSession ? "Studying with you" : "Ready for a little focus?"}
              </p>
              {shownSession && !checkingSession ? (
                <button type="button" className="button button-ghost button-end-early" disabled={pending} onClick={onOpenEarly}>
                  End session early
                </button>
              ) : null}
            </div>
            <p className="growth-label">
              {checkingSession
                ? "Fetching the desk."
                : shownSession
                  ? shownSession.useDesktopPet
                    ? "Desktop pet is tracking this session."
                    : "Website timer is tracking this session."
                  : "Choose the duration and tracker in two steps."}
            </p>
            {checkingSession ? (
              <SessionRefreshStatus />
            ) : shownSession ? (
              <>
                {shownSession.useDesktopPet ? (
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
                  </div>
                ) : null}
                <StudyClock
                  session={shownSession}
                  rushed={rushed}
                  onFinished={shownSession.useDesktopPet ? null : () => finishSession("")}
                />
              </>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          {shownSession ? null : (
            <div className="scene-actions is-start">
              <button
                type="button"
                className="button button-start"
                data-tutorial="start"
                data-tutorial-current={tutorialCurrent ? "true" : undefined}
                disabled={pending}
                onClick={() => {
                  onTutorialStart?.();
                  onAskTracker();
                }}
              >
                Start studying →
              </button>
            </div>
          )}
        </div>
      </section>
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
              <h2 id="tracker-title">
                {desktopStep === 2
                  ? "Close blocked tabs?"
                  : desktopStep === 1
                    ? "Desktop pet"
                    : "How should this session be tracked?"}
              </h2>
              <button type="button" className="dialog-close" onClick={onCloseTracker} aria-label="Close dialog">
                ×
              </button>
            </div>
            {desktopStep === 0 ? <p>The session starts when you confirm.</p> : null}
            {desktopStep === 1 ? (
              <ol className="pet-setup-steps">
                <li>
                  <p>If you haven't downloaded our desktop application, please download it here.</p>
                  <PetStatus downloadUrl={downloadUrl} showHeading={false} />
                </li>
                <li>
                  <p>After downloading, unzip it, then open your Terminal and run this command:</p>
                  <div className="pet-open-command-row">
                    <p className="pet-open-command">xattr -cr ~/Downloads/Aurafarm.app</p>
                    <CopyButton value="xattr -cr ~/Downloads/Aurafarm.app" label="Copy Terminal command" />
                  </div>
                </li>
              </ol>
            ) : null}
            {desktopStep === 2 ? (
              <>
                <p>When on, we close tabs like YouTube and Instagram for you when you get distracted.</p>
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
              </>
            ) : null}
            {desktopStep === 0 ? (
              <>
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
                {trackerChoice === true ? <p>The desktop pet tracks the time.</p> : null}
                {trackerChoice === false ? <p>The website countdown tracks the time.</p> : null}
              </>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={onBackTracker}>
                Back
              </button>
              <button
                type="button"
                className="button"
                disabled={pending || (desktopStep === 0 && trackerChoice === null)}
                onClick={() => {
                  if (desktopStep === 0 && trackerChoice) {
                    setDesktopStep(1);
                    return;
                  }
                  if (desktopStep === 1) {
                    setDesktopStep(2);
                    return;
                  }
                  void onConfirmTracker();
                }}
              >
                {desktopStep === 2 || trackerChoice === false ? "Confirm" : "Next"}
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
    </main>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="button button-small" aria-label={label} onClick={() => void onCopy()}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopySessionCode({ code }: { code: string }) {
  return (
    <div className="launch-code-row">
      <p className="launch-code">{code}</p>
      <CopyButton value={code} label="Copy session code" />
    </div>
  );
}

function SessionRefreshStatus() {
  return (
    <p className="session-refresh" role="status">
      <span className="session-refresh-mark" aria-hidden="true" />
      Loading the desk
    </p>
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
