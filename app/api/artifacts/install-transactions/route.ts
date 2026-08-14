import { NextResponse } from "next/server";

import {
  changeArtifactActivation,
  installTrustedArtifact,
  readArtifactInstallTransactions,
} from "@/features/artifacts/install-transaction";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readArtifactInstallTransactions());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const receipt = body.action === "activate" || body.action === "rollback" || body.action === "uninstall"
      ? changeArtifactActivation({
          artifactId: String(body.artifactId || ""),
          version: String(body.version || ""),
          action: body.action,
        })
      : installTrustedArtifact(body as unknown as Parameters<typeof installTrustedArtifact>[0]);
    return NextResponse.json(
      { ok: receipt.status === "pass", receipt, evidence: readArtifactInstallTransactions() },
      { status: receipt.status === "pass" ? 200 : 422 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Artifact install transaction failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
