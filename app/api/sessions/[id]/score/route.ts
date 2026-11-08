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
    const session = await readScoreSession(id);
    const alreadySubmitted =
      isAlreadySubmitted(error.message) ||
      (session?.status === "submitted" && session.tokenHash === hashSecret(parsed.token));
    if (alreadySubmitted) {
      console.error(`[score] ${id} already submitted`);
      return NextResponse.json({ error: "That session was already scored." }, { status: 409 });
    }
    console.error(`[score] ${id} rejected: ${error.message} | ${session?.line ?? "status unknown"}${scoreRejectionHint(session)}`);
    return NextResponse.json({ error: "Score rejected." }, { status: 403 });
  }

  const row = firstScoreRow(data);
  if (!row) {
    console.error(`[score] ${id} rejected: the database returned no score row`);
    return NextResponse.json({ error: "Score rejected." }, { status: 403 });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/sessions/${id}`);
  revalidatePath("/shop");
  revalidatePath("/inventory");
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildScoreResult(origin, id, row.points, row.distracted));
}

function isAlreadySubmitted(message: string) {
  return /already submitted/i.test(message);
}

type ScoreSession = {
  status: string;
  tokenHash: string;
  line: string;
};

function scoreRejectionHint(session: ScoreSession | null) {
  if (!session) return "";
  if (session.status === "cancelled") {
    return " | A cancelled session cannot be scored.";
  }
  if (session.status === "active" && session.tokenHash) {
    return " | The token in this request does not match the claim.";
  }
  if (session.status === "active") {
    return " | The session was never claimed.";
  }
  return "";
}

async function readScoreSession(sessionId: string): Promise<ScoreSession | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("study_sessions")
    .select("status, claimed_at, ended_at, session_token_hash")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  const tokenHash = typeof data.session_token_hash === "string" ? data.session_token_hash : "";
  return {
    status: String(data.status),
    tokenHash,
    line: `status=${data.status} has_token=${tokenHash.length > 0} claimed_at=${data.claimed_at ?? "null"} ended_at=${data.ended_at ?? "null"}`,
  };
}

function firstScoreRow(data: unknown): ScoreRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as { points?: unknown; distracted?: unknown };
  if (typeof record.points !== "number" || typeof record.distracted !== "boolean") return null;
  return { points: record.points, distracted: record.distracted };
}

