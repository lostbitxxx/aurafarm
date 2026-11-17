import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminReset } from "@/components/admin-reset";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
};

export const instant = false;

export default async function AdminPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? "";

  return (
    <main className="auth-layout">
      <section className="auth-card admin-card">
        <h2>Admin</h2>
        <p className="admin-lead">Dev tools for your signed-in account only.</p>
        <AdminReset userId={userId} />
      </section>
    </main>
  );
}
