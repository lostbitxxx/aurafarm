"use server";

import { redirect } from "next/navigation";
import { saveNewFarmer } from "@/lib/farmers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string;
  message: string;
};

const emptyState: AuthFormState = { error: "", message: "" };

const confirmationStillRequired =
  "This project is still requiring email confirmation. Turn off Confirm email in the Supabase dashboard, then register again.";

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  return { email, password, displayName };
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, displayName } = readCredentials(formData);

  if (!displayName || displayName.length > 32) {
    return { ...emptyState, error: "Use a display name of 1 to 32 characters." };
  }
  if (!validateEmail(email)) {
    return { ...emptyState, error: "Enter a valid email address." };
  }
  if (password.length < 6 || password.length > 72) {
    return { ...emptyState, error: "Use a password of 6 to 72 characters." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ...emptyState,
      error:
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before creating an account.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error || !data.user) {
    return { ...emptyState, error: error?.message ?? "Could not create the account." };
  }

  if (data.user.identities && data.user.identities.length === 0) {
    return {
      ...emptyState,
      error: "An account with that email already exists. Sign in instead.",
    };
  }

  if (!data.session) {
    return { ...emptyState, error: confirmationStillRequired };
  }

  const admin = createAdminClient();
  const saved = await saveNewFarmer(admin ?? supabase, data.user.id, displayName);
  if (saved.error) return { ...emptyState, error: saved.error };

  redirect("/dashboard");
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);

  if (!validateEmail(email) || !password) {
    return { ...emptyState, error: "Enter the email and password for your farm." };
  }
  if (!isSupabaseConfigured()) {
    return {
      ...emptyState,
      error:
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before signing in.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ...emptyState, error: error.message };

  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
