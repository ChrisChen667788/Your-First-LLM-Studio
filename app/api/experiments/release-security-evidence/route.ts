import { NextResponse } from "next/server";
import {
  applyReleaseSecurityEvidenceRetention,
  readReleaseSecurityEvidence,
} from "@/features/experiments/release-security-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    evidence: readReleaseSecurityEvidence(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    retention?: { maxReports?: number; maxAgeDays?: number };
  };
  if (body.action !== "apply-retention") {
    return NextResponse.json(
      { ok: false, error: "Unsupported release security evidence action." },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok: true,
    retention: applyReleaseSecurityEvidenceRetention(body.retention),
    evidence: readReleaseSecurityEvidence(),
  });
}
