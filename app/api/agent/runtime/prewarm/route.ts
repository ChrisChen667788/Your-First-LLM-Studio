import { NextResponse } from "next/server";
import { getServerAgentTarget } from "@/lib/agent/server-targets";
import { resolveTarget } from "@/lib/agent/providers";
import type { AgentRuntimePrewarmResponse } from "@/lib/agent/types";
import {
  advanceRuntimeRecoveryCheckpoint,
  startRuntimeRecoveryCheckpoint,
} from "@/features/models/runtime-recovery-performance";
import { prewarmLocalTargetWithRecovery } from "../prewarm-utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { targetId?: string };
    if (!body.targetId || typeof body.targetId !== "string") {
      return NextResponse.json({ error: "targetId is required." }, { status: 400 });
    }

    const target = getServerAgentTarget(body.targetId);
    if (!target) {
      return NextResponse.json({ error: `Unknown target: ${body.targetId}` }, { status: 404 });
    }

    if (target.execution !== "local") {
      return NextResponse.json({ error: "Only local targets support prewarm." }, { status: 400 });
    }

    const resolvedTarget = resolveTarget(body.targetId);
    const checkpoint = startRuntimeRecoveryCheckpoint({
      operation: "load",
      targetId: body.targetId,
      targetLabel: target.label,
      safeBoundary: {
        kind: "prewarm-request",
        reference: `${body.targetId}:${resolvedTarget.resolvedModel}`,
        summary: "Load boundary persisted before local gateway prewarm.",
      },
    });
    const response: AgentRuntimePrewarmResponse = await prewarmLocalTargetWithRecovery({
      baseUrl: resolvedTarget.resolvedBaseUrl,
      model: resolvedTarget.resolvedModel,
      targetId: body.targetId,
      targetLabel: target.label
    });

    if (response.ok) {
      const resumed = advanceRuntimeRecoveryCheckpoint({
        checkpointId: checkpoint.id,
        state: "resumed",
        reason: "Local gateway accepted the persisted prewarm boundary.",
      });
      if (response.status === "ready") {
        advanceRuntimeRecoveryCheckpoint({
          checkpointId: resumed.id,
          state: "completed",
          reason: "Local gateway prewarm reached the ready state.",
        });
      }
    } else {
      advanceRuntimeRecoveryCheckpoint({
        checkpointId: checkpoint.id,
        state: "failed",
        reason: response.message || "Local gateway prewarm failed.",
      });
    }

    return NextResponse.json(response, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prewarm failed." },
      { status: 500 }
    );
  }
}
