import { NextResponse } from "next/server";

import { readPostV1PromotionGate } from "@/features/experiments/post-v1-promotion-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPostV1PromotionGate());
}
