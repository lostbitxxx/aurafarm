import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function PublicHeader({
  account,
}: {
  account?: { displayName: string } | null;
} = {}) {
  return (
    <header className="topbar">
      <Link href={account ? "/dashboard" : "/"} className="wordmark">
        Aurafarm
      </Link>
      {account ? (
        <div className="topbar-user">
          <span>{account.displayName}</span>
          <form action={signOut}>
            <button type="submit" className="button button-small button-ghost">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <nav className="topbar-nav" aria-label="Account">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="button button-small">
            Create account
          </Link>
        </nav>
      )}
    </header>
  );
}
