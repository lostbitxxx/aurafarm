export function requiresAccount(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname === "/inventory" ||
    pathname.startsWith("/inventory/") ||
    pathname === "/customize" ||
    pathname.startsWith("/customize/") ||
    pathname.startsWith("/farmcrew/")
  );
}
