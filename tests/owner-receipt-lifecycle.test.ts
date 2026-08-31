import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildOperationalRemediationControlPlane } from "@/features/experiments/operational-remediation-control-plane";
import {
  buildOperationalSustainabilitySourceSignalSnapshot,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
} from "@/features/experiments/operational-sustainability-source-signals";
import {
  acknowledgeOwnerEscalation,
  buildOwnerReceiptLifecycle,
  expireOwnerWaiver,
  intakeOwnerWorkloadReceipt,
  OwnerReceiptLifecycleError,
  readOwnerReceiptLedger,
  reconcileOwnerCompensation,
  requestOwnerWaiver,
} from "@/features/experiments/owner-receipt-lifecycle";
import { buildOwnerReceiptLifecycleSourceSignalSnapshot } from "@/features/experiments/owner-receipt-lifecycle-source-signals";
import { OWNER_RECEIPT_INTAKE_DEFINITIONS } from "@/features/experiments/owner-receipt-intake-train";
import { OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS } from "@/features/experiments/operational-exception-lifecycle-train";
import { buildOwnerWorkloadProtocol } from "@/features/experiments/owner-workload-protocol";
import { buildRemediationExecutionPlan } from "@/features/experiments/remediation-execution-source-signals";
import {
  RELEASE_TRAIN_DEVELOPMENT_VERSION,
  RELEASE_TRAIN_MILESTONES,
} from "@/features/experiments/release-train";

const now = Date.parse("2026-08-30T12:00:00.000Z");
const sha = (character: string) => character.repeat(64);
const sourceIds: OperationalSustainabilitySourceSignalId[] = [
  "provider-traffic-reconciliation",
  "retrieval-freshness-remediation",
  "model-supply-chain-reconciliation",
  "workspace-audit-completeness",
  "runtime-recovery-efficiency",
  "agent-session-recovery",
  "workflow-queue-failover",
  "benchmark-cost-quality",
  "finetune-cost-quality-export",
  "independent-remediation-review",
  "telemetry-resource-transparency",
  "incident-diagnostics-retention",
  "admin-compatibility-sunset",
  "desktop-upgrade-data-lifecycle",
  "independent-sustainable-operations-review",
];

function protocol() {
  const snapshot = buildOperationalSustainabilitySourceSignalSnapshot(
    sourceIds.map((id): OperationalSustainabilitySourceSignal => ({
      id,
      label: id,
      status: id.startsWith("independent-") ? "external-only" : "pass",
      summary: `${id} evidence`,
      checks: { ready: true },
      metrics: {},
      blockers: [],
      evidenceUri: "/experiments",
    })),
  );
  return buildOwnerWorkloadProtocol(
    buildRemediationExecutionPlan(buildOperationalRemediationControlPlane(snapshot)),
  );
}

function validReceipt(current: ReturnType<typeof protocol>, actionId: string) {
  const request = current.requests.find((entry) => entry.actionId === actionId)!;
  return {
    schemaVersion: "experiments.owner-workload-receipt.v1",
    actionId,
    requestDigest: request.requestDigest,
    idempotencyKey: request.idempotencyKey,
    startedAt: "2026-08-30T10:00:00.000Z",
    completedAt: "2026-08-30T11:00:00.000Z",
    outcome: "passed",
    primaryEvidenceDigest: sha("a"),
    operator: {
      organizationId: "first-llm-operations",
      operatorId: "provider-operator-01",
    },
  };
}

