import type { Metadata } from "next";
import { PixelPetArt } from "@/components/pixel-pet";
import { PublicHeader } from "@/components/public-header";
import { RegisterForm } from "@/components/register-form";
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
          <PixelPetArt petType="baby_slime" className="auth-pet-art" alt="" />
          <h1>Bring home Matcha.</h1>
          <p>
            Signup creates your user, inserts a profile, and adds a level 1 Matcha with
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
