import { NextResponse } from "next/server";
import {
  buildArtifactRegistryPublishPlan,
  readArtifactRegistryAdapterCatalog,
  type ArtifactRegistryTargetId,
} from "@/features/artifacts/registry-adapters";
import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readArtifactRegistryAdapterCatalog());
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      targetId?: ArtifactRegistryTargetId;
      manifest?: ArtifactPackageManifest;
      publish?: boolean;
    };
    if (!body.targetId || !body.manifest) throw new Error("targetId and manifest are required.");
    const plan = buildArtifactRegistryPublishPlan({ targetId: body.targetId, manifest: body.manifest });
    if (body.publish) {
      return NextResponse.json({
        ok: false,
        error: "Remote mutation is disabled for preview registry adapters. Use this plan to collect an external staging receipt.",
        plan,
      }, { status: 409 });
    }
    return NextResponse.json({ ok: plan.planReady, plan }, { status: plan.planReady ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Artifact registry plan failed.",
    }, { status: 400 });
  }
}
