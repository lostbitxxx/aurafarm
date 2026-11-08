import { NextResponse } from "next/server";
import {
  buildPairLaunchUrl,
  createDeviceToken,
  deviceLabel,
  hashDeviceToken,
} from "@/lib/pet-device";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims.sub) {
    return NextResponse.json({ error: "Sign in to pair a pet." }, { status: 401 });
  }

  let label = deviceLabel(undefined);
  const text = await request.text();
  if (text.trim()) {
    try {
      const body = JSON.parse(text) as { label?: unknown };
      label = deviceLabel(body.label);
    } catch {
      return NextResponse.json({ error: "The pair body must be JSON." }, { status: 400 });
    }
  }

  const token = createDeviceToken();
  const { error } = await supabase.rpc("pair_pet_device", {
    token_hash: hashDeviceToken(token),
    label,
  });

  if (error) {
    return NextResponse.json({ error: "The pet could not be paired." }, { status: 400 });
  }

  return NextResponse.json({
    token,
    url: buildPairLaunchUrl(token),
  });
}
