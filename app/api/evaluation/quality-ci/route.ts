import { NextResponse } from "next/server";

import {
  evaluateQualityCiGate,
  readQualityCiGateEvidence,
  runQualityCiGateRehearsal,
  type QualityCiGateInput,
} from "@/features/evaluation/quality-ci-gate";
import {
  bindQualityCiToRealArtifacts,
  readQualityArtifactBindingEvidence,
} from "@/features/evaluation/quality-artifact-binding";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...readQualityCiGateEvidence(),
    artifactBinding: readQualityArtifactBindingEvidence(),
  });
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as Partial<QualityCiGateInput> & {
      action?: "bind-artifacts";
    };
    if (body.action === "bind-artifacts") {
      const receipt = bindQualityCiToRealArtifacts();
      return NextResponse.json(
        {
          ok: receipt.status === "pass",
          receipt,
          evidence: readQualityArtifactBindingEvidence(),
        },
        { status: receipt.status === "pass" ? 200 : 422 },
      );
    }
    const receipt = body.baselineId
      ? evaluateQualityCiGate(body as QualityCiGateInput)
      : runQualityCiGateRehearsal();
    return NextResponse.json(
      { ok: receipt.status === "pass", receipt, evidence: readQualityCiGateEvidence() },
      { status: receipt.status === "pass" ? 200 : receipt.status === "invalid" ? 400 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Quality CI gate failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
