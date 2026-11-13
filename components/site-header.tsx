"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { STREAK_LABEL } from "@/lib/pet-assets";
import { formatDuration } from "@/lib/study";

export function SiteHeader({
  displayName,
  studySeconds,
  onOpenShop,
  onOpenCollection,
  onOpenInventory,
  onOpenAchievements,
}: {
  displayName: string;
  studySeconds?: number;
  onOpenShop?: () => void;
  onOpenCollection?: () => void;
  onOpenInventory?: () => void;
  onOpenAchievements?: () => void;
}) {
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
            Inventory
          </button>
        ) : (
          <Link href="/dashboard">Inventory</Link>
        )}
        {onOpenAchievements ? (
          <button type="button" className="topbar-link" onClick={onOpenAchievements}>
            Achievements
          </button>
        ) : (
          <Link href="/dashboard">Achievements</Link>
        )}
      </div>
      <div className="topbar-user">
        <span className="streak-pill" title={STREAK_LABEL}>
          <span aria-hidden="true">🔥</span> {STREAK_LABEL}
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
