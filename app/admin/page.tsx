import type { Metadata } from "next";
import { AdminReset } from "@/components/admin-reset";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card admin-card">
        <h2>Admin</h2>
        <p className="admin-lead">Dev tools for your signed-in account only.</p>
        <AdminReset />
      </section>
    </main>
  );
}
