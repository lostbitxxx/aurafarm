"use client";

import { useState } from "react";
import { resetAllPets, setDailyStreak } from "@/lib/actions/admin";
import { farmerLocalDay, devTimerPasswordMatches } from "@/lib/study";

export function AdminReset() {
  const [streakPassword, setStreakPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [streakDays, setStreakDays] = useState("30");
  const [pending, setPending] = useState<"streak" | "reset" | null>(null);
  const [streakError, setStreakError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [streakDone, setStreakDone] = useState<number | null>(null);
  const [resetDone, setResetDone] = useState(false);

  async function onSetStreak() {
    if (pending) return;
    if (!devTimerPasswordMatches(streakPassword)) {
      setStreakDone(null);
      setStreakError("That password does not match.");
      return;
    }
    const count = Number(streakDays);
    if (!Number.isInteger(count) || count < 0 || count > 10000) {
      setStreakDone(null);
      setStreakError("Streak count must be from 0 to 10000.");
      return;
    }
    setPending("streak");
    setStreakError(null);
    const result = await setDailyStreak(streakPassword, count, farmerLocalDay());
    setPending(null);
    if (result.error) {
      setStreakError(result.error);
      return;
    }
    setStreakDone(result.streakCount);
  }

  async function onReset() {
    if (pending) return;
    if (!devTimerPasswordMatches(resetPassword)) {
      setResetDone(false);
      setResetError("That password does not match.");
      return;
    }
    setPending("reset");
    setResetError(null);
    const result = await resetAllPets(resetPassword);
    setPending(null);
    if (result.error) {
      setResetError(result.error);
      return;
    }
    setResetDone(true);
  }

  return (
    <div className="admin-tools">
      <section className="admin-tool admin-tool-danger" aria-labelledby="admin-reset-title">
        <h3 id="admin-reset-title">Reset account</h3>
        <p>
          Destructive. Resets your pets to level 1 with 0 experience, clears colors, hats, and clothes,
          marks achievements undone, and deletes your study records and collection. Other accounts stay as
          they are.
        </p>
        <label className="field">
          Password
          <input
            type="password"
            value={resetPassword}
            autoComplete="off"
            onChange={(event) => setResetPassword(event.target.value)}
          />
        </label>
        <button type="button" className="button" disabled={pending !== null} onClick={onReset}>
          Reset my pets and study records
        </button>
        {resetDone ? (
          <p className="form-success">
            Your pets are level 1 with 0 experience. Your study records, collection, reward choices, and
            achievements are gone.
          </p>
        ) : null}
        {resetError ? (
          <p className="form-error" role="alert">
            {resetError}
          </p>
        ) : null}
      </section>

      <section className="admin-tool" aria-labelledby="admin-streak-title">
        <h3 id="admin-streak-title">Set streak</h3>
        <p>For testing only. Changes your streak number. Does not delete pets, XP, or study records.</p>
        <label className="field">
          Streak days
          <input
            type="number"
            min={0}
            max={10000}
            step={1}
            value={streakDays}
            onChange={(event) => setStreakDays(event.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={streakPassword}
            autoComplete="off"
            onChange={(event) => setStreakPassword(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={pending !== null}
          onClick={onSetStreak}
        >
          Set my streak
        </button>
        {streakDone !== null ? (
          <p className="form-success">
            Streak set to {streakDone === 1 ? "1 day" : `${streakDone} days`}. Open the desk to see it.
          </p>
        ) : null}
        {streakError ? (
          <p className="form-error" role="alert">
            {streakError}
          </p>
        ) : null}
      </section>
    </div>
  );
}
