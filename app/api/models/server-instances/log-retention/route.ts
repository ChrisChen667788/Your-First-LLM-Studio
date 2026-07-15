import { NextResponse } from "next/server";
import { readServerLogRetentionEvidence, rehearseServerLogRetention } from "@/features/models/server-log-retention";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readServerLogRetentionEvidence()); }
export async function POST() { const receipt = rehearseServerLogRetention(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readServerLogRetentionEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
