"use client";

import { useCallback, useEffect, useState } from "react";
import { listFarmCrewPoses, setFarmCrewPose } from "@/lib/actions/farm-crew";
import { newerCrewPose, poseFromRow, type CrewPose } from "@/lib/crew-room-layout";
import { CREW_ID_PATTERN } from "@/lib/farm-crew";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const FALLBACK_POLL_MS = 120;
const LIVE_POLL_MS = 3000;

/**
 * Shared FarmCrew poses. The signed-in member publishes their own pet
 * through the server session. Other screens hear each row change on
 * the realtime stream, and a slow poll fills anything the stream missed.
 */
export function useCrewPoses(crewId: string) {
  const [poses, setPoses] = useState<Record<string, CrewPose>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    let loading = false;
    let live = false;
    let timer = 0;

    const accept = (incoming: CrewPose) => {
      setPoses((current) => {
        const next = newerCrewPose(current[incoming.userId], incoming);
        if (next === current[incoming.userId]) return current;
        return { ...current, [incoming.userId]: next };
      });
    };

    const load = async () => {
      const result = await listFarmCrewPoses(crewId);
      if (stop) return;
      if (result.error) {
        setError(result.error);
      } else {
        for (const pose of result.poses) accept(pose);
        setError("");
      }
      setLoaded(true);
    };

    const tick = async () => {
      if (loading) return;
      loading = true;
      try {
        await load();
      } finally {
        loading = false;
      }
    };

    const schedule = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
        void tick();
      }, live ? LIVE_POLL_MS : FALLBACK_POLL_MS);
    };

    void tick();
    schedule();

    if (!isSupabaseConfigured() || !CREW_ID_PATTERN.test(crewId)) {
      return () => {
        stop = true;
        window.clearInterval(timer);
      };
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`farm-crew-pose:${crewId}`, {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "farm_crew_pose",
          filter: `crew_id=eq.${crewId}`,
        },
        (payload) => {
          if (stop) return;
          if (payload.eventType === "DELETE") return;
          const row = payload.new;
          if (!row || typeof row !== "object") return;
          const pose = poseFromRow(row as Record<string, unknown>);
          if (pose) accept(pose);
        },
      );

    const listen = async () => {
      const { data } = await supabase.auth.getSession();
      if (stop) return;
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (stop) return;
      channel.subscribe((status) => {
        if (stop) return;
        const nextLive = status === "SUBSCRIBED";
        if (nextLive === live) return;
        live = nextLive;
        schedule();
      });
    };

    void listen();
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      stop = true;
      window.clearInterval(timer);
      auth.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [crewId]);

  const publish = useCallback(
    async (pose: CrewPose) => {
      const result = await setFarmCrewPose(crewId, pose);
      if (result.error || !result.pose) return null;
      setPoses((current) => {
        const next = newerCrewPose(current[result.pose!.userId], result.pose!);
        if (next === current[result.pose!.userId]) return current;
        return { ...current, [result.pose!.userId]: next };
      });
      return result.pose;
    },
    [crewId],
  );

  return { poses, loaded, error, publish };
}
