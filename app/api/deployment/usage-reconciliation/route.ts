import { NextResponse } from "next/server";
import { readUsageReconciliationEvidence, reconcileServerUsageToOutbox } from "@/features/deployment/usage-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readUsageReconciliationEvidence()); }
export async function POST(request: Request) { try { const body = await request.json().catch(() => ({})) as { operatorId?: string; tenantId?: string }; const receipt = reconcileServerUsageToOutbox(body); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readUsageReconciliationEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Usage reconciliation failed." }, { status: 400 }); } }
