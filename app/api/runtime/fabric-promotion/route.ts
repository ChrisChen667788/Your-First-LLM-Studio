import { NextResponse } from "next/server";
import { buildRuntimeFabricPromotionEvidence } from "@/features/runtime/runtime-fabric-promotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildRuntimeFabricPromotionEvidence());
}
