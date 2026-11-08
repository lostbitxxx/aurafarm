import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function SiteHeader({
  displayName,
  points,
}: {
  displayName: string;
  points: number;
}) {
  const shown = Number.isFinite(points) ? Math.trunc(points) : 0;
  return (
    <header className="topbar">
      <Link href="/dashboard" className="wordmark">
        Aurafarm
      </Link>
      <div className="topbar-user">
        <span className="points-balance">
          Points <span>{shown}</span>
        </span>
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
