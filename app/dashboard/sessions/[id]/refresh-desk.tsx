"use client";

import { useEffect } from "react";
import { requestDeskRefresh } from "@/lib/desk-refresh";

export function RefreshDeskOnFinish({ finished }: { finished: boolean }) {
  useEffect(() => {
    if (!finished) return;
    requestDeskRefresh();
  }, [finished]);
  return null;
}
