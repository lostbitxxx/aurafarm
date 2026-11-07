import { NextResponse } from "next/server";
import { petVersionPayload } from "@/lib/pet-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(petVersionPayload(process.env.NEXT_PUBLIC_PET_DOWNLOAD_URL));
}
