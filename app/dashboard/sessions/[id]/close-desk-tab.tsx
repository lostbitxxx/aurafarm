"use client";

import { requestDeskRefresh } from "@/lib/desk-refresh";

export function CloseDeskTab({
  children,
  refresh = false,
}: {
  children: string;
  refresh?: boolean;
}) {
  return (
    <button
      type="button"
      className="button"
      onClick={() => {
        if (refresh) requestDeskRefresh();
        window.close();
      }}
    >
      {children}
    </button>
  );
}
