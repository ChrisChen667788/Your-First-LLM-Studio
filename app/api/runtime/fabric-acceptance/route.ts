import { NextResponse } from "next/server";
import {
  readRuntimeFabricAcceptanceEvidence,
  runRuntimeFabricAcceptance,
} from "@/features/runtime/runtime-fabric-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readRuntimeFabricAcceptanceEvidence());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Parameters<
      typeof runRuntimeFabricAcceptance
    >[0];
    const receipt = await runRuntimeFabricAcceptance(body);
    return NextResponse.json(
      {
        ok: receipt.status === "pass",
        receipt,
        evidence: readRuntimeFabricAcceptanceEvidence(),
      },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Runtime Fabric acceptance failed.",
      },
      { status: 400 },
    );
  }
}
