import { NextResponse } from "next/server";
import { parseClaimCode } from "@/lib/pet-device";
import { createSessionSecret, hashSecret } from "@/lib/scoring";
import { normalizeRestWeekdays, normalizeStudyWeekdays, weekPlanForProfile, type Weekday } from "@/lib/study-mode";
import { createAdminClient } from "@/lib/supabase/admin";
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
  color: string | null;
  hat: string | null;
  clothes: string | null;
  weekly_study_days: Weekday[] | null;
  weekly_rest_days: Weekday[] | null;
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

  const equipped = await readEquippedLook(row.session_id);

  return NextResponse.json({
    session_id: row.session_id,
    token,
    blocklist: row.blocklist,
    pet_type: equipped?.pet_type ?? row.pet_type,
    level: equipped?.level ?? row.level,
    close_blocked: row.close_blocked,
    planned_seconds: row.planned_seconds,
    started_at: row.started_at,
    color: equipped?.color ?? row.color,
    hat: equipped?.hat ?? row.hat,
    clothes: equipped?.clothes ?? row.clothes,
    weekly_study_days: equipped?.weekly_study_days ?? row.weekly_study_days,
    weekly_rest_days: equipped?.weekly_rest_days ?? row.weekly_rest_days,
  });
}

/**
 * The claim function may still be the older one, which returns the pet type and
 * level but not the outfit. The session row identifies the farmer, and the
 * service client can read that equipped pet without a desktop sign-in.
 */
async function readEquippedLook(sessionId: string): Promise<{
  pet_type: string | null;
  level: number | null;
  color: string | null;
  hat: string | null;
  clothes: string | null;
  weekly_study_days: Weekday[] | null;
  weekly_rest_days: Weekday[] | null;
} | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const session = await admin
    .from("study_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  const userId = typeof session.data?.user_id === "string" ? session.data.user_id : null;
  if (session.error || !userId) return null;

  const pet = await admin
    .from("user_pets")
    .select("pet_type, level, color, hat, clothes")
    .eq("user_id", userId)
    .eq("is_desktop_active", true)
    .maybeSingle();
  if (pet.error || !pet.data) return null;

  const profile = await readClaimProfile(admin, userId);
  const plan = weekPlanForProfile(profile);
  const level = Number(pet.data.level);

  return {
    pet_type: typeof pet.data.pet_type === "string" ? pet.data.pet_type : null,
    level: Number.isFinite(level) ? Math.floor(level) : null,
    color: optionalLook(pet.data.color),
    hat: optionalLook(pet.data.hat),
    clothes: optionalLook(pet.data.clothes),
    weekly_study_days: plan.studyDays.length > 0 ? plan.studyDays : null,
    weekly_rest_days: plan.studyDays.length > 0 ? plan.restDays : null,
  };
}

async function readClaimProfile(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
) {
  const full = await admin
    .from("profiles")
    .select("weekly_study_days, weekly_rest_days, behavior_answers, study_mode, preferred_session_minutes")
    .eq("id", userId)
    .maybeSingle();
  if (!full.error) return full.data;

  const noRest = await admin
    .from("profiles")
    .select("weekly_study_days, behavior_answers, study_mode, preferred_session_minutes")
    .eq("id", userId)
    .maybeSingle();
  if (!noRest.error) return noRest.data;

  const bare = await admin
    .from("profiles")
    .select("behavior_answers, study_mode, preferred_session_minutes")
    .eq("id", userId)
    .maybeSingle();
  return bare.error ? null : bare.data;
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
    color?: unknown;
    hat?: unknown;
    clothes?: unknown;
    weekly_study_days?: unknown;
    weekly_rest_days?: unknown;
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
    color: optionalLook(record.color),
    hat: optionalLook(record.hat),
    clothes: optionalLook(record.clothes),
    weekly_study_days: normalizeStudyWeekdays(weekdayEntries(record.weekly_study_days)),
    weekly_rest_days: normalizeRestWeekdays(weekdayEntries(record.weekly_rest_days)),
  };
}

function optionalLook(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

/** PostgREST usually sends integer[] as an array. A text form like "{1,2,5}" still counts. */
function weekdayEntries(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return value;
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
