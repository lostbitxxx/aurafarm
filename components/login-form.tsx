"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { error: "", message: "" };

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="auth-form">
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {!configured ? (
        <p className="form-error" role="status">
          Supabase keys are not set yet. Add them to <code>.env.local</code> and restart the
          dev server.
        </p>
      ) : null}
      <button className="button" type="submit" disabled={pending || !configured}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="form-switch">
        New here? <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
