import type { Metadata } from "next";
import { FarmCrewScreen } from "@/components/farm-crew-screen";
import { loadFarmCrewRoom } from "@/lib/farm-crew-desk";

export const metadata: Metadata = {
  title: "FarmCrew",
};

export const instant = false;

export default async function FarmCrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await loadFarmCrewRoom(id);
  return <FarmCrewScreen room={room} />;
}
