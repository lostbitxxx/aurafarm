/** Reads aurafarm://pair and aurafarm://session links. */

function parseAurafarmLink(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "aurafarm:") return null;

  if (url.hostname === "pair") {
    const token = url.searchParams.get("token");
    if (!token) return null;
    return { kind: "pair", token };
  }

  if (url.hostname === "session") {
    const code = url.searchParams.get("code");
    if (!code || !/^[A-Za-z0-9]{4,32}$/.test(code)) return null;
    return { kind: "session", code };
  }

  return null;
}

module.exports = { parseAurafarmLink };
