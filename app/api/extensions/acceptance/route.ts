import { NextResponse } from "next/server";
import {
  readExtensionEcosystemAcceptanceEvidence,
  runExtensionEcosystemAcceptance,
} from "@/features/extensions/extension-ecosystem-acceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readExtensionEcosystemAcceptanceEvidence());
}

export async function POST() {
  try {
    const receipt = await runExtensionEcosystemAcceptance();
    return NextResponse.json(
      {
        ok: receipt.status === "pass",
        receipt,
        evidence: readExtensionEcosystemAcceptanceEvidence(),
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
            : "Extension ecosystem acceptance failed.",
        evidence: readExtensionEcosystemAcceptanceEvidence(),
      },
      { status: 422 },
    );
  }
}
