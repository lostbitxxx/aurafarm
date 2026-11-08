import { petDownloadUrl } from "./pet-device";

export function petConfigPayload(urlValue: string | undefined, keyValue: string | undefined) {
  const supabaseUrl = petDownloadUrl(urlValue)?.replace(/\/$/, "") ?? "";
  const publishableKey = typeof keyValue === "string" ? keyValue.trim() : "";
  if (!supabaseUrl || !publishableKey || /\s/.test(publishableKey)) {
    return { supabase_url: "", supabase_publishable_key: "" };
  }
  return {
    supabase_url: supabaseUrl,
    supabase_publishable_key: publishableKey,
  };
}
