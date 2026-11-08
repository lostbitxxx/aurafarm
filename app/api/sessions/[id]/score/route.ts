import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { buildScoreResult, hashSecret, parseScoreRequest } from "@/lib/scoring";
import { createAnonClient } from "@/lib/supabase/anon";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScoreRow = { points: number; distracted: boolean };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  const { id } = await context.params;
  if (!sessionIdPattern.test(id)) {
    return NextResponse.json({ error: "Score rejected." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The score body must be JSON." }, { status: 400 });
  }

  const parsed = parseScoreRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("submit_study_score", {
    target_session_id: id,
    raw_token: parsed.token,
    duration_seconds: parsed.durationSeconds,
    blocked_count: parsed.blockedCount,
    blocked_hosts: parsed.blockedHosts,
  });

  if (error) {
    const alreadySubmitted =
      isAlreadySubmitted(error.message) || (await tokenMatchesSubmittedSession(id, parsed.token));
    if (alreadySubmitted) {
      return NextResponse.json({ error: "That session was already scored." }, { status: 409 });
    }
    return NextResponse.json({ error: "Score rejected." }, { status: 403 });
  }

  const row = firstScoreRow(data);
  if (!row) {
    return NextResponse.json({ error: "Score rejected." }, { status: 403 });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/sessions/${id}`);
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildScoreResult(origin, id, row.points, row.distracted));
}

function isAlreadySubmitted(message: string) {
  return /already submitted/i.test(message);
}

function firstScoreRow(data: unknown): ScoreRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as { points?: unknown; distracted?: unknown };
  if (typeof record.points !== "number" || typeof record.distracted !== "boolean") return null;
  return { points: record.points, distracted: record.distracted };
}

async function tokenMatchesSubmittedSession(sessionId: string, token: string) {
  const admin = createAdminClient();
  if (!admin) return false;

  const { data, error } = await admin
    .from("study_sessions")
    .select("status, session_token_hash")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return false;
  return data.status === "submitted" && data.session_token_hash === hashSecret(token);
}
