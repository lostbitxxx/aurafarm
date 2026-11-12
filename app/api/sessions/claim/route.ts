import { NextResponse } from "next/server";
import { parseClaimCode } from "@/lib/pet-device";
import { createSessionSecret, hashSecret } from "@/lib/scoring";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type ClaimRow = {
  session_id: string;
  pet_type: string;
  level: number;
  blocklist: string[];
  close_blocked: boolean;
  planned_seconds: number;
  started_at: string;
};

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
    return NextResponse.json({ error: "Claim rejected." }, { status: 403 });
  }

  const row = firstClaimRow(data);
  if (!row) {
    return NextResponse.json({ error: "Claim rejected." }, { status: 403 });
  }

  return NextResponse.json({
    session_id: row.session_id,
    token,
    blocklist: row.blocklist,
    pet_type: row.pet_type,
    level: row.level,
    close_blocked: row.close_blocked,
    planned_seconds: row.planned_seconds,
    started_at: row.started_at,
  });
}

function firstClaimRow(data: unknown): ClaimRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as {
    session_id?: unknown;
    pet_type?: unknown;
    level?: unknown;
    blocklist?: unknown;
    close_blocked?: unknown;
    planned_seconds?: unknown;
    started_at?: unknown;
  };
  if (typeof record.session_id !== "string" || typeof record.pet_type !== "string") return null;
  if (typeof record.level !== "number" || typeof record.planned_seconds !== "number") return null;
  if (typeof record.started_at !== "string") return null;
  const blocklist = Array.isArray(record.blocklist)
    ? record.blocklist.filter((host): host is string => typeof host === "string")
    : [];
  return {
    session_id: record.session_id,
    pet_type: record.pet_type,
    level: record.level,
    blocklist,
    close_blocked: record.close_blocked === true,
    planned_seconds: record.planned_seconds,
    started_at: record.started_at,
  };
}
