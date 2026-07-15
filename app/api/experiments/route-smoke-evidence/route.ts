import { NextResponse } from "next/server";
import { readRouteSmokeEvidence } from "@/features/experiments/route-smoke-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    evidence: readRouteSmokeEvidence(),
  });
}
