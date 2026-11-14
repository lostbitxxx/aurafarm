"use client";

import Link from "next/link";
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
  pendingFriendRequest = false,
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
}) {
  const streakLabel = streakPillLabel(streakCount);
  const studyLabel = typeof studySeconds === "number" ? formatDuration(studySeconds) : null;
  return (
    <header className="topbar">
      <div className="topbar-nav">
        <Link href="/dashboard" className="wordmark">
          Aurafarm
        </Link>
        <div className="topbar-desktop-links">
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
          {onOpenSong ? (
            <button type="button" className="topbar-link" onClick={onOpenSong}>
              Song
            </button>
          ) : null}
          {onOpenFriends ? (
            <div className="topbar-menu">
              <button type="button" className="topbar-link" aria-haspopup="menu">
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
        <Link href="/privacy" className="topbar-desktop">
          Privacy
        </Link>
        <span className="topbar-name" title={displayName}>
          {displayName}
        </span>
        <form action={signOut} className="topbar-desktop">
          <button type="submit" className="button button-small button-ghost">
            Sign out
          </button>
        </form>
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
          {onOpenFriends && onOpenSocialSettings ? (
            <button type="button" className="topbar-drawer-link" onClick={onOpenSocialSettings}>
              Social Settings
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
          <Link href="/privacy" className="topbar-drawer-link">
            Privacy
          </Link>
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
