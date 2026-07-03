import { NextResponse } from "next/server";
import { readReleaseEvidenceMatrix } from "@/features/experiments/release-evidence-matrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readReleaseEvidenceMatrix());
}
