"use client";

import { useState } from "react";

/** Website help to re-open the pet: ask first, then reveal the launch link. */
export function DesktopLaunchHelp({
  href,
  className = "button button-start",
}: {
  href: string;
  className?: string;
}) {
  const [showOpen, setShowOpen] = useState(false);

  if (showOpen) {
    return (
      <a className={className} href={href}>
        Open Aurafarm
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setShowOpen(true)}>
      Not Seeing Desktop Pet?
    </button>
  );
}
