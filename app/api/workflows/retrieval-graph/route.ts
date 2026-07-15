import { NextResponse } from "next/server";
import { ensureRetrievalWorkflowDeployment, readRetrievalWorkflowEvidence } from "@/features/workflows/retrieval-graph";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readRetrievalWorkflowEvidence()); }
export async function POST() { const receipt = ensureRetrievalWorkflowDeployment(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readRetrievalWorkflowEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); }
