"use client";

import { useEffect } from "react";
import { touchSocialPresence } from "@/lib/actions/friends";

const DESK_PRESENCE_MS = 10_000;

export function SocialPresence() {
  useEffect(() => {
    let stopped = false;

    async function beat(present: boolean) {
      if (stopped && present) return;
      const result = await touchSocialPresence(present);
      if (result.error) console.error(result.error);
    }

    function onVisibility() {
      void beat(document.visibilityState === "visible");
    }

    function onHide() {
      void beat(false);
    }

    onVisibility();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void beat(true);
    }, DESK_PRESENCE_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
