"use client";

import { useId, useState } from "react";

/** Website help to re-open the pet: opens a small dialog with the launch link. */
export function DesktopLaunchHelp({
  href,
  className = "button button-ghost button-end-early",
}: {
  href: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Not Seeing Desktop Pet?
      </button>
      {open ? (
        <div className="tracker-pop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="tracker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id={titleId}>Not seeing the desktop pet?</h2>
              <button type="button" className="dialog-close" onClick={() => setOpen(false)} aria-label="Close dialog">
                ×
              </button>
            </div>
            <p>Open Aurafarm again to reconnect the pet to this study session.</p>
            <div className="tracker-actions">
              <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <a className="button button-farm" href={href} onClick={() => setOpen(false)}>
                Open Aurafarm
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
