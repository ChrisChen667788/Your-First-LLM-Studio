import { NextResponse } from "next/server";
import { readArtifactPackageFoundation } from "@/features/artifacts/package-contract";
import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";
import { evaluateArtifactProvenance, readArtifactProvenanceEvidence } from "@/features/artifacts/provenance-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...readArtifactPackageFoundation(), provenance: readArtifactProvenanceEvidence() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { manifest?: ArtifactPackageManifest; provenance?: Parameters<typeof evaluateArtifactProvenance>[1] };
    if (!body.manifest) throw new Error("manifest is required.");
    const receipt = evaluateArtifactProvenance(body.manifest, body.provenance || {});
    return NextResponse.json({ ok: receipt.status === "pass", receipt, evidence: readArtifactProvenanceEvidence() }, { status: receipt.status === "blocked" ? 422 : 200 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Artifact provenance failed." }, { status: 400 }); }
}
