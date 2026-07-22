import { NextResponse } from "next/server";
import { buildWorkflowStudioPromotionEvidence } from "@/features/workflows/studio-promotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildWorkflowStudioPromotionEvidence());
}
