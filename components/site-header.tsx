"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { streakPillLabel } from "@/lib/pet-assets";
import { formatDuration } from "@/lib/study";

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
  pendingFriendRequest?: boolean;
  tutorialTarget?: string | null;
  socialPinned?: boolean;
  onSocialClick?: () => void;
}) {
  const streakLabel = streakPillLabel(streakCount);
  const tutorialCurrent = (target: string) => (tutorialTarget === target ? "true" : undefined);
  return (
    <header className="topbar">
      <div className="topbar-nav">
        <Link href="/dashboard" className="wordmark">
          Aurafarm
        </Link>
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
              {onOpenSocialSettings ? (
                <button type="button" role="menuitem" onClick={onOpenSocialSettings}>
                  Social Settings
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={onOpenLeaderboard}>
                Leaderboard
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="topbar-user">
        <span className="streak-pill" title={streakLabel}>
          <span aria-hidden="true">🔥</span> {streakLabel}
        </span>
        {typeof studySeconds === "number" ? (
          <span className="points-balance">
            Study <span>{formatDuration(studySeconds)}</span>
          </span>
        ) : null}
        <Link href="/privacy">Privacy</Link>
        <span>{displayName}</span>
        <form action={signOut}>
          <button type="submit" className="button button-small button-ghost">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
