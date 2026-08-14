import { NextResponse } from "next/server";
import {
  readLangGraphShadowEvidence,
  runLangGraphProtectedToolShadow,
} from "@/features/workflows/langgraph-shadow-service";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readLangGraphShadowEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      approve?: boolean;
    };
    const receipt = await runLangGraphProtectedToolShadow(body);
    return NextResponse.json(
      { ok: receipt.status === "pass", receipt, evidence: readLangGraphShadowEvidence() },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Shadow graph failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
