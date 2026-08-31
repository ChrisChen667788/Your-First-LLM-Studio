import {
  acknowledgeOwnerEscalation,
  expireOwnerWaiver,
  intakeOwnerWorkloadReceipt,
  reconcileOwnerCompensation,
  requestOwnerWaiver,
} from "@/features/experiments/owner-receipt-lifecycle";
import { readOperationalExceptionLifecycleTrain } from "@/features/experiments/operational-exception-lifecycle-train";
import { readOwnerReceiptIntakeTrain } from "@/features/experiments/owner-receipt-intake-train";
import { readOwnerWorkloadSourceSignals } from "@/features/experiments/owner-workload-source-signals";

export type OwnerReceiptMutationBody = {
  action?: string;
  expectedRevision?: number;
  actor?: string;
  actionId?: string;
  receipt?: unknown;
  reason?: string;
  receiptEventId?: string;
  rollbackEvidenceDigest?: string;
  durationHours?: number;
  scopes?: string[];
  waiverEventId?: string;
};

function protocol() {
  return readOwnerWorkloadSourceSignals().ownerWorkloadProtocol;
}

export function readOwnerReceiptIntakeApplication() {
  return readOwnerReceiptIntakeTrain();
}

export function readOperationalExceptionLifecycleApplication() {
  return readOperationalExceptionLifecycleTrain();
}

export function mutateOwnerReceiptIntakeApplication(body: OwnerReceiptMutationBody) {
  const currentProtocol = protocol();
  if (body.action === "intake-receipt") {
    const result = intakeOwnerWorkloadReceipt({
      protocol: currentProtocol,
      receipt: body.receipt,
      expectedRevision: Number(body.expectedRevision),
      actor: body.actor,
    });
    return { action: body.action, result, state: readOwnerReceiptIntakeTrain() };
  }
  if (body.action === "reconcile-compensation") {
    const ledger = reconcileOwnerCompensation({
      protocol: currentProtocol,
      actionId: body.actionId,
      receiptEventId: body.receiptEventId,
      expectedRevision: Number(body.expectedRevision),
      actor: body.actor,
      reason: body.reason,
      rollbackEvidenceDigest: body.rollbackEvidenceDigest,
    });
    return { action: body.action, result: { ledger }, state: readOwnerReceiptIntakeTrain() };
  }
  throw new Error("Unsupported receipt lifecycle action.");
}

export function mutateOperationalExceptionLifecycleApplication(body: OwnerReceiptMutationBody) {
  const currentProtocol = protocol();
  if (body.action === "acknowledge-escalation") {
    const ledger = acknowledgeOwnerEscalation({
      protocol: currentProtocol,
      actionId: body.actionId,
      expectedRevision: Number(body.expectedRevision),
      actor: body.actor,
      reason: body.reason,
    });
    return { action: body.action, result: { ledger }, state: readOperationalExceptionLifecycleTrain() };
  }
  if (body.action === "request-waiver") {
    const ledger = requestOwnerWaiver({
      protocol: currentProtocol,
      actionId: body.actionId,
      expectedRevision: Number(body.expectedRevision),
      actor: body.actor,
      reason: body.reason,
      durationHours: body.durationHours,
      scopes: body.scopes,
    });
    return { action: body.action, result: { ledger }, state: readOperationalExceptionLifecycleTrain() };
  }
  if (body.action === "expire-waiver") {
    const ledger = expireOwnerWaiver({
      protocol: currentProtocol,
      waiverEventId: body.waiverEventId,
      expectedRevision: Number(body.expectedRevision),
      actor: body.actor,
      reason: body.reason,
    });
    return { action: body.action, result: { ledger }, state: readOperationalExceptionLifecycleTrain() };
  }
  throw new Error("Unsupported operational exception lifecycle action.");
}

