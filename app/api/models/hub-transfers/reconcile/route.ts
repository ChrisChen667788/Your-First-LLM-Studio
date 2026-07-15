import { NextResponse } from "next/server";
import { readHubSessionReconciliationEvidence, reconcileHubTransferSessions } from "@/features/models/hub-session-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readHubSessionReconciliationEvidence()); }
export async function POST() { const receipt = reconcileHubTransferSessions(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readHubSessionReconciliationEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
