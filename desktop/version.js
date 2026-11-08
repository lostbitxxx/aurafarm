/** Compares the running pet with the version published by the desk. */

function versionParts(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.trim().split(".");
  const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : null));
  if (numbers.some((part) => part === null)) return null;
  return numbers;
}

function isNewerVersion(remote, local) {
  const next = versionParts(remote);
  const current = versionParts(local);
  if (!next || !current) return false;
  const length = Math.max(next.length, current.length);
  for (let index = 0; index < length; index += 1) {
    const published = next[index] ?? 0;
    const installed = current[index] ?? 0;
    if (published > installed) return true;
    if (published < installed) return false;
  }
  return false;
}

function updateOffer(localVersion, body) {
  if (!body || typeof body !== "object") return null;
  const version = body.version;
  const downloadUrl = body.download_url;
  if (typeof version !== "string" || !isNewerVersion(version, localVersion)) return null;
  if (typeof downloadUrl !== "string" || !downloadUrl) return null;
  try {
    const url = new URL(downloadUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { version, url: url.toString() };
  } catch {
    return null;
  }
}

module.exports = {
  isNewerVersion,
  updateOffer,
};
