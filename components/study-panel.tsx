"use client";

import { useState } from "react";
import { cancelStudySession, startStudySession } from "@/lib/actions/study";
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
}: {
  blocklist: BlocklistEntry[];
  activeSession: ActiveStudySession | null;
  scores: StudyScoreCard[];
  studyError: string | null;
}) {
  const signature = [
    activeSession?.id ?? "",
    activeSession?.startedAt ?? "",
    scores.map((score) => score.id).join(","),
    blocklist.map((entry) => entry.host).join(","),
    studyError ?? "",
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
    (codeSessionId && localStartedAt ? { id: codeSessionId, startedAt: localStartedAt } : null);
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
    setHiddenSessionId(shownSession.id);
  }

  return (
    <section className="study-panel" aria-label="Study">
      <div className="inventory-heading">
        <h2>Study</h2>
        <p>These sites close while a session is running.</p>
      </div>
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
              <p>The desktop pet will open this link later. The code expires in 5 minutes.</p>
              <a className="launch-link" href={launchUrl}>
                {launchUrl}
              </a>
              <p className="launch-code">{visibleCode}</p>
            </>
          ) : (
            <p>
              The launch code was shown when this session started. Cancel and start again if the
              desktop pet still needs it.
            </p>
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