test("owner receipt lifecycle persists a fail-closed event chain", async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-owner-receipts-"));
  const previousPath = process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH;
  process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH = path.join(directory, "ledger.json");
  t.after(() => {
    if (previousPath === undefined) delete process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH;
    else process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  });

  const current = protocol();

  await t.test("accepts a strict candidate without granting external authority", () => {
    const result = intakeOwnerWorkloadReceipt({
      protocol: current,
      receipt: validReceipt(current, "provider-release-probe"),
      expectedRevision: 0,
      actor: "local-release-operator",
      now,
    });
    assert.equal(result.validation.status, "valid-candidate");
    assert.equal(result.ledger.revision, 1);
    assert.equal(result.ledger.events[0]!.eventType, "receipt-accepted");
    assert.equal(result.ledger.events[0]!.externalSignaturePending, true);
    assert.equal(result.ledger.productionStatus, "blocked");
  });

  await t.test("quarantines invalid input and never persists its raw payload", () => {
    const receipt = {
      ...validReceipt(current, "managed-retrieval-rehearsal"),
      unexpectedSecret: "do-not-persist-this-secret",
    };
    const result = intakeOwnerWorkloadReceipt({
      protocol: current,
      receipt,
      expectedRevision: 1,
      actor: "local-release-operator",
      now,
    });
    assert.equal(result.validation.status, "invalid");
    assert.equal(result.ledger.events.at(-1)!.eventType, "receipt-quarantined");
    assert.doesNotMatch(readFileSync(process.env.FIRST_LLM_OWNER_RECEIPT_LEDGER_PATH!, "utf8"), /do-not-persist-this-secret/u);
  });

  await t.test("rejects stale writers with an optimistic concurrency conflict", () => {
    assert.throws(
      () => acknowledgeOwnerEscalation({
        protocol: current,
        actionId: "provider-release-probe",
        expectedRevision: 0,
        actor: "incident-operator-01",
        reason: "Acknowledge the bounded owner escalation for follow-up.",
        now,
      }),
      (error) => error instanceof OwnerReceiptLifecycleError && error.code === "revision_conflict" && error.status === 409,
    );
  });

  await t.test("reconciles compensation without rewriting the quarantined event", () => {
    const quarantined = readOwnerReceiptLedger(current).events.find((event) => event.eventType === "receipt-quarantined")!;
    const ledger = reconcileOwnerCompensation({
      protocol: current,
      actionId: "managed-retrieval-rehearsal",
      receiptEventId: quarantined.eventId,
      expectedRevision: 2,
      actor: "retrieval-operator-01",
      reason: "Rollback completed and the managed index was restored.",
      rollbackEvidenceDigest: sha("b"),
      now,
    });
    assert.equal(ledger.revision, 3);
    assert.equal(ledger.events[1]!.eventType, "receipt-quarantined");
    assert.equal(ledger.events[2]!.referencedEventId, quarantined.eventId);
  });

  await t.test("enforces protected waiver scopes and supports explicit expiry", () => {
    assert.throws(
      () => requestOwnerWaiver({
        protocol: current,
        actionId: "runtime-recovery-rehearsal",
        expectedRevision: 3,
        actor: "runtime-operator-01",
        reason: "Temporary recovery observation window for runtime diagnostics.",
        durationHours: 12,
        scopes: ["production-authority"],
        now,
      }),
      (error) => error instanceof OwnerReceiptLifecycleError && error.code === "policy_denied",
    );
    const withWaiver = requestOwnerWaiver({
      protocol: current,
      actionId: "runtime-recovery-rehearsal",
      expectedRevision: 3,
      actor: "runtime-operator-01",
      reason: "Temporary recovery observation window for runtime diagnostics.",
      durationHours: 12,
      scopes: ["diagnostic-observation"],
      now,
    });
    const waiver = withWaiver.events.at(-1)!;
    const expired = expireOwnerWaiver({
      protocol: current,
      waiverEventId: waiver.eventId,
      expectedRevision: 4,
      actor: "runtime-operator-01",
      reason: "Diagnostic observation is complete; revoke the waiver now.",
      now: now + 60_000,
    });
    assert.equal(expired.events.at(-1)!.eventType, "waiver-expired");
  });

  await t.test("records escalation acknowledgement and builds source projections", () => {
    const ledger = acknowledgeOwnerEscalation({
      protocol: current,
      actionId: "benchmark-candidate-run",
      expectedRevision: 5,
      actor: "quality-operator-01",
      reason: "The benchmark owner accepted the escalation and review deadline.",
      now,
    });
    const lifecycle = buildOwnerReceiptLifecycle({ protocol: current, ledger, now });
    const snapshot = buildOwnerReceiptLifecycleSourceSignalSnapshot({ protocol: current, lifecycle, now });
    assert.equal(ledger.revision, 6);
    assert.equal(lifecycle.summary.acceptedCandidates, 1);
    assert.equal(lifecycle.summary.quarantinedCandidates, 1);
    assert.equal(lifecycle.summary.compensatedActions, 1);
    assert.equal(lifecycle.summary.acknowledgedEscalations, 1);
    assert.equal(lifecycle.summary.activeWaivers, 0);
    assert.equal(lifecycle.summary.expiredWaivers, 1);
    assert.equal(lifecycle.checks.eventChainValid, true);
    assert.equal(lifecycle.productionStatus, "blocked");
    assert.equal(snapshot.summary.totalSignals, 15);
    assert.equal(snapshot.summary.sourceOwnedSignals, 13);
    assert.equal(snapshot.summary.externalOnlySignals, 2);
  });

  await t.test("defines all fifteen v3.6-v3.7 assurance milestones", () => {
    assert.equal(OWNER_RECEIPT_INTAKE_DEFINITIONS.length, 10);
    assert.equal(OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS.length, 5);
    assert.deepEqual(
      [...OWNER_RECEIPT_INTAKE_DEFINITIONS, ...OPERATIONAL_EXCEPTION_LIFECYCLE_DEFINITIONS].map((entry) => entry.version),
      [
        "v3.6.0", "v3.6.1", "v3.6.2", "v3.6.3", "v3.6.4",
        "v3.6.5", "v3.6.6", "v3.6.7", "v3.6.8", "v3.6.9",
        "v3.7.0", "v3.7.1", "v3.7.2", "v3.7.3", "v3.7.4",
      ],
    );
    assert.deepEqual(
      RELEASE_TRAIN_MILESTONES.slice(-30, -15).map((entry) => entry.version),
      [
        "v3.6.0", "v3.6.1", "v3.6.2", "v3.6.3", "v3.6.4",
        "v3.6.5", "v3.6.6", "v3.6.7", "v3.6.8", "v3.6.9",
        "v3.7.0", "v3.7.1", "v3.7.2", "v3.7.3", "v3.7.4",
      ],
    );
    assert.equal(RELEASE_TRAIN_MILESTONES.length, 200);
    assert.equal(RELEASE_TRAIN_DEVELOPMENT_VERSION, "v1.7.0-v3.7.4 source; v3.8.0-v3.9.4 planned");
    assert.ok(RELEASE_TRAIN_MILESTONES.slice(-30, -15).every((entry) => entry.status === "evidence-needed"));
  });
});
