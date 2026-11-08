import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard-screen";
import { loadDashboard } from "@/lib/dashboard";
import { petDownloadUrl } from "@/lib/pet-device";

export const metadata: Metadata = {
  title: "Desk",
};

export const instant = false;

export default async function DashboardPage() {
  const dashboard = await loadDashboard();
  return (
    <DashboardScreen
      {...dashboard}
      downloadUrl={petDownloadUrl(process.env.NEXT_PUBLIC_PET_DOWNLOAD_URL)}
    />
  );
}
