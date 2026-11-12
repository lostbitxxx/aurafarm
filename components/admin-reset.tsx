"use client";

import { useState } from "react";
import { resetAllPets } from "@/lib/actions/admin";
import { devTimerPasswordMatches } from "@/lib/study";

export function AdminReset() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onReset() {
    if (pending) return;
    if (!devTimerPasswordMatches(password)) {
      setDone(false);
      setError("That password does not match.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await resetAllPets(password);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="auth-form">
      <label className="field">
        Password
        <input
          type="password"
          value={password}
          autoComplete="off"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="button" className="button" disabled={pending} onClick={onReset}>
        Reset all pets
      </button>
      {done ? <p>Every pet is level 1 with 0 experience. Study records are gone.</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
