/** Reads aurafarm://session links. */

function parseAurafarmLink(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "aurafarm:") return null;

  if (url.hostname === "session") {
    const code = url.searchParams.get("code");
    if (!code || !/^[A-Za-z0-9]{4,32}$/.test(code)) return null;
    return { kind: "session", code };
  }

  return null;
}

function launchLinksFromArgs(argv) {
  if (!Array.isArray(argv)) return [];
  const links = [];
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    if (arg.startsWith("--aurafarm-link=")) links.push(arg.slice("--aurafarm-link=".length));
    else if (arg.startsWith("aurafarm://")) links.push(arg);
  }
  return links;
}

module.exports = { launchLinksFromArgs, parseAurafarmLink };
