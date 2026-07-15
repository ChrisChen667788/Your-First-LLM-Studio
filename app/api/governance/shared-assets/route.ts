import { NextResponse } from "next/server";
import { readSharedAssetAuditEvidence, rehearseSharedAssetAudit } from "@/features/governance/shared-asset-audit";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readSharedAssetAuditEvidence()); }
export async function POST() { const receipt = rehearseSharedAssetAudit(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readSharedAssetAuditEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
