import { connection, NextResponse } from "next/server";
import { petConfigPayload } from "@/lib/pet-config";

export async function GET() {
  await connection();
  return NextResponse.json(
    petConfigPayload(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  );
}
