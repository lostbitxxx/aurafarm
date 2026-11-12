import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { formatDuration } from "@/lib/study";

export function SiteHeader({
  displayName,
  studySeconds,
}: {
  displayName: string;
  studySeconds?: number;
}) {
  return (
    <header className="topbar">
      <div className="topbar-nav">
        <Link href="/dashboard" className="wordmark">
          Aurafarm
        </Link>
        <Link href="/shop">Shop</Link>
        <Link href="/inventory">Inventory</Link>
      </div>
      <div className="topbar-user">
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
