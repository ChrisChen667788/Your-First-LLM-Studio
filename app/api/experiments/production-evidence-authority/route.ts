import { NextResponse } from "next/server";

import { readProductionEvidenceAuthority } from "@/features/experiments/production-evidence-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readProductionEvidenceAuthority());
}
