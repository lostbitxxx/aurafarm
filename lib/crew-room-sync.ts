"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { poseFromRow, type CrewPose } from "@/lib/crew-room-layout";
import { createClient } from "@/lib/supabase/client";

function rowStamp(row: { updated_at?: unknown }) {
  const stamp = Date.parse(String(row.updated_at ?? ""));
  return Number.isFinite(stamp) ? stamp : 0;
}

/**
 * Shared FarmCrew poses. The signed-in member publishes their own pet.
 * Everyone else renders the latest row, via realtime with a one-second refresh behind it.
 */
export function useCrewPoses(crewId: string) {
  const [poses, setPoses] = useState<Record<string, CrewPose>>({});
  const [loaded, setLoaded] = useState(false);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const stampsRef = useRef<Record<string, number>>({});

  const client = useCallback(() => {
    clientRef.current ??= createClient();
    return clientRef.current;
  }, []);

  const take = useCallback((row: unknown) => {
    if (!row || typeof row !== "object") return null;
    const pose = poseFromRow(row as Parameters<typeof poseFromRow>[0]);
    if (!pose) return null;
    const stamp = rowStamp(row as { updated_at?: unknown });
    const seen = stampsRef.current[pose.userId] ?? 0;
    if (stamp && stamp < seen) return null;
    stampsRef.current[pose.userId] = stamp || seen || Date.now();
    return pose;
  }, []);

  useEffect(() => {
    const supabase = client();
    let stop = false;

    const load = async () => {
      const { data } = await supabase
        .from("farm_crew_pose")
        .select("user_id,left_pct,top_pct,mode,seat_id,face_left,updated_at")
        .eq("crew_id", crewId);
      if (stop) return;
      if (Array.isArray(data)) {
        setPoses((current) => {
          const next = { ...current };
          for (const row of data) {
            const pose = take(row);
            if (pose) next[pose.userId] = pose;
          }
          return next;
        });
      }
      setLoaded(true);
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 1000);

    const channel = supabase
      .channel(`crew-pose:${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "farm_crew_pose",
          filter: `crew_id=eq.${crewId}`,
        },
        (payload) => {
          const pose = take(payload.new);
          if (!pose) return;
          setPoses((current) => ({ ...current, [pose.userId]: pose }));
        },
      )
      .subscribe();

    return () => {
      stop = true;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [client, crewId, take]);

  const publish = useCallback(
    async (pose: CrewPose) => {
      const { data, error } = await client().rpc("set_farm_crew_pose", {
        target: crewId,
        p_left: pose.left,
        p_top: pose.top,
        p_mode: pose.mode,
        p_seat: pose.seatId,
        p_face_left: pose.faceLeft,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return take(row);
    },
    [client, crewId, take],
  );

  return { poses, loaded, publish };
}
