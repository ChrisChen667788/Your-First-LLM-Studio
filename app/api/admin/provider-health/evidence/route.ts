import { NextResponse } from "next/server";
import { readProviderOpsEvidenceSummary } from "@/features/providers/provider-ops-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowHours = Number(searchParams.get("windowHours") || 24);
  return NextResponse.json({
    ok: true,
    summary: readProviderOpsEvidenceSummary({
      windowHours: Number.isFinite(windowHours) ? windowHours : 24,
    }),
  });
}
