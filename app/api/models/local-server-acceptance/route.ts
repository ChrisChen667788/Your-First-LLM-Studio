import { NextResponse } from "next/server";
import {
  readLocalServerAcceptanceEvidence,
  runLocalServerAcceptance,
} from "@/features/models/local-server-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readLocalServerAcceptanceEvidence());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      model?: string;
    };
    const receipt = await runLocalServerAcceptance(body);
    return NextResponse.json(
      {
        ok: receipt.status === "pass",
        receipt,
        evidence: readLocalServerAcceptanceEvidence(),
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
            : "Local Server acceptance failed.",
      },
      { status: 400 },
    );
  }
}
