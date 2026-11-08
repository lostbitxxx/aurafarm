import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function SiteHeader({ displayName }: { displayName: string }) {
  return (
    <header className="hud">
      <Link href="/dashboard" className="wordmark">
        Aurafarm
      </Link>
      <div className="hud-side">
        <div className="hud-stat" aria-hidden="true" />
        <div className="topbar-user">
          <Link href="/privacy">Privacy</Link>
          <span>{displayName}</span>
          <form action={signOut}>
            <button type="submit" className="button button-small button-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
