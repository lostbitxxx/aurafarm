import type { Metadata } from "next";
import { AdminReset } from "@/components/admin-reset";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <h2>Admin</h2>
        <AdminReset />
      </section>
    </main>
  );
}
