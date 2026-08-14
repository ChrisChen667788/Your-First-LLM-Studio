import { NextResponse } from "next/server";

import type { BenchmarkQualificationAction } from "@/features/benchmark/qualification-contracts";
import {
  qualifyMath500Snapshot,
  readBenchmarkQualification,
  reverifyMath500Snapshot,
} from "@/features/benchmark/qualification-service";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export async function GET() {
  try {
    return NextResponse.json(readBenchmarkQualification());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to read benchmark qualification evidence.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json()) as Partial<BenchmarkQualificationAction>;
    if (body.action === "qualify") {
      await qualifyMath500Snapshot();
    } else if (body.action === "reverify") {
      reverifyMath500Snapshot();
    } else {
      return NextResponse.json(
        { ok: false, error: "Unsupported benchmark qualification action." },
        { status: 400 },
      );
    }
    return NextResponse.json(readBenchmarkQualification());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to qualify benchmark snapshot.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
