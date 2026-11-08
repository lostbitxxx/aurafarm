"use client";

import { useState } from "react";
import { cancelStudySession, setCloseBlocked, startStudySession } from "@/lib/actions/study";
import {
  buildPetLaunchUrl,
  formatDuration,
  formatTimestamp,
  type ActiveStudySession,
  type BlocklistEntry,
  type StudyScoreCard,
} from "@/lib/study";

export function StudyPanel({
  blocklist,
  activeSession,
  scores,
  studyError,
  closeBlocked,
  closeBlockedError,
}: {
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  studyError: string | null;
  closeBlocked: boolean;
  closeBlockedError: string | null;
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

  return (
    <section className="study-panel" aria-label="Study">
      <div className="inventory-heading">
        <h2>Study</h2>
        <p>
          {closeBlocked
            ? "These sites close after 8 seconds in front during a session."
            : "The pet watches these sites during a session. Turning this on closes the front tab."}
        </p>
      </div>
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
          <button
            type="button"
            className="button button-ghost"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel session
          </button>
        </div>
      ) : (
        <button type="button" className="button" disabled={pending} onClick={onStart}>
          Start study session
        </button>
      )}
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
    </section>
  );
}
