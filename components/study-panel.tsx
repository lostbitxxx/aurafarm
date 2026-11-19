"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { completeStudyTimer, endStudyEarly, startStudySession } from "@/lib/actions/study";
import { CYLINDER_TICK_MS } from "@/lib/daily-cylinder";
import {
  filterSessionsAfterCylinderReset,
  liveSessionCountsAfterCylinderReset,
  readCylinderReset,
  subscribeCylinderReset,
} from "@/lib/cylinder-reset";
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
  formatTimestamp,
  experienceForSession,
  farmerLocalDay,
  focusedSeconds,
  sessionCountsForStreak,
  studySecondsOnLocalDay,
  subscribeFarmerLocalDay,
  STUDY_LENGTHS,
  type ActiveStudySession,
  type RecordedStudySession,
  type StudyScoreCard,
} from "@/lib/study";
import { StudyClock } from "./study-clock";
import { LivingRoom } from "./living-room";
import { PetDetailDialog } from "./pet-detail-dialog";
import { TrackerDemo } from "./study-tracker-demo";

export type DevFinishApi = {
  canFinish: boolean;
  finish: (password: string) => Promise<{ error: string }>;
};

function preferredStudySeconds(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < MIN_STUDY_MINUTES) {
    return DEFAULT_STUDY_SECONDS;
  }
  const capped = Math.min(MAX_STUDY_MINUTES, Math.floor(minutes));
  return capped * 60;
}

