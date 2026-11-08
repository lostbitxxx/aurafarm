import { connection, NextResponse } from "next/server";
import { petVersionPayload } from "@/lib/pet-version";

export async function GET() {
  await connection();
  return NextResponse.json(petVersionPayload(process.env.NEXT_PUBLIC_PET_DOWNLOAD_URL));
}
