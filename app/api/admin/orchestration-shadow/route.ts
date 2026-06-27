import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "shadow",
    evidence: [],
    summary: {
      protectedToolRuns: 0,
      resumedRuns: 0,
      duplicateSideEffects: 0,
      lastUpdated: new Date().toISOString()
    }
  });
}