export function StudyPanel({
  userId,
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
  planSessions = [],
  isStudyDay = true,
  showDailyCylinder = false,
  streakBoostActive = false,
  streakQualifiedToday = false,
  ownedColorIds,
  ownedHatIds,
  ownedClothesIds,
  renameCoupons = 0,
  showPetNames = true,
  onOpenInventory,
  onOpenSong,
  onOpenAchievements,
  onOpenCollection,
  onOpenSocial,
  onEquipped,
  onColorApplied,
  onHatApplied,
  onClothesApplied,
  onPetRenamed,
  onShowPetNamesChange,
  deskRefreshing = false,
  tutorialCurrent = false,
  tutorialTarget = null,
  onTutorialStart,
  onRegisterDevFinish,
}: {
  userId: string;
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
  planSessions?: readonly {
    status: "submitted" | "cancelled";
    endedAt: string;
    durationSeconds?: number;
  }[];
  isStudyDay?: boolean;
  showDailyCylinder?: boolean;
  streakBoostActive?: boolean;
  streakQualifiedToday?: boolean;
  ownedColorIds: readonly string[];
  ownedHatIds: readonly string[];
  ownedClothesIds: readonly string[];
  renameCoupons?: number;
  showPetNames?: boolean;
  onOpenInventory: () => void;
  onOpenSong?: () => void;
  onOpenAchievements?: () => void;
  onOpenCollection?: () => void;
  onOpenSocial?: () => void;
  onEquipped?: (petId: string) => void;
  onColorApplied: (petId: string, colorId: string) => void;
  onHatApplied: (petId: string, hatId: string | null) => void;
  onClothesApplied: (petId: string, clothesId: string | null) => void;
  onPetRenamed?: (petId: string, name: string) => void;
  onShowPetNamesChange?: (enabled: boolean) => void;
  deskRefreshing?: boolean;
  tutorialCurrent?: boolean;
  tutorialTarget?: string | null;
  onTutorialStart?: () => void;
  onRegisterDevFinish?: (api: DevFinishApi | null) => void;
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
  const [startOpen, setStartOpen] = useState(false);
  const [trackerChoice, setTrackerChoice] = useState(true);
  const [desktopLink, setDesktopLink] = useState("");
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
    setDesktopLink("");
    setError(null);
    setStartOpen(true);
  }

  function onCloseStart() {
    if (pending) return;
    setStartOpen(false);
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

  async function onConfirmTracker() {
    const seconds = selectedLengthSeconds();
    if (pending || seconds === null || desktopLink) return;
    setPending(true);
    setError(null);
    const result = await startStudySession(seconds, trackerChoice);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setChosenSeconds(seconds);
    setRushed(false);
    setLaunchCode(result.launchCode);
    setCodeSessionId(result.sessionId);
    setLocalStartedAt(new Date().toISOString());
    setLocalPlanned(seconds);
    setLocalDesktop(trackerChoice);
    if (trackerChoice) {
      setDesktopLink(buildPetLaunchUrl(result.launchCode));
      return;
    }
    setStartOpen(false);
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

  async function runDevFinish(password: string) {
    if (pending || !shownSession || shownSession.useDesktopPet) {
      return { error: "Start a website timer session first." };
    }
    if (!devTimerPasswordMatches(password)) {
      return { error: "That password does not match." };
    }
    setRushed(true);
    const result = await finishSession(DEV_TIMER_PASSWORD);
    if (!result.error) {
      setDevPassword("");
      setDevOpen(false);
    }
    return result;
  }

  const canDevFinish = Boolean(shownSession && !shownSession.useDesktopPet);
  const finishDevRef = useRef(runDevFinish);
  finishDevRef.current = runDevFinish;

  useEffect(() => {
    if (!onRegisterDevFinish) return;
    onRegisterDevFinish({
      canFinish: canDevFinish,
      finish: (password) => finishDevRef.current(password),
    });
  }, [onRegisterDevFinish, canDevFinish]);

  useEffect(() => {
    return () => onRegisterDevFinish?.(null);
  }, [onRegisterDevFinish]);

  async function onDevFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !shownSession || shownSession.useDesktopPet) return;
    if (!devTimerPasswordMatches(devPassword)) {
      setDevRejected(true);
      return;
    }
    setDevRejected(false);
    const result = await runDevFinish(devPassword);
    if (result.error) setError(result.error);
  }

  const lengthSeconds = selectedLengthSeconds();
  const detailPet = detailPetId ? pets.find((pet) => pet.id === detailPetId) ?? null : null;
  const todayLocal = useSyncExternalStore(subscribeFarmerLocalDay, farmerLocalDay, () => "1970-01-01");
  const cylinderReset = useSyncExternalStore(
    subscribeCylinderReset,
    () => readCylinderReset(userId),
    () => null,
  );
  const [cylinderNow, setCylinderNow] = useState<number | null>(null);
  useEffect(() => {
    if (!shownSession) {
      setCylinderNow(null);
      return;
    }
    const tick = () => setCylinderNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, CYLINDER_TICK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [shownSession?.id, shownSession?.startedAt, shownSession?.plannedSeconds]);

  const countedSessions = filterSessionsAfterCylinderReset(planSessions, cylinderReset, todayLocal);
  const submittedTodaySeconds = studySecondsOnLocalDay(countedSessions, todayLocal);
  const liveCounts =
    shownSession != null && liveSessionCountsAfterCylinderReset(shownSession.startedAt, cylinderReset, todayLocal);
  const liveSessionSeconds =
    liveCounts && shownSession && cylinderNow != null
      ? focusedSeconds(new Date(shownSession.startedAt).getTime(), cylinderNow, shownSession.plannedSeconds)
      : 0;
  const dailyStudiedMinutes = Math.floor((submittedTodaySeconds + liveSessionSeconds) / 60);
  const dailyGoalMinutes =
    showDailyCylinder && preferredSessionMinutes != null && preferredSessionMinutes > 0
      ? preferredSessionMinutes
      : null;

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
          showPetNames={showPetNames}
          onOpenPet={setDetailPetId}
          onOpenInventory={onOpenInventory}
          onOpenSong={onOpenSong}
          onOpenAchievements={onOpenAchievements}
          onOpenCollection={onOpenCollection}
          onOpenSocial={onOpenSocial}
          tutorialTarget={tutorialTarget}
          dailyStudiedMinutes={dailyGoalMinutes != null ? dailyStudiedMinutes : null}
          dailyGoalMinutes={dailyGoalMinutes}
          isStudyDay={isStudyDay}
          headerAction={
            shownSession ? null : (
              <div className="room-head-action">
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
            )
          }
        />
        {shownSession || checkingSession || error ? (
          <div className="below-room">
            <div className="session-copy">
              {shownSession || checkingSession ? (
                <>
                  <div className={shownSession && !checkingSession ? "session-title-row" : undefined}>
                    <p className="pet-name">
                      {checkingSession ? "Checking this session" : "Studying with you"}
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
                      : shownSession?.useDesktopPet
                        ? "Desktop pet is tracking this session."
                        : "Website timer is tracking this session."}
                  </p>
                  {checkingSession ? (
                    <SessionRefreshStatus />
                  ) : shownSession?.useDesktopPet ? (
                    <div className="study-active">
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
                </>
              ) : null}
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            {shownSession?.useDesktopPet && launchUrl ? (
              <div className="scene-actions is-start">
                <a className="button button-start" href={launchUrl}>
                  Open Aurafarm
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {startOpen ? (
        <div className="tracker-pop" role="presentation" onClick={onCloseStart}>
          <div
            className="tracker-card tracker-card-start"
            role="dialog"
            aria-modal="true"
            aria-labelledby="length-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="length-title">How long will you study?</h2>
              <button type="button" className="dialog-close" onClick={onCloseStart} aria-label="Close dialog">
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
                  disabled={pending || Boolean(desktopLink)}
                  onClick={() => onChoosePreset(length.seconds)}
                >
                  {length.minutes} min
                </button>
              ))}
              <button
                type="button"
                className={customOpen ? "button" : "button button-ghost"}
                aria-pressed={customOpen}
                disabled={pending || Boolean(desktopLink)}
                onClick={onChooseCustom}
              >
                Custom
              </button>
              {customOpen ? (
                <input
                  className="length-type"
                  type="number"
                  inputMode="numeric"
                  min={MIN_STUDY_MINUTES}
                  max={MAX_STUDY_MINUTES}
                  step={1}
                  value={customMinutes}
                  placeholder="type here"
                  aria-label="Custom minutes"
                  disabled={pending || Boolean(desktopLink)}
                  onChange={(event) => onCustomMinutes(event.target.value)}
                />
              ) : null}
            </div>
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
            <div className="tracker-cards" role="group" aria-label="Session tracker">
              <div className={trackerChoice ? "tracker-option is-selected" : "tracker-option"}>
                <button
                  type="button"
                  className="tracker-option-pick"
                  aria-pressed={trackerChoice}
                  disabled={pending || Boolean(desktopLink)}
                  onClick={() => setTrackerChoice(true)}
                >
                  <span className="tracker-option-name">Desktop pet</span>
                  <TrackerDemo kind="desktop" />
                  <span className="tracker-option-copy">
                    The pet stays in the corner, closes a distracting tab, and brings you back for the reward.
                  </span>
                </button>
                {downloadUrl ? (
                  <a className="tracker-download" href={downloadUrl}>
                    First time aurafarming? Download here!
                  </a>
                ) : (
                  <p className="tracker-download">First time aurafarming? The Mac pet is not published yet.</p>
                )}
              </div>
              <div className={!trackerChoice ? "tracker-option is-selected" : "tracker-option"}>
                <button
                  type="button"
                  className="tracker-option-pick"
                  aria-pressed={!trackerChoice}
                  disabled={pending || Boolean(desktopLink)}
                  onClick={() => setTrackerChoice(false)}
                >
                  <span className="tracker-option-name">Website timer</span>
                  <TrackerDemo kind="website" />
                  <span className="tracker-option-copy">
                    The countdown stays beside your PDF, then the site comes back with the reward.
                  </span>
                </button>
              </div>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="tracker-actions start-actions">
              <button type="button" className="button button-ghost" disabled={pending} onClick={onCloseStart}>
                Cancel
              </button>
              {desktopLink ? (
                <a className="button button-farm" href={desktopLink}>
                  Open Aurafarm
                </a>
              ) : (
                <button
                  type="button"
                  className="button button-farm"
                  disabled={pending || lengthSeconds === null}
                  onClick={() => void onConfirmTracker()}
                >
                  FARM AURA
                </button>
              )}
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
          renameCoupons={renameCoupons}
          showPetNames={showPetNames}
          sessionActive={Boolean(shownSession)}
          onClose={() => setDetailPetId(null)}
          onEquipped={onEquipped}
          onColorApplied={onColorApplied}
          onHatApplied={onHatApplied}
          onClothesApplied={onClothesApplied}
          onPetRenamed={onPetRenamed}
          onShowPetNamesChange={onShowPetNamesChange}
        />
      ) : null}
    </main>
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

