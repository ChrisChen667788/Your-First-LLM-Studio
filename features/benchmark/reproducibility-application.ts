import { NextResponse } from "next/server";

import {
  readMath500Reproducibility,
  replayLatestMath500Run,
} from "@/features/benchmark/reproducibility-service";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export async function GET() {
  return NextResponse.json(readMath500Reproducibility());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action && body.action !== "replay") {
      return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
    }
    const receipt = await replayLatestMath500Run();
    return NextResponse.json({
      ok: receipt.localStatus === "pass",
      receipt,
      evidence: readMath500Reproducibility(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "MATH-500 evaluator replay failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
