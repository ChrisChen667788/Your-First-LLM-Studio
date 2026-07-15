import { NextResponse } from "next/server";
import { readPublicReleaseEvidence } from "@/features/experiments/public-release-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readPublicReleaseEvidence());
}
