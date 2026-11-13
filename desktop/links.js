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

function sessionCodeFromPaste(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const linked = parseAurafarmLink(trimmed);
  if (linked?.code) return linked.code;
  if (!trimmed || trimmed.startsWith("{")) return "";
  return trimmed;
}

module.exports = { parseAurafarmLink, sessionCodeFromPaste };
