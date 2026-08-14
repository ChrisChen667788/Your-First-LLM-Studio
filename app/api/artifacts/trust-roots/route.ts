import { NextResponse } from "next/server";

import {
  readArtifactPublisherTrustRegistry,
  registerArtifactPublisherTrustRoot,
  revokeArtifactPublisherTrustRoot,
} from "@/features/artifacts/publisher-trust-registry";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readArtifactPublisherTrustRegistry());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const root = body.action === "revoke"
      ? revokeArtifactPublisherTrustRoot({
          publisher: String(body.publisher || ""),
          keyId: String(body.keyId || ""),
          reason: String(body.reason || ""),
        })
      : registerArtifactPublisherTrustRoot({
          publisher: String(body.publisher || ""),
          keyId: String(body.keyId || ""),
          publicKeyPem: String(body.publicKeyPem || ""),
          validFrom: typeof body.validFrom === "string" ? body.validFrom : undefined,
          validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined,
        });
    return NextResponse.json({ ok: true, root, registry: readArtifactPublisherTrustRegistry() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Artifact trust action failed." },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
