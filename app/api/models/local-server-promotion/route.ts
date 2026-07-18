import { NextResponse } from "next/server";
import { buildLocalServerPromotionEvidence } from "@/features/models/local-server-promotion-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildLocalServerPromotionEvidence());
}
