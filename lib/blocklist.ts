export function labelForBlockedHost(
  host: string,
  entries: readonly { host: string; label: string }[],
) {
  const match = entries.find((entry) => hostMatchesBlocklist(host, [entry.host]));
  return match?.label ?? host;
}

export function hostMatchesBlocklist(host: string, blockedHosts: readonly string[]) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;

  return blockedHosts.some((blocked) => {
    const rule = normalizeHost(blocked);
    if (!rule) return false;
    return normalized === rule || normalized.endsWith(`.${rule}`);
  });
}

function normalizeHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || /[\s/:]/.test(normalized)) return "";
  return normalized;
}
