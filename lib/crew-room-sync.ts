"use client";

import { useCallback, useEffect, useState } from "react";
import { listFarmCrewPoses, setFarmCrewPose } from "@/lib/actions/farm-crew";
import type { CrewPose } from "@/lib/crew-room-layout";

/**
 * Shared FarmCrew poses. The signed-in member publishes their own pet
 * through the server session, and every screen reads that same table.
 */
export function useCrewPoses(crewId: string) {
  const [poses, setPoses] = useState<Record<string, CrewPose>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;

    const load = async () => {
      const result = await listFarmCrewPoses(crewId);
      if (stop) return;
      if (result.error) {
        setError(result.error);
      } else {
        const next: Record<string, CrewPose> = {};
        for (const pose of result.poses) next[pose.userId] = pose;
        setPoses(next);
        setError("");
      }
      setLoaded(true);
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 300);

    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [crewId]);

  const publish = useCallback(
    async (pose: CrewPose) => {
      const result = await setFarmCrewPose(crewId, pose);
      if (result.error || !result.pose) return null;
      setPoses((current) => ({ ...current, [result.pose!.userId]: result.pose! }));
      return result.pose;
    },
    [crewId],
  );

  return { poses, loaded, error, publish };
}
