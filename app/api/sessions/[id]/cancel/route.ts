import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = new URL(request.url).origin;
  const dashboard = `${origin}/dashboard`;
  const { id } = await context.params;
  if (!sessionIdPattern.test(id) || !isSupabaseConfigured()) {
    return NextResponse.redirect(dashboard);
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { error } = await supabase.rpc("cancel_study_session", {
    target_session_id: id,
  });
  if (error && !/session not found/i.test(error.message)) {
    console.error(`[score] cancel ${id} failed: ${error.message}`);
    return NextResponse.redirect(dashboard);
  }

  revalidatePath("/dashboard");
  return NextResponse.redirect(dashboard);
}
