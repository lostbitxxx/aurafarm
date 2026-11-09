"use client";

import { useState, type ReactNode } from "react";
import { cancelStudySession, setCloseBlocked, startStudySession } from "@/lib/actions/study";
import {
  buildPetLaunchUrl,
  formatDuration,
  formatTimestamp,
  type ActiveStudySession,
  type BlocklistEntry,
  type StudyScoreCard,
} from "@/lib/study";
import { PetStatus } from "./pet-status";

export function StudyPanel({
  blocklist,
  activeSession,
  scores,
  studyError,
  closeBlocked,
  closeBlockedError,
  petName,
  petLevel,
  petNote,
  downloadUrl,
  scene,
  extras,
}: {
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
  petName: string;
  petLevel: number | null;
  petNote: string;
  downloadUrl: string | null;
  scene: ReactNode;
  extras?: ReactNode;
}) {
  const signature = [
    activeSession?.id ?? "",
    activeSession?.startedAt ?? "",
    scores.map((score) => score.id).join(","),
    blocklist.map((entry) => entry.host).join(","),
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
  const [hiddenSessionId, setHiddenSessionId] = useState("");
  const [railOpen, setRailOpen] = useState(Boolean(activeSession));
  const [trackedSession, setTrackedSession] = useState(activeSession?.id ?? "");
  const [trackedError, setTrackedError] = useState<string | null>(null);

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
    }
  }

  const serverSession = activeSession && activeSession.id !== hiddenSessionId ? activeSession : null;
  const shownSession =
    serverSession ??
    (codeSessionId && localStartedAt && codeSessionId !== hiddenSessionId
      ? { id: codeSessionId, startedAt: localStartedAt }
      : null);
  const visibleCode = shownSession && codeSessionId === shownSession.id ? launchCode : "";
  const launchUrl = visibleCode ? buildPetLaunchUrl(visibleCode) : "";
  const sessionId = shownSession?.id ?? "";

  if (sessionId !== trackedSession) {
    setTrackedSession(sessionId);
    if (sessionId) setRailOpen(true);
  }

  const railError = error ?? closeBlockedError;
  if (railError !== trackedError) {
    setTrackedError(railError);
    if (railError) setRailOpen(true);
  }

  async function onStart() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await startStudySession();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLaunchCode(result.launchCode);
    setCodeSessionId(result.sessionId);
    setLocalStartedAt(new Date().toISOString());
  }

  async function onCancel() {
    if (pending || !shownSession) return;
    setPending(true);
    setError(null);
    const result = await cancelStudySession(shownSession.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLaunchCode("");
    setCodeSessionId("");
    setLocalStartedAt("");
    setHiddenSessionId(shownSession.id);
  }

  async function onToggleClose() {
    if (pending || closeBlockedError) return;
    setPending(true);
    setError(null);
    const result = await setCloseBlocked(!closeBlocked);
    setPending(false);
    if (result.error) setError(result.error);
  }

  const levelLabel = petLevel === null ? "No level yet" : `Level ${petLevel}`;

  return (
    <main className={railOpen ? "desk" : "desk is-rail-closed"}>
      <section className="scene" aria-label="Study scene">
        <div className="scene-top">
          <span className={shownSession ? "status" : "status is-off"} aria-hidden="true" />
          <p className="scene-note">
            {shownSession ? "one little step at a time ✦" : "a quiet place to begin ✦"}
          </p>
        </div>
        {scene}
        <div className="scene-foot">
          <div>
            <p className="pet-name">{petName}</p>
            <p className="level-label">{levelLabel}</p>
            <p className="growth-label">{petNote}</p>
            <div className="xp-track" aria-hidden="true">
              <span className={shownSession ? "xp-fill is-running" : "xp-fill"} />
            </div>
          </div>
          <div className="scene-actions">
            {shownSession ? (
              <button type="button" className="button" onClick={() => setRailOpen(true)}>
                Visit your pet ↗
              </button>
            ) : (
              <button type="button" className="button" disabled={pending} onClick={onStart}>
                Start studying →
              </button>
            )}
            <button
              type="button"
              className="button button-ghost"
              disabled={pending || !shownSession}
              onClick={onCancel}
            >
              Cancel session
            </button>
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
          <span className={shownSession ? "vertical-fill is-running" : "vertical-fill"} />
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
          {shownSession
            ? "Open the pet with the launch link. The code expires in 5 minutes."
            : "The pet watches the list below during a session."}
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
        {blocklist.length === 0 ? (
          <p className="empty-pets">The blocklist is empty.</p>
        ) : (
          <ul className="blocklist">
            {blocklist.map((entry) => (
              <li key={entry.host}>{entry.label}</li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {shownSession ? (
          <div className="study-active">
            <p>
              Started <time dateTime={shownSession.startedAt}>{formatTimestamp(shownSession.startedAt)}</time>
            </p>
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
        ) : null}
        <PetStatus downloadUrl={downloadUrl} />
        <div className="score-history">
          <h3>Scores</h3>
          {scores.length === 0 ? (
            <p className="empty-pets">No sessions scored yet.</p>
          ) : (
            <ul className="score-list">
              {scores.map((score) => (
                <li key={score.id}>
                  <strong>{score.points}</strong>
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
    </main>
  );
}
