import { NextResponse } from "next/server";

import {
  readFineTuneQualityExportEvidence,
  runFineTuneQualityExportAcceptance,
} from "@/features/finetune/quality-export-acceptance";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readFineTuneQualityExportEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const receipt = runFineTuneQualityExportAcceptance();
    return NextResponse.json(
      {
        ok: receipt.localStatus === "pass",
        receipt,
        evidence: readFineTuneQualityExportEvidence(),
      },
      { status: receipt.localStatus === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "v1.6.9 Fine-tune quality/export acceptance failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
