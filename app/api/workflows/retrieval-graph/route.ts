import { NextResponse } from "next/server";
import { ensureRetrievalWorkflowDeployment, readRetrievalWorkflowEvidence } from "@/features/workflows/retrieval-graph";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readRetrievalWorkflowEvidence()); }
export async function POST(request: Request) { try { assertTrustedOperatorRequest(request); const receipt = ensureRetrievalWorkflowDeployment(); return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readRetrievalWorkflowEvidence() }, { status: receipt.status === "pass" ? 200 : 422 }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Retrieval workflow deployment failed." }, { status: operatorAuthorizationStatus(error) }); } }
