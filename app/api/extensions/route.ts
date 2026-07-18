import { NextResponse } from "next/server";
import { readExtensionRegistryFoundation } from "@/features/extensions/registry";
import type { ExtensionManifest } from "@/features/extensions/registry";
import {
  readExtensionQuarantine,
  readExtensionVerificationReceipts,
  verifyExtensionPackage,
} from "@/features/extensions/package-verification";
import { resolveExtensionDependencies } from "@/features/extensions/dependency-resolver";
import { readMcpServerRegistry } from "@/features/extensions/mcp-server-registry";
import { readExtensionEcosystemAcceptanceEvidence } from "@/features/extensions/extension-ecosystem-acceptance";
import { buildExtensionEcosystemPromotionEvidence } from "@/features/extensions/extension-ecosystem-promotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const registry = readExtensionRegistryFoundation();
  return NextResponse.json({
    ...registry,
    dependencyResolution: resolveExtensionDependencies(registry.packages.map((entry) => entry.manifest)),
    quarantine: readExtensionQuarantine(),
    verificationReceipts: readExtensionVerificationReceipts(),
    mcpRegistry: readMcpServerRegistry(),
    ecosystemAcceptance: readExtensionEcosystemAcceptanceEvidence(),
    promotion: buildExtensionEcosystemPromotionEvidence(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      manifest?: ExtensionManifest;
      payloadBase64?: string;
      publicKeyPem?: string;
      quarantineOnFailure?: boolean;
    };
    if (!body.manifest) throw new Error("manifest is required.");
    const result = verifyExtensionPackage({
      manifest: body.manifest,
      payloadBase64: body.payloadBase64 || "",
      publicKeyPem: body.publicKeyPem,
      quarantineOnFailure: body.quarantineOnFailure,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Extension verification failed." }, { status: 400 });
  }
}
