import { NextResponse } from "next/server";
import {
  createModelAcquisitionJob,
  readModelAcquisitionRegistry,
  runModelAcquisitionTransferStep,
  updateModelAcquisitionJob,
} from "@/features/models/model-acquisition";
import {
  advanceRuntimeRecoveryCheckpoint,
  startRuntimeRecoveryCheckpoint,
} from "@/features/models/runtime-recovery-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readModelAcquisitionRegistry());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "create";
    const job =
      action === "transfer-step"
        ? await runModelAcquisitionTransferStep({
            jobId: typeof body.jobId === "string" ? body.jobId : undefined,
            chunkBytes: typeof body.chunkBytes === "number" ? body.chunkBytes : undefined,
            timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
          })
        : action === "create"
        ? createModelAcquisitionJob({
            source:
              body.source === "modelscope" || body.source === "ollama" || body.source === "url"
                ? body.source
                : "hugging-face",
            modelId: typeof body.modelId === "string" ? body.modelId : undefined,
            revision: typeof body.revision === "string" ? body.revision : undefined,
            destination: typeof body.destination === "string" ? body.destination : undefined,
            expectedSha256:
              typeof body.expectedSha256 === "string" ? body.expectedSha256 : undefined,
            bytesTotal: typeof body.bytesTotal === "number" ? body.bytesTotal : undefined,
            artifactUrl: typeof body.artifactUrl === "string" ? body.artifactUrl : undefined,
          })
        : updateModelAcquisitionJob({
            jobId: typeof body.jobId === "string" ? body.jobId : undefined,
            action:
              action === "pause" || action === "resume" || action === "cancel"
                ? action
                : "start",
          });
    if (action === "cancel") {
      startRuntimeRecoveryCheckpoint({
        operation: "cancel",
        targetId: `acquisition:${job.id}`,
        targetLabel: job.modelId,
        safeBoundary: {
          kind: "verified-transfer-offset",
          reference: `${job.id}:${job.bytesDownloaded}:${job.resumeToken}`,
          summary: "Model acquisition cancellation recorded at its durable transfer boundary.",
        },
      });
    }
    if (action === "resume") {
      const checkpoint = startRuntimeRecoveryCheckpoint({
        operation: "resume",
        targetId: `acquisition:${job.id}`,
        targetLabel: job.modelId,
        safeBoundary: {
          kind: "verified-transfer-offset",
          reference: `${job.id}:${job.bytesDownloaded}:${job.resumeToken}`,
          summary: "Model acquisition resume starts from its persisted transfer boundary.",
        },
      });
      const resumed = advanceRuntimeRecoveryCheckpoint({
        checkpointId: checkpoint.id,
        state: "resumed",
        reason: "Acquisition registry accepted the persisted resume token.",
      });
      advanceRuntimeRecoveryCheckpoint({
        checkpointId: resumed.id,
        state: "completed",
        reason: "Acquisition job returned to the downloading state.",
      });
    }
    return NextResponse.json({ ok: true, job, registry: readModelAcquisitionRegistry() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Model acquisition failed." },
      { status: 400 },
    );
  }
}
