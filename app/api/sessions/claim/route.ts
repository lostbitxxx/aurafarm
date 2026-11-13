import { NextResponse } from "next/server";
import { acceptedClaimRow, parseClaimCode } from "@/lib/pet-device";
import { createSessionSecret, hashSecret } from "@/lib/scoring";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The claim body must be JSON." }, { status: 400 });
  }

  const parsed = parseClaimCode(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const token = createSessionSecret();
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("claim_study_session", {
    raw_code: parsed.code,
    token_hash: hashSecret(token),
  });

  if (error) {
    console.error(`[claim] rejected: ${error.message}`);
    return NextResponse.json({ error: "Claim rejected." }, { status: 403 });
  }

  const row = acceptedClaimRow(data);
  if (!row) {
    console.error("[claim] rejected: the database returned no usable claim row");
    return NextResponse.json({ error: "Claim rejected." }, { status: 403 });
  }

  return NextResponse.json({
    session_id: row.sessionId,
    token,
    blocklist: row.blocklist,
    pet_type: row.petType,
    level: row.level,
    close_blocked: row.closeBlocked,
    planned_seconds: row.plannedSeconds,
    started_at: row.startedAt,
    claimed_at: row.claimedAt,
  });
}
