import { NextResponse } from "next/server";

import {
  advanceRuntimeRecoveryCheckpoint,
  captureLatestRuntimeRequestPerformance,
  readRuntimeRecoveryPerformanceEvidence,
  startRuntimeRecoveryCheckpoint,
} from "@/features/models/runtime-recovery-performance";
import {
  assertTrustedOperatorRequest,
  operatorAuthorizationStatus,
} from "@/features/security/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readRuntimeRecoveryPerformanceEvidence());
}

export async function POST(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const result =
      action === "capture-latest-request"
        ? captureLatestRuntimeRequestPerformance({
            profileId: typeof body.profileId === "string" ? body.profileId : "",
            promptClass: typeof body.promptClass === "string" ? body.promptClass : "",
            repeatedContext: body.repeatedContext === true,
            memoryBytes: typeof body.memoryBytes === "number" ? body.memoryBytes : null,
            queueWaitMs: typeof body.queueWaitMs === "number" ? body.queueWaitMs : null,
          })
        : action === "create-checkpoint"
          ? startRuntimeRecoveryCheckpoint({
              operation: body.operation as "cancel" | "resume" | "restart" | "load" | "unload" | "benchmark",
              targetId: typeof body.targetId === "string" ? body.targetId : "",
              targetLabel: typeof body.targetLabel === "string" ? body.targetLabel : "",
              runtimeProfileId: typeof body.runtimeProfileId === "string" ? body.runtimeProfileId : null,
              safeBoundary: {
                kind: typeof body.boundaryKind === "string" ? body.boundaryKind : "operator-confirmed",
                reference: typeof body.boundaryReference === "string" ? body.boundaryReference : "",
                summary: typeof body.boundarySummary === "string" ? body.boundarySummary : "",
              },
            })
          : action === "advance-checkpoint"
            ? advanceRuntimeRecoveryCheckpoint({
                checkpointId: typeof body.checkpointId === "string" ? body.checkpointId : "",
                state: body.state as "ready-to-resume" | "resumed" | "completed" | "cancelled" | "failed",
                reason: typeof body.reason === "string" ? body.reason : undefined,
              })
            : (() => {
                throw new Error("action must be capture-latest-request, create-checkpoint, or advance-checkpoint.");
              })();
    return NextResponse.json(
      {
        ok: true,
        result,
        evidence: readRuntimeRecoveryPerformanceEvidence(),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Runtime recovery and performance evidence update failed.",
      },
      { status: operatorAuthorizationStatus(error) },
    );
  }
}
