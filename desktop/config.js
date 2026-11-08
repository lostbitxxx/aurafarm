function readPetConfig(body) {
  if (!body || typeof body !== "object") return null;
  const url = typeof body.supabase_url === "string" ? body.supabase_url.trim() : "";
  const key = typeof body.supabase_publishable_key === "string" ? body.supabase_publishable_key.trim() : "";
  if (!url || !key || /\s/.test(key)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/$/, ""), key };
}

module.exports = { readPetConfig };
