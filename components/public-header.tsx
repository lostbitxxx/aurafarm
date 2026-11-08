import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Aurafarm
      </Link>
      <nav className="topbar-nav" aria-label="Account">
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="button button-small">
          Create account
        </Link>
      </nav>
    </header>
  );
}
