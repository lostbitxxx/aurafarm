import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { PublicHeader } from "@/components/public-header";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <>
      <PublicHeader />
      <main className="auth-layout">
        <section className="panel auth-panel">
          <div className="auth-aside">
            <h1>Your desktop is still on.</h1>
            <p>Sign in to see your pets and choose which one stands in the Godot frame.</p>
          </div>
          <div className="auth-card">
            <h2>Sign in</h2>
            <LoginForm configured={isSupabaseConfigured()} />
          </div>
        </section>
      </main>
    </>
  );
}
