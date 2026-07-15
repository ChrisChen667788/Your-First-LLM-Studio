import { NextResponse, type NextRequest } from "next/server";
import {
  readDeploymentControlPlane,
  runDeploymentControlPlaneRehearsal,
} from "@/features/deployment/control-plane";
import type { DeploymentControlPlaneRehearsalInput } from "@/features/deployment/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readDeploymentControlPlane());
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<DeploymentControlPlaneRehearsalInput>;
  if (body.action === "rehearse-production-control-plane") {
    try {
      return NextResponse.json(
        runDeploymentControlPlaneRehearsal({
          action: "rehearse-production-control-plane",
          requireCloud: body.requireCloud,
          cloudProvider: body.cloudProvider,
          operatorId: body.operatorId,
          tenantId: body.tenantId,
          targetId: body.targetId,
          primaryRegion: body.primaryRegion,
          standbyRegion: body.standbyRegion,
          promptTokens: body.promptTokens,
          completionTokens: body.completionTokens,
          estimatedCostUsd: body.estimatedCostUsd,
        }),
      );
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "deployment_cloud_adapter_not_ready",
          message: error instanceof Error ? error.message : "Cloud production adapter failed.",
          summary: readDeploymentControlPlane({ requireCloud: body.requireCloud }),
        },
        { status: 422 },
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "deployment_registry_read_only",
      message:
        "Local dev registry is read-only. Use action=rehearse-production-control-plane to write production-control evidence.",
    },
    { status: 409 },
  );
}
