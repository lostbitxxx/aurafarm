import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./env";

export function createAdminClient() {
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;

  return createClient(getSupabaseUrl(), secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
