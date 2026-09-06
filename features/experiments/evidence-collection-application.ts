import { NextResponse } from "next/server";

import {
  cancelEvidenceCollection,
  claimEvidenceCollection,
  evidenceCollectionErrorStatus,
  failEvidenceCollection,
  heartbeatEvidenceCollection,
  queueEvidenceCollection,
  readEvidenceCollectionQueue,
  retryEvidenceCollection,
  reviewEvidenceCollection,
  submitEvidenceCollectionCandidate,
} from "@/features/evidence/collection-service";
import {
  buildEvidenceCollectionPromotionBundle,
  readEvidenceCollectionTrainEvidence,
  runEvidenceCollectionTrainAcceptance,
} from "@/features/experiments/evidence-collection-train";
import { assertTrustedOperatorRequest, operatorAuthorizationStatus } from "@/features/security/operator-auth";
import { evidenceCollectionRequestSchema } from "@/features/evidence/collection-request";
import { executeEvidenceCollection } from "@/features/evidence/collection-execution";

function response() {
  return {
    ...readEvidenceCollectionTrainEvidence(),
    queue: readEvidenceCollectionQueue(),
  };
}

export function handleEvidenceCollectionTrainGet() {
  return NextResponse.json(response());
}

export async function handleEvidenceCollectionTrainPost(request: Request) {
  try {
    assertTrustedOperatorRequest(request);
    const parsed = evidenceCollectionRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid evidence collection request.", issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    }
    const body = parsed.data;
    let result: unknown;
    switch (body.action) {
      case "queue":
        result = queueEvidenceCollection({
          planVersion: body.planVersion || "",
          sourceMilestone: body.sourceMilestone || "",
          subjectId: body.subjectId || "",
          organizationId: body.organizationId || "",
          operatorId: body.operatorId || "",
          idempotencyKey: body.idempotencyKey || "",
        });
        break;
      case "claim":
        result = claimEvidenceCollection({
          jobId: body.jobId || "",
          workerId: body.workerId || "",
          expectedRevision: Number(body.expectedRevision),
          ttlMs: body.ttlMs === undefined ? undefined : Number(body.ttlMs),
        });
        break;
      case "execute":
        result = await executeEvidenceCollection(body);
        break;
      case "heartbeat":
        result = heartbeatEvidenceCollection({
          jobId: body.jobId || "",
          workerId: body.workerId || "",
          expectedRevision: Number(body.expectedRevision),
          fenceToken: Number(body.fenceToken),
          ttlMs: body.ttlMs === undefined ? undefined : Number(body.ttlMs),
        });
        break;
      case "submit-receipt":
        result = submitEvidenceCollectionCandidate({
          jobId: body.jobId || "",
          workerId: body.workerId || "",
          expectedRevision: Number(body.expectedRevision),
          fenceToken: Number(body.fenceToken),
          receipt: body.receipt,
        });
        break;
      case "fail":
        result = failEvidenceCollection({
          jobId: body.jobId || "",
          workerId: body.workerId || "",
          expectedRevision: Number(body.expectedRevision),
          fenceToken: Number(body.fenceToken),
          reason: body.reason || "",
        });
        break;
      case "retry":
        result = retryEvidenceCollection({
          jobId: body.jobId || "",
          actorId: body.actorId || "",
          expectedRevision: Number(body.expectedRevision),
        });
        break;
      case "review":
        if (body.decision !== "accepted" && body.decision !== "rejected") {
          return NextResponse.json({ ok: false, error: "Review decision must be accepted or rejected." }, { status: 400 });
        }
        result = reviewEvidenceCollection({
          jobId: body.jobId || "",
          reviewerId: body.reviewerId || "",
          expectedRevision: Number(body.expectedRevision),
          decision: body.decision,
          reason: body.reason || "",
        });
        break;
      case "cancel":
        result = cancelEvidenceCollection({
          jobId: body.jobId || "",
          actorId: body.actorId || "",
          expectedRevision: Number(body.expectedRevision),
          reason: body.reason || "",
        });
        break;
      case "record-train":
        result = runEvidenceCollectionTrainAcceptance();
        break;
      case "export-bundle":
        result = buildEvidenceCollectionPromotionBundle();
        break;
      default:
        return NextResponse.json({ ok: false, error: "Unsupported evidence collection action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result, evidence: response() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Evidence collection request failed." },
      { status: Math.max(operatorAuthorizationStatus(error), evidenceCollectionErrorStatus(error)) },
    );
  }
}
