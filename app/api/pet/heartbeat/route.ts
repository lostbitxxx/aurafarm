import { NextResponse } from "next/server";
import { readBearerToken } from "@/lib/pet-device";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Heartbeat rejected." }, { status: 403 });
  }

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("touch_pet_device", { raw_token: token });
  if (error) {
    return NextResponse.json({ error: "Heartbeat rejected." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
