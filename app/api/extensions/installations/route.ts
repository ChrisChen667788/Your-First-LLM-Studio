import { NextResponse } from "next/server";
import { installVerifiedExtension, readExtensionInstallationEvidence, rollbackExtensionVersion, setExtensionVersionEnabled } from "@/features/extensions/install-transaction";
import type { ExtensionManifest } from "@/features/extensions/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(readExtensionInstallationEvidence()); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; manifest?: ExtensionManifest; payloadBase64?: string; publicKeyPem?: string; extensionId?: string; targetVersion?: string; version?: string };
    const result = body.action === "rollback"
      ? rollbackExtensionVersion({ extensionId: body.extensionId || "", targetVersion: body.targetVersion || "" })
      : body.action === "enable" || body.action === "disable"
        ? setExtensionVersionEnabled({ extensionId: body.extensionId || "", version: body.version || body.targetVersion || "", enabled: body.action === "enable" })
      : body.manifest
        ? installVerifiedExtension({ manifest: body.manifest, payloadBase64: body.payloadBase64 || "", publicKeyPem: body.publicKeyPem })
        : (() => { throw new Error("manifest is required."); })();
    return NextResponse.json({ ok: true, result, evidence: readExtensionInstallationEvidence() });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Extension lifecycle action failed.", evidence: readExtensionInstallationEvidence() }, { status: 422 }); }
}
