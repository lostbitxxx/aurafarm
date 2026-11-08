export function requiresAccount(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname === "/inventory" ||
    pathname.startsWith("/inventory/")
  );
}
