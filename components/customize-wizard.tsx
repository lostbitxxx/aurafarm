"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  BEHAVIOR_QUESTIONS,
  STUDY_MODES,
  adjustPlan,
  describeDailyBreakdown,
  modeLabel,
  modeTagline,
  planForMode,
  recommendStudyMode,
  studyDaysPerWeek,
  type BehaviorAnswers,
  type StudyMode,
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
    monthlySessions: number;
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
  const [monthlySessions, setMonthlySessions] = useState<number | "">(
    initialPlan?.monthlySessions ?? 20,
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
  const lifestyle = answers.lifestyle ?? "steady";
  const suggestedMonthly = planForMode(activeMode, lifestyle).monthlySessions;
  const plan = useMemo(
    () =>
      adjustPlan(
        activeMode,
        monthlySessions === "" ? suggestedMonthly : monthlySessions,
        studyDaysPerWeek(lifestyle),
      ),
    [activeMode, monthlySessions, lifestyle, suggestedMonthly],
  );
  const breakdown = describeDailyBreakdown(plan);

  function chooseAnswer<K extends keyof BehaviorAnswers>(id: K, value: BehaviorAnswers[K]) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (next.attention && next.lifestyle && next.distraction) {
      const pick = recommendStudyMode(next as BehaviorAnswers);
      // New answers unlock a fresh recommendation; clear any old manual pick.
      setModePickedByUser(false);
      setPickedMode(pick);
      setMonthlySessions(planForMode(pick, next.lifestyle).monthlySessions);
    }
  }

  function chooseMode(nextMode: StudyMode) {
    setModePickedByUser(true);
    setPickedMode(nextMode);
    setMonthlySessions(planForMode(nextMode, lifestyle).monthlySessions);
  }

  function openRecommendedMode() {
    if (!recommended) return;
    setModePickedByUser(false);
    setPickedMode(recommended);
    setMonthlySessions(planForMode(recommended, lifestyle).monthlySessions);
    goToStep(1);
  }

  if (migrationError) {
    const needsMigration = /migration 0021|study-mode columns/i.test(migrationError);
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
            <code>supabase/migrations/0021_study_customization.sql</code>, run it, then refresh
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
              : "Set this month’s goal"}
        </h1>
        <p className="customize-lede">
          {step === 0
            ? "Three short questions. We’ll recommend a study style you can still change."
            : step === 1
              ? "Assassin, Knight, or Lord — pick the one that fits, even if we guessed wrong."
              : "We’ll break the monthly target into a daily view so the desk stays clear."}
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
                  <strong>{modeLabel(item)}</strong>
                  <span>{modeTagline(item)}</span>
                  <em>{planForMode(item).sessionMinutes} min blocks</em>
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
                Set monthly goal
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

            <label className="field">
              <span>
                Monthly sessions as {modeLabel(activeMode)} ({plan.sessionMinutes} min each)
              </span>
              <input
                name="monthlySessions"
                type="number"
                min={1}
                max={120}
                value={monthlySessions}
                placeholder={String(suggestedMonthly)}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") {
                    setMonthlySessions("");
                    return;
                  }
                  const next = Number(raw);
                  if (Number.isFinite(next)) setMonthlySessions(Math.floor(next));
                }}
                required
              />
            </label>

            <div className="goal-visual" aria-live="polite">
              <div className="goal-stat">
                <strong>{breakdown.monthlySessions}</strong>
                <span>sessions / month</span>
              </div>
              <div className="goal-stat">
                <strong>{breakdown.dailySessions}</strong>
                <span>per study day</span>
              </div>
              <div className="goal-stat">
                <strong>{breakdown.studyDaysPerWeek}</strong>
                <span>days / week</span>
              </div>
              <div className="goal-stat">
                <strong>{Math.round(breakdown.monthlyMinutes / 60)}h</strong>
                <span>focus this month</span>
              </div>
            </div>

            <div className="daily-strip" aria-label="Daily goal visualization">
              {Array.from({ length: breakdown.studyDaysPerWeek }, (_, day) => (
                <div key={day} className="daily-day">
                  <span>Day {day + 1}</span>
                  <div className="daily-pips">
                    {Array.from({ length: breakdown.dailySessions }, (_, pip) => (
                      <i key={pip} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="customize-note">
              On a study day, aim for {breakdown.dailySessions}×{breakdown.sessionMinutes} min.
              Across ~{breakdown.studyDaysPerMonth} study days, that reaches your monthly goal.
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
