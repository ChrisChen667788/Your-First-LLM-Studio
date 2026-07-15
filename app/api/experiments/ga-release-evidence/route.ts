import { NextResponse } from "next/server";
import {
  GaReleaseEvidenceApplicationError,
  readGaReleaseEvidenceApplication,
  runGaReleaseEvidenceAction,
  type GaReleaseEvidenceActionInput,
} from "@/features/experiments/ga-release-evidence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readGaReleaseEvidenceApplication());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as
    GaReleaseEvidenceActionInput;
  try {
    const result = runGaReleaseEvidenceAction(body);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "GA release evidence action failed.",
      },
      {
        status: error instanceof GaReleaseEvidenceApplicationError
          ? error.status
          : 400,
      },
    );
  }
}
