"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { COIN_ICON_SRC } from "@/lib/pet-assets";
import { HeaderMenu } from "./header-menu";

export function SiteHeader({
  petTotalLevel,
  coins,
  onOpenDownload,
  onOpenDevTools,
  onReplayTutorial,
  tutorialTargets = null,
}: {
  petTotalLevel?: number;
  coins?: number;
  onOpenDownload?: () => void;
  onOpenDevTools?: () => void;
  onReplayTutorial?: () => void;
  tutorialTargets?: readonly string[] | null;
}) {
  const tutorialCurrent = (target: string) =>
    tutorialTargets?.includes(target) ? "true" : undefined;
  const coinsLabel = typeof coins === "number" ? String(Math.max(0, Math.trunc(coins))) : null;
  const petLvLabel =
    typeof petTotalLevel === "number" && Number.isFinite(petTotalLevel)
      ? String(Math.max(0, Math.floor(petTotalLevel)))
      : null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
    }

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (settingsRef.current?.contains(target)) return;
      setSettingsOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [settingsOpen]);

  function runSettingsAction(action?: () => void) {
    setSettingsOpen(false);
    action?.();
  }

  const settingsItems = (
    <>
      {onOpenDownload ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onOpenDownload)}>
          Download desktop pet
        </button>
      ) : null}
      <Link href="/privacy" role="menuitem" onClick={() => setSettingsOpen(false)}>
        Privacy
      </Link>
      {onReplayTutorial ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onReplayTutorial)}>
          Replay tutorial
        </button>
      ) : null}
      {onOpenDevTools ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onOpenDevTools)}>
          Dev tools
        </button>
      ) : null}
      <form action={signOut}>
        <button type="submit" role="menuitem">
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <header className="topbar">
      <div className="topbar-nav">
        <div className="topbar-brand">
          <Link href="/dashboard" className="wordmark">
            Aurafarm
          </Link>
        </div>
      </div>
      <div className="topbar-user">
        {coinsLabel != null ? (
          <span
            className="points-balance coin-balance topbar-desktop"
            aria-label={`Coins ${coinsLabel}`}
            data-tutorial="coins"
            data-tutorial-current={tutorialCurrent("coins")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="coin-icon" src={COIN_ICON_SRC} alt="" draggable={false} />
            <span>{coinsLabel}</span>
          </span>
        ) : null}
        {petLvLabel != null ? (
          <span className="points-balance topbar-desktop" aria-label={`Total pet level ${petLvLabel}`}>
            Total pet level: <span>{petLvLabel}</span>
          </span>
        ) : null}
        <div
          ref={settingsRef}
          className={settingsOpen ? "topbar-settings is-open" : "topbar-settings"}
        >
          <button
            type="button"
            className="topbar-settings-button"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
            data-tutorial="settings"
            onClick={() => {
              setSettingsOpen((value) => !value);
            }}
          >
            <span className="topbar-settings-gear" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <path
                  fill="currentColor"
                  d="M19.4 13a7.7 7.7 0 0 0 .1-1 7.7 7.7 0 0 0-.1-1l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.4 8.8a.5.5 0 0 0 .1.6l2 1.6a7.7 7.7 0 0 0-.1 1 7.7 7.7 0 0 0 .1 1l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
                />
              </svg>
            </span>
          </button>
          {settingsOpen ? (
            <div id={settingsId} className="topbar-settings-list" role="menu" aria-label="Settings">
              {settingsItems}
            </div>
          ) : null}
        </div>
        <HeaderMenu>
          {coinsLabel != null ? (
            <p
              className="points-balance coin-balance topbar-drawer-study"
              aria-label={`Coins ${coinsLabel}`}
              data-tutorial="coins"
              data-tutorial-current={tutorialCurrent("coins")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="coin-icon" src={COIN_ICON_SRC} alt="" draggable={false} />
              <span>{coinsLabel}</span>
            </p>
          ) : null}
          {petLvLabel != null ? (
            <p className="points-balance topbar-drawer-study" aria-label={`Total pet level ${petLvLabel}`}>
              Total pet level: <span>{petLvLabel}</span>
            </p>
          ) : null}
          {onOpenDownload ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenDownload}>
              Download desktop pet
            </button>
          ) : null}
          <Link href="/privacy" className="topbar-drawer-link">
            Privacy
          </Link>
          {onReplayTutorial ? (
            <button type="button" className="topbar-drawer-link" onClick={onReplayTutorial}>
              Replay tutorial
            </button>
          ) : null}
          {onOpenDevTools ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenDevTools}>
              Dev tools
            </button>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="button button-small button-ghost">
              Sign out
            </button>
          </form>
        </HeaderMenu>
      </div>
    </header>
  );
}
