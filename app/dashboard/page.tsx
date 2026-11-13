import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard-screen";
import { loadDashboard } from "@/lib/dashboard";
import { loadFriendDesk } from "@/lib/friend-desk";
import { petDownloadUrl } from "@/lib/pet-device";

export const metadata: Metadata = {
  title: "Desk",
};
// comment
export const instant = false;

export default async function DashboardPage() {
  const [dashboard, friends] = await Promise.all([loadDashboard(), loadFriendDesk()]);
  return (
    <DashboardScreen
      {...dashboard}
      {...friends}
      downloadUrl={petDownloadUrl(process.env.NEXT_PUBLIC_PET_DOWNLOAD_URL)}
    />
  );
}
