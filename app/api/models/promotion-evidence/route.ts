import { NextResponse } from "next/server";
import { buildModelHubPromotionEvidence } from "@/features/models/model-hub-promotion-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildModelHubPromotionEvidence());
}
