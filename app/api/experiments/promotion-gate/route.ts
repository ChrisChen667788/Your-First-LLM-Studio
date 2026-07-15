import { NextResponse } from "next/server";
import { readPromotionGate } from "@/features/experiments/promotion-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPromotionGate());
}
