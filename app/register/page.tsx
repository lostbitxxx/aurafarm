import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { RegisterForm } from "@/components/register-form";
import { SlimeMark } from "@/components/slime-mark";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <div className="paper-shell">
      <PublicHeader />
      <main className="auth-layout">
        <section className="auth-aside">
          <SlimeMark />
          <h1>Bring home a baby slime.</h1>
          <p>
            Signup creates your user, inserts a profile, and adds a level 1 baby slime with
            Equip to Desktop already on.
          </p>
        </section>
        <section className="auth-card">
          <h2>Create your farm</h2>
          <RegisterForm configured={isSupabaseConfigured()} />
        </section>
      </main>
    </div>
  );
}
