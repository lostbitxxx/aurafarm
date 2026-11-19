"use client";

import { useState, useSyncExternalStore } from "react";
import { startStudySession } from "@/lib/actions/study";
import {
  buildPetLaunchUrl,
  DEFAULT_STUDY_SECONDS,
  experienceForSession,
  farmerLocalDay,
  subscribeFarmerLocalDay,
  MAX_STUDY_MINUTES,
  MIN_STUDY_MINUTES,
  plannedStudySeconds,
  sessionCountsForStreak,
  STUDY_LENGTHS,
  type ActiveStudySession,
} from "@/lib/study";
import { macDesktopServerSnapshot, macDesktopSnapshot, subscribeMacDesktop } from "@/lib/mac-desktop";
import { TrackerDemo } from "./study-tracker-demo";

function preferredStudySeconds(minutes: number | null) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < MIN_STUDY_MINUTES) {
    return DEFAULT_STUDY_SECONDS;
  }
  return Math.min(MAX_STUDY_MINUTES, Math.floor(minutes)) * 60;
}

export function CrewStudyStart({
  downloadUrl,
  preferredSessionMinutes,
  streakCount,
  streakLocalDate,
  onStarted,
}: {
  downloadUrl: string | null;
  preferredSessionMinutes: number | null;
  streakCount: number;
  streakLocalDate: string | null;
  onStarted: (session: ActiveStudySession, launchUrl: string) => void;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackerChoice, setTrackerChoice] = useState(true);
  const macDesktop = useSyncExternalStore(subscribeMacDesktop, macDesktopSnapshot, macDesktopServerSnapshot);
  const useDesktopPet = macDesktop === true && trackerChoice;
  const [chosenSeconds, setChosenSeconds] = useState(() => preferredStudySeconds(preferredSessionMinutes));
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [desktopLink, setDesktopLink] = useState("");

  const lengthSeconds = customOpen ? plannedStudySeconds(Number(customMinutes) * 60) : plannedStudySeconds(chosenSeconds);
  const todayLocal = useSyncExternalStore(subscribeFarmerLocalDay, farmerLocalDay, () => "1970-01-01");
  const streakBoostActive = streakCount > 0;
  const streakQualifiedToday = streakLocalDate === todayLocal && streakBoostActive;

  function onChoosePreset(seconds: number) {
    setCustomOpen(false);
    setCustomMinutes("");
    setChosenSeconds(seconds);
  }

  async function onConfirm() {
    const seconds = lengthSeconds;
    if (pending || seconds === null || desktopLink) return;
    setPending(true);
    setError(null);
    const result = await startStudySession(seconds, useDesktopPet);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const launchUrl = useDesktopPet ? buildPetLaunchUrl(result.launchCode) : "";
    onStarted(
      {
        id: result.sessionId,
        startedAt: new Date().toISOString(),
        plannedSeconds: seconds,
        useDesktopPet,
      },
      launchUrl,
    );
    if (useDesktopPet) {
      setDesktopLink(launchUrl);
      return;
    }
    setStartOpen(false);
  }

  return (
    <>
      <div className="below-room crew-start">
        <div className="session-copy">
          <p className="pet-name">Ready for a little focus?</p>
          <p className="growth-label">Pick a length and a tracker, then Farm Aura.</p>
        </div>
        <div className="scene-actions is-start">
          {desktopLink ? (
            <a className="button button-start" href={desktopLink}>
              Open Aurafarm
            </a>
          ) : (
            <button type="button" className="button button-start" disabled={pending} onClick={() => setStartOpen(true)}>
              Start studying →
            </button>
          )}
        </div>
      </div>
      {startOpen ? (
        <div className="tracker-pop" role="presentation" onClick={() => (pending ? null : setStartOpen(false))}>
          <div
            className="tracker-card tracker-card-start"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crew-length-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="crew-length-title">How long will you study?</h2>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setStartOpen(false)}
                aria-label="Close dialog"
                disabled={pending}
              >
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
                onClick={() => {
                  setCustomOpen(true);
                  setCustomMinutes("");
                }}
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
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomMinutes(value);
                    const seconds = plannedStudySeconds(Number(value) * 60);
                    if (seconds !== null) setChosenSeconds(seconds);
                  }}
                />
              ) : null}
            </div>
            {lengthSeconds === null ? (
              <p>
                Use {MIN_STUDY_MINUTES} to {MAX_STUDY_MINUTES} whole minutes.
              </p>
            ) : (
              <p>
                A full finish is{" "}
                {experienceForSession(lengthSeconds, false, streakBoostActive && sessionCountsForStreak(lengthSeconds))} XP
                {streakBoostActive && sessionCountsForStreak(lengthSeconds) ? " with streak boost" : ""}. Ending early
                does not count for the streak
                {!sessionCountsForStreak(lengthSeconds)
                  ? ". Custom sessions need at least 5 minutes to count for the streak"
                  : streakQualifiedToday
                    ? ". Today already counts"
                    : ""}
                .
              </p>
            )}
            <div className="tracker-cards" role="group" aria-label="Session tracker">
              <div className={useDesktopPet ? "tracker-option is-selected" : "tracker-option"}>
                <button
                  type="button"
                  className="tracker-option-pick"
                  aria-pressed={useDesktopPet}
                  disabled={pending || Boolean(desktopLink) || macDesktop !== true}
                  onClick={() => {
                    if (macDesktop === true) setTrackerChoice(true);
                  }}
                >
                  <span className="tracker-option-name">Desktop pet</span>
                  <span
                    className={
                      macDesktop === true
                        ? "tracker-choice-note tracker-mac-note"
                        : macDesktop === false
                          ? "tracker-choice-note tracker-unsupported-note"
                          : "tracker-choice-note"
                    }
                  >
                    {macDesktop === true
                      ? "※ Recommended ※"
                      : macDesktop === false
                        ? "Not supported in this device"
                        : "\u00a0"}
                  </span>
                  <TrackerDemo kind="desktop" />
                  <span className="tracker-option-copy">
                    The pet stays in the corner, closes a distracting tab, and brings you back for the reward.
                  </span>
                </button>
                {downloadUrl ? (
                  <a className="tracker-download" href={downloadUrl}>
                    First time aurafarming? Download here!
                  </a>
                ) : null}
              </div>
              <div className={!useDesktopPet ? "tracker-option is-selected" : "tracker-option"}>
                <button
                  type="button"
                  className="tracker-option-pick"
                  aria-pressed={!useDesktopPet}
                  disabled={pending || Boolean(desktopLink)}
                  onClick={() => setTrackerChoice(false)}
                >
                  <span className="tracker-option-name">Website timer</span>
                  <span className="tracker-choice-note" aria-hidden="true">
                    {"\u00a0"}
                  </span>
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
              <button type="button" className="button button-ghost" disabled={pending} onClick={() => setStartOpen(false)}>
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
                  onClick={() => void onConfirm()}
                >
                  FARM AURA
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
