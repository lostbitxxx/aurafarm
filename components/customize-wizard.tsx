"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  BEHAVIOR_QUESTIONS,
  SESSION_MINUTE_COPY,
  SESSION_MINUTE_OPTIONS,
  STUDY_MODES,
  WEEKDAYS,
  WEEKDAY_LABELS,
  defaultWeekdaysForLifestyle,
  STUDY_MODE_ART,
  modeLabel,
  modeSessionMinutes,
  modeTagline,
  planForMode,
  recommendStudyMode,
  type BehaviorAnswers,
  type StudyMode,
  type Weekday,
} from "@/lib/study-mode";
import { saveCustomization, type CustomizeFormState } from "@/lib/actions/customize";

const initialState: CustomizeFormState = { error: "", saved: false };

const emptyAnswers: Partial<BehaviorAnswers> = {};
const FADE_MS = 220;

export function CustomizeWizard({
  displayName,
  migrationError,
  initialPlan,
  embedded = false,
  onSaved,
}: {
  displayName: string;
  migrationError: string | null;
  initialPlan: {
    mode: StudyMode;
    sessionMinutes: number;
    studyWeekdays: readonly Weekday[];
    answers: BehaviorAnswers | null;
  } | null;
  embedded?: boolean;
  onSaved?: () => void;
}) {
  const hasSavedAnswers = Boolean(
    initialPlan?.answers?.attention &&
      initialPlan.answers.lifestyle &&
      initialPlan.answers.distraction,
  );
  const [step, setStep] = useState(hasSavedAnswers ? 2 : 0);
  const [fading, setFading] = useState(false);
  const [answers, setAnswers] = useState<Partial<BehaviorAnswers>>(
    initialPlan?.answers ?? emptyAnswers,
  );
  const [pickedMode, setPickedMode] = useState<StudyMode | null>(initialPlan?.mode ?? null);
  const [modePickedByUser, setModePickedByUser] = useState(Boolean(initialPlan?.mode));
  const [sessionMinutes, setSessionMinutes] = useState(
    initialPlan?.sessionMinutes ?? modeSessionMinutes(initialPlan?.mode ?? "knight"),
  );
  const [studyWeekdays, setStudyWeekdays] = useState<Weekday[]>(
    initialPlan?.studyWeekdays?.length
      ? [...initialPlan.studyWeekdays]
      : defaultWeekdaysForLifestyle(initialPlan?.answers?.lifestyle ?? "steady"),
  );
  const [state, action, pending] = useActionState(saveCustomization, initialState);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (state.saved) onSavedRef.current?.();
  }, [state.saved]);

  function goToStep(next: number) {
    if (next === step || fading) return;
    setFading(true);
    window.setTimeout(() => {
      setStep(next);
      setFading(false);
    }, FADE_MS);
  }

  const questionsDone =
    answers.attention !== undefined &&
    answers.lifestyle !== undefined &&
    answers.distraction !== undefined;

  const recommended = questionsDone
    ? recommendStudyMode(answers as BehaviorAnswers)
    : null;

  // Highlight follows the recommendation until the user taps a mode card.
  const activeMode = (modePickedByUser ? pickedMode : null) ?? recommended ?? "knight";

  function chooseAnswer<K extends keyof BehaviorAnswers>(id: K, value: BehaviorAnswers[K]) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (next.attention && next.lifestyle && next.distraction) {
      const pick = recommendStudyMode(next as BehaviorAnswers);
      // New answers unlock a fresh recommendation; clear any old manual pick.
      setModePickedByUser(false);
      setPickedMode(pick);
      setSessionMinutes(modeSessionMinutes(pick));
      if (id === "lifestyle") {
        setStudyWeekdays(defaultWeekdaysForLifestyle(next.lifestyle));
      }
    } else if (id === "lifestyle") {
      setStudyWeekdays(defaultWeekdaysForLifestyle(value as BehaviorAnswers["lifestyle"]));
    }
  }

  function chooseMode(nextMode: StudyMode) {
    setModePickedByUser(true);
    setPickedMode(nextMode);
    setSessionMinutes(modeSessionMinutes(nextMode));
  }

  function toggleWeekday(day: Weekday) {
    setStudyWeekdays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) return current;
        return WEEKDAYS.filter((entry) => entry !== day && current.includes(entry));
      }
      return WEEKDAYS.filter((entry) => entry === day || current.includes(entry));
    });
  }

  function openRecommendedMode() {
    if (!recommended) return;
    setModePickedByUser(false);
    setPickedMode(recommended);
    setSessionMinutes(modeSessionMinutes(recommended));
    goToStep(1);
  }

  if (migrationError) {
    const needsMigration = /migration 0021|study-mode columns|0044/i.test(migrationError);
    return (
      <section className="customize-card">
        <p className="eyebrow">Study mode</p>
        <h1>One more setup step</h1>
        <p className="form-error" role="alert">
          {migrationError}
        </p>
        {needsMigration ? (
          <p className="customize-note">
            Open the Supabase SQL editor, paste{" "}
            <code>supabase/migrations/0021_study_customization.sql</code> and{" "}
            <code>supabase/migrations/0044_weekly_study_days.sql</code>, run them, then refresh
            this page.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={embedded ? "customize-embed" : "customize-card"}>
      {embedded ? null : <p className="eyebrow customize-eyebrow">Welcome, {displayName}</p>}
      <ol className="customize-steps" aria-label="Customization steps">
        {(
          [
            { id: 0, label: "Behavior" },
            { id: 1, label: "Study mode" },
            { id: 2, label: "Goals" },
          ] as const
        ).map((item) => {
          const unlocked = item.id === 0 || questionsDone;
          const className =
            step === item.id ? "is-active" : unlocked && step > item.id ? "is-done" : "";
          return (
            <li key={item.id}>
              <button
                type="button"
                className={className}
                disabled={!unlocked || fading}
                aria-current={step === item.id ? "step" : undefined}
                onClick={() => goToStep(item.id)}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div
        key={step}
        className={`customize-stage${fading ? " is-fading" : ""}`}
        aria-busy={fading}
      >
        <h1>
          {step === 0
            ? "How do you study?"
            : step === 1
              ? "Choose your study mode"
              : "Set this week’s goal"}
        </h1>
        <p className="customize-lede">
          {step === 0
            ? "Three short questions. We’ll recommend a study style you can still change."
            : step === 1
              ? "Assassin, Knight, or Lord — pick the one that fits, even if we guessed wrong."
              : "Pick which days you study and how long. Rest days stay optional."}
        </p>

        {step === 0 ? (
          <div className="customize-panel">
            {BEHAVIOR_QUESTIONS.map((question) => (
              <fieldset key={question.id} className="customize-question">
                <legend>{question.prompt}</legend>
                <p>{question.hint}</p>
                <div className="customize-options">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`customize-option${selected ? " is-selected" : ""}`}
                        onClick={() =>
                          chooseAnswer(
                            question.id,
                            option.value as BehaviorAnswers[typeof question.id],
                          )
                        }
                      >
                        <strong>{option.label}</strong>
                        <span>{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <div className="customize-actions">
              <button
                type="button"
                className="button"
                disabled={!questionsDone || fading}
                onClick={openRecommendedMode}
              >
                See recommended study mode
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="customize-panel">
            {recommended ? (
              <p className="customize-recommend" role="status">
                Suggested for you: <strong>{modeLabel(recommended)}</strong> —{" "}
                {modeTagline(recommended)}
              </p>
            ) : null}
            <div className="customize-modes">
              {STUDY_MODES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`customize-mode${activeMode === item ? " is-selected" : ""}`}
                  onClick={() => chooseMode(item)}
                >
                  <div className="customize-mode-copy">
                    <div className="customize-mode-title">
                      <strong>{modeLabel(item)}</strong>
                      {item === recommended ? (
                        <span className="customize-mode-recommended">✦Recommended✦</span>
                      ) : null}
                    </div>
                    <span>{modeTagline(item)}</span>
                    <em>{planForMode(item).sessionMinutes} min blocks</em>
                  </div>
                  <img
                    className="customize-mode-art"
                    src={STUDY_MODE_ART[item]}
                    alt=""
                    width={128}
                    height={128}
                    draggable={false}
                  />
                </button>
              ))}
            </div>
            <div className="customize-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={fading}
                onClick={() => goToStep(0)}
              >
                Back
              </button>
              <button
                type="button"
                className="button"
                disabled={fading}
                onClick={() => goToStep(2)}
              >
                Set weekly goal
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <form action={action} className="customize-panel">
            {embedded ? <input type="hidden" name="embedded" value="1" /> : null}
            <input type="hidden" name="attention" value={answers.attention ?? ""} />
            <input type="hidden" name="lifestyle" value={answers.lifestyle ?? ""} />
            <input type="hidden" name="distraction" value={answers.distraction ?? ""} />
            <input type="hidden" name="studyMode" value={activeMode} />
            <input type="hidden" name="studyWeekdays" value={studyWeekdays.join(",")} />
            <input type="hidden" name="sessionMinutes" value={sessionMinutes} />

            <fieldset className="customize-question">
              <legend>Which days will you study?</legend>
              <div className="weekday-strip" role="group" aria-label="Study days">
                {WEEKDAYS.map((day) => {
                  const selected = studyWeekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`weekday-day${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => toggleWeekday(day)}
                    >
                      <strong>{WEEKDAY_LABELS[day]}</strong>
                      <span>{selected ? "Study" : "Rest"}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="customize-question">
              <legend>Daily minutes</legend>
              <div className="customize-options session-minute-options">
                {SESSION_MINUTE_OPTIONS.map((minutes) => {
                  const selected = sessionMinutes === minutes;
                  const recommended = minutes === modeSessionMinutes(activeMode);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      className={`customize-option${selected ? " is-selected" : ""}`}
                      onClick={() => setSessionMinutes(minutes)}
                    >
                      <strong>{minutes} min</strong>
                      <span>{recommended ? "✦Recommended✦" : SESSION_MINUTE_COPY[minutes]}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <p className="customize-note customize-note-underline">
              You can still study on rest days and grow your streak!
            </p>

            {state.error ? (
              <p className="form-error" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="customize-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={fading}
                onClick={() => goToStep(1)}
              >
                Back
              </button>
              <button className="button" type="submit" disabled={pending || fading}>
                {pending ? "Saving…" : embedded || initialPlan ? "Save plan" : "Farm aura"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
