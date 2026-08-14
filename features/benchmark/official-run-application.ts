import { NextResponse } from "next/server";

import type { OfficialBenchmarkRunAction } from "@/features/benchmark/official-run-contracts";
import {
  readOfficialBenchmarkRun,
  startOfficialBenchmarkRun,
} from "@/features/benchmark/official-run-service";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export async function GET() {
  return NextResponse.json(readOfficialBenchmarkRun());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const action = (await request.json()) as OfficialBenchmarkRunAction;
    if (!action || !["start", "resume"].includes(action.action)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported official benchmark run action." },
        { status: 400 },
      );
    }
    const origin = new URL(request.url).origin;
    const launched = startOfficialBenchmarkRun(action, origin);
    return NextResponse.json(
      { ...readOfficialBenchmarkRun(), launched },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Official benchmark run launch failed.",
      },
      { status: operatorAuthorizationStatus(error) || 409 },
    );
  }
}
