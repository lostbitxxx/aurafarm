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
  onOpenSocialSettings,
}: {
  displayName: string;
  studySeconds?: number;
  streakCount?: number;
  onOpenShop?: () => void;
  onOpenCollection?: () => void;
  onOpenInventory?: () => void;
  onOpenAchievements?: () => void;
  onOpenFriends?: () => void;
  onOpenSocialSettings?: () => void;
}) {
  const streakLabel = streakPillLabel(streakCount);
  return (
    <header className="topbar">
      <div className="topbar-nav">
        <Link href="/dashboard" className="wordmark">
          Aurafarm
        </Link>
        {onOpenShop ? (
          <button type="button" className="topbar-link" onClick={onOpenShop}>
            Shop
          </button>
        ) : (
          <Link href="/dashboard">Shop</Link>
        )}
        {onOpenCollection ? (
          <button type="button" className="topbar-link" onClick={onOpenCollection}>
            Collection
          </button>
        ) : (
          <Link href="/dashboard">Collection</Link>
        )}
        {onOpenInventory ? (
          <button type="button" className="topbar-link" onClick={onOpenInventory}>
            Pets
          </button>
        ) : (
          <Link href="/dashboard">Pets</Link>
        )}
        {onOpenAchievements ? (
          <button type="button" className="topbar-link" onClick={onOpenAchievements}>
            Achievements
          </button>
        ) : (
          <Link href="/dashboard">Achievements</Link>
        )}
        {onOpenFriends ? (
          <div className="topbar-menu">
            <button type="button" className="topbar-link" aria-haspopup="menu">
              Social
            </button>
            <div className="topbar-menu-list" role="menu">
              <button type="button" role="menuitem" onClick={onOpenFriends}>
                Friends
              </button>
              {onOpenSocialSettings ? (
                <button type="button" role="menuitem" onClick={onOpenSocialSettings}>
                  Social Settings
                </button>
              ) : null}
              <button type="button" role="menuitem">
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
