import { NextResponse } from "next/server";
import {
  ProviderOpsEvidenceApplicationError,
  readProviderOpsEvidenceApplication,
  runProviderOpsEvidenceAction,
  type ProviderOpsEvidenceActionInput,
} from "@/features/providers/evidence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const windowHours = Number(
    new URL(request.url).searchParams.get("windowHours") || 24,
  );
  return NextResponse.json(readProviderOpsEvidenceApplication(windowHours));
}

export async function POST(request: Request) {
  let body: ProviderOpsEvidenceActionInput;
  try {
    body = (await request.json()) as ProviderOpsEvidenceActionInput;
  } catch {
    return NextResponse.json(
      { error: "A JSON request body is required." },
      { status: 400 },
    );
  }
  try {
    const result = await runProviderOpsEvidenceAction(body);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    const status = error instanceof ProviderOpsEvidenceApplicationError
      ? error.status
      : 400;
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Provider evidence action failed.",
      },
      { status },
    );
  }
}
