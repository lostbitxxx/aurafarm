import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard-screen";
import { loadDashboard } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Desk",
};

export default async function DashboardPage() {
  const dashboard = await loadDashboard();
  return <DashboardScreen {...dashboard} />;
}
