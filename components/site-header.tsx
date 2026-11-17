"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { streakPillLabel } from "@/lib/pet-assets";
import { formatDuration } from "@/lib/study";
import { HeaderMenu } from "./header-menu";

export function SiteHeader({
  displayName,
  studySeconds,
  streakCount,
  onOpenShop,
  onOpenCollection,
  onOpenInventory,
  onOpenAchievements,
  onOpenFriends,
  onOpenFarmCrew,
  onOpenSocialSettings,
  onOpenLeaderboard,
  onOpenSong,
  onOpenEditPlan,
  onOpenDownload,
  onOpenDevTools,
  pendingFriendRequest = false,
  tutorialTarget = null,
  socialPinned = false,
  onSocialClick,
}: {
  displayName: string;
  studySeconds?: number;
  streakCount?: number;
  onOpenShop?: () => void;
  onOpenCollection?: () => void;
  onOpenInventory?: () => void;
  onOpenAchievements?: () => void;
  onOpenFriends?: () => void;
  onOpenFarmCrew?: () => void;
  onOpenSocialSettings?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenSong?: () => void;
  onOpenEditPlan?: () => void;
  onOpenDownload?: () => void;
  onOpenDevTools?: () => void;
  pendingFriendRequest?: boolean;
  tutorialTarget?: string | null;
  socialPinned?: boolean;
  onSocialClick?: () => void;
}) {
  const streakLabel = streakPillLabel(streakCount);
  const tutorialCurrent = (target: string) => (tutorialTarget === target ? "true" : undefined);
  const studyLabel = typeof studySeconds === "number" ? formatDuration(studySeconds) : null;
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
      {onOpenEditPlan ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onOpenEditPlan)}>
          Edit plan
        </button>
      ) : null}
      {onOpenDownload ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onOpenDownload)}>
          Download desktop pet
        </button>
      ) : null}
      <Link href="/privacy" role="menuitem" onClick={() => setSettingsOpen(false)}>
        Privacy
      </Link>
      {onOpenSocialSettings ? (
        <button type="button" role="menuitem" onClick={() => runSettingsAction(onOpenSocialSettings)}>
          Social settings
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
          <div className="topbar-desktop-links">
            {onOpenShop ? (
              <button
                type="button"
                className="topbar-link"
                data-tutorial="shop"
                data-tutorial-current={tutorialCurrent("shop")}
                onClick={onOpenShop}
              >
                Shop
              </button>
            ) : (
              <Link href="/dashboard">Shop</Link>
            )}
            {onOpenCollection ? (
              <button
                type="button"
                className="topbar-link"
                data-tutorial="collection"
                data-tutorial-current={tutorialCurrent("collection")}
                onClick={onOpenCollection}
              >
                Collection
              </button>
            ) : (
              <Link href="/dashboard">Collection</Link>
            )}
            {onOpenInventory ? (
              <button
                type="button"
                className="topbar-link"
                data-tutorial="pets"
                data-tutorial-current={tutorialCurrent("pets")}
                onClick={onOpenInventory}
              >
                Pets
              </button>
            ) : (
              <Link href="/dashboard">Pets</Link>
            )}
            {onOpenAchievements ? (
              <button
                type="button"
                className="topbar-link"
                data-tutorial="achievements"
                data-tutorial-current={tutorialCurrent("achievements")}
                onClick={onOpenAchievements}
              >
                Achievements
              </button>
            ) : (
              <Link href="/dashboard">Achievements</Link>
            )}
            {onOpenSong ? (
              <button
                type="button"
                className="topbar-link"
                data-tutorial="song"
                data-tutorial-current={tutorialCurrent("song")}
                onClick={onOpenSong}
              >
                Song
              </button>
            ) : null}
            {onOpenFriends ? (
              <div
                className={socialPinned ? "topbar-menu is-pinned" : "topbar-menu"}
                data-tutorial="social"
                data-tutorial-current={tutorialCurrent("social")}
              >
                <button
                  type="button"
                  className="topbar-link"
                  aria-haspopup="menu"
                  aria-expanded={socialPinned}
                  onClick={onSocialClick}
                >
                  Social
                </button>
                <div className="topbar-menu-list" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="topbar-menu-item"
                    onClick={onOpenFriends}
                    aria-label={pendingFriendRequest ? "Friends, pending request" : undefined}
                  >
                    <span>Friends</span>
                    {pendingFriendRequest ? <span className="request-dot" aria-hidden="true" /> : null}
                  </button>
                  {onOpenFarmCrew ? (
                    <button type="button" role="menuitem" onClick={onOpenFarmCrew}>
                      FarmCrew
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" onClick={onOpenLeaderboard}>
                    Leaderboard
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="topbar-user">
        {onOpenSong ? (
          <button type="button" className="topbar-song" onClick={onOpenSong} aria-label="Song">
            <span aria-hidden="true">♪</span>
          </button>
        ) : null}
        <span className="streak-pill" title={streakLabel}>
          <span aria-hidden="true">🔥</span> {streakLabel}
        </span>
        {studyLabel ? (
          <span className="points-balance topbar-desktop">
            Study <span>{studyLabel}</span>
          </span>
        ) : null}
        <span className="topbar-name" title={displayName}>
          {displayName}
        </span>
        <div
          ref={settingsRef}
          className={settingsOpen ? "topbar-settings is-open" : "topbar-settings"}
        >
          <button
            type="button"
            className="topbar-settings-button topbar-desktop"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
            onClick={() => setSettingsOpen((value) => !value)}
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
        <HeaderMenu alert={pendingFriendRequest}>
          {onOpenShop ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenShop}>
              Shop
            </button>
          ) : (
            <Link href="/dashboard" className="topbar-drawer-link">
              Shop
            </Link>
          )}
          {onOpenCollection ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenCollection}>
              Collection
            </button>
          ) : (
            <Link href="/dashboard" className="topbar-drawer-link">
              Collection
            </Link>
          )}
          {onOpenInventory ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenInventory}>
              Pets
            </button>
          ) : (
            <Link href="/dashboard" className="topbar-drawer-link">
              Pets
            </Link>
          )}
          {onOpenAchievements ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenAchievements}>
              Achievements
            </button>
          ) : (
            <Link href="/dashboard" className="topbar-drawer-link">
              Achievements
            </Link>
          )}
          {onOpenSong ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenSong}>
              Song
            </button>
          ) : null}
          {onOpenFriends ? (
            <button
              type="button"
              className="topbar-drawer-link"
              onClick={onOpenFriends}
              aria-label={pendingFriendRequest ? "Friends, pending request" : undefined}
            >
              <span>Friends</span>
              {pendingFriendRequest ? <span className="request-dot" aria-hidden="true" /> : null}
            </button>
          ) : null}
          {onOpenFriends && onOpenFarmCrew ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenFarmCrew}>
              FarmCrew
            </button>
          ) : null}
          {onOpenFriends ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenLeaderboard}>
              Leaderboard
            </button>
          ) : null}
          {studyLabel ? (
            <p className="points-balance topbar-drawer-study">
              Study <span>{studyLabel}</span>
            </p>
          ) : null}
          {onOpenEditPlan ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenEditPlan}>
              Edit plan
            </button>
          ) : null}
          {onOpenDownload ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenDownload}>
              Download desktop pet
            </button>
          ) : null}
          <Link href="/privacy" className="topbar-drawer-link">
            Privacy
          </Link>
          {onOpenSocialSettings ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenSocialSettings}>
              Social settings
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
