"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { error: "", message: "" };

export function RegisterForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(register, initialState);

  return (
    <form action={action} className="auth-form">
      <label className="field">
        <span>Display name</span>
        <input name="displayName" type="text" autoComplete="nickname" maxLength={32} required />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
      </label>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="form-success" role="status">
          {state.message}
        </p>
      ) : null}
      {!configured ? (
        <p className="form-error" role="status">
          Supabase keys are not set yet. Add them to <code>.env.local</code>, run the SQL
          migration, then restart the dev server.
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending || !configured}>
        {pending ? "Signing you up…" : "Create account"}
      </button>
      <p className="form-switch">
        Already have a farm? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
