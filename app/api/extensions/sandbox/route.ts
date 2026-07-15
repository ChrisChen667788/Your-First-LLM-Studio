import { NextResponse } from "next/server";
import {
  readExtensionSandboxEvidence,
  runExtensionSandboxRehearsal,
  buildExtensionSandboxPolicy,
} from "@/features/extensions/process-sandbox";
import type { ExtensionManifest } from "@/features/extensions/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readExtensionSandboxEvidence());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; manifest?: ExtensionManifest };
  if (body.action === "policy") {
    if (!body.manifest) return NextResponse.json({ ok: false, error: "manifest is required." }, { status: 400 });
    const policy = buildExtensionSandboxPolicy(body.manifest);
    return NextResponse.json({ ok: policy.executionAllowed, policy }, { status: policy.executionAllowed ? 200 : 422 });
  }
  const receipt = runExtensionSandboxRehearsal();
  return NextResponse.json({ ok: receipt.ok, receipt, evidence: readExtensionSandboxEvidence() }, { status: receipt.ok ? 200 : 422 });
}
