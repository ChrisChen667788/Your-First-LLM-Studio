import { createHash, randomUUID } from "node:crypto";

import {
  readDeploymentControlPlane,
  runDeploymentControlPlaneRehearsal,
} from "@/features/deployment/control-plane";
import { readHaFinOpsReadiness } from "@/features/deployment/ha-finops-readiness";
import {
  readUsageSettlementEvidence,
  rehearseUsageSettlement,
} from "@/features/deployment/usage-settlement";
import { readReleaseSecurityEvidence } from "@/features/experiments/release-security-evidence";
import {
  readEnterpriseIdentityAcceptanceEvidence,
  runEnterpriseIdentityAcceptance,
} from "@/features/governance/enterprise-identity-acceptance";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import {
  readServerLogRetentionEvidence,
  rehearseServerLogRetention,
} from "@/features/models/server-log-retention";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const ENTERPRISE_CONTROL_PLANE_CANDIDATE_SCHEMA_VERSION =
  "deployment.enterprise-control-plane-candidate.v1" as const;
const STORE_SCHEMA_VERSION =
  "deployment.enterprise-control-plane-candidate-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "deployment",
  "v1.12.0-enterprise-control-plane-candidate.json",
);

type Status = "pass" | "hold";
type CandidateRehearsal = {
  id: string;
  generatedAt: string;
  deploymentRevision: string;
  references: {
    usageRecordId: string;
    auditRecordId: string;
    signingReceiptId: string;
    failoverReceiptId: string;
    identityReceiptId: string;
    settlementReceiptId: string;
    retentionReceiptId: string;
  };
  checks: {
    revisionBound: boolean;
    scopedPolicyBound: boolean;
    usageLedgerBound: boolean;
    settlementRetryBound: boolean;
    auditArchiveBound: boolean;
    identityLifecycleBound: boolean;
    redactionRetentionBound: boolean;
    haRpoRtoBound: boolean;
    approvalBoundaryBound: boolean;
  };
};

export type EnterpriseControlPlaneCandidateState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    deploymentRevisionBound: boolean;
    scopedPolicyBound: boolean;
    usageLedgerBound: boolean;
    settlementRetryBound: boolean;
    auditArchiveBound: boolean;
    identityLifecycleBound: boolean;
    redactionRetentionBound: boolean;
    haRpoRtoBound: boolean;
    releaseSecurityBound: boolean;
    approvalBoundaryBound: boolean;
    freshnessWithinWindow: boolean;
  };
  summary: {
    deploymentRevision: string;
    localReadinessPct: number;
    productionReadinessPct: number;
    cloudConfigured: boolean;
    identityReceiptId: string | null;
    settlementReceiptId: string | null;
    releaseSecurityStatus: string;
    rehearsal: CandidateRehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type EnterpriseControlPlaneCandidateReceipt =
  EnterpriseControlPlaneCandidateState & {
    id: string;
    generatedAt: string;
    evidenceDigest: string;
  };

type Inputs = {
  deployment: ReturnType<typeof readDeploymentControlPlane>;
  haFinOps: ReturnType<typeof readHaFinOpsReadiness>;
  identity: ReturnType<typeof readEnterpriseIdentityAcceptanceEvidence>;
  settlement: ReturnType<typeof readUsageSettlementEvidence>;
  retention: ReturnType<typeof readServerLogRetentionEvidence>;
  security: ReturnType<typeof readReleaseSecurityEvidence>;
  rehearsal: CandidateRehearsal | null;
  now?: number;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function buildEnterpriseControlPlaneCandidateState(
  input: Inputs,
): EnterpriseControlPlaneCandidateState {
  const rehearsal = input.rehearsal;
  const now = input.now || Date.now();
  const checks = {
    deploymentRevisionBound: Boolean(
      rehearsal?.checks.revisionBound && rehearsal.deploymentRevision === input.deployment.revision,
    ),
    scopedPolicyBound: Boolean(rehearsal?.checks.scopedPolicyBound),
    usageLedgerBound: Boolean(rehearsal?.checks.usageLedgerBound),
    settlementRetryBound: Boolean(
      rehearsal?.checks.settlementRetryBound && input.settlement.latestPassing,
    ),
    auditArchiveBound: Boolean(rehearsal?.checks.auditArchiveBound),
    identityLifecycleBound: Boolean(
      rehearsal?.checks.identityLifecycleBound && input.identity.latestPassing,
    ),
    redactionRetentionBound: Boolean(
      rehearsal?.checks.redactionRetentionBound && input.retention.latestPassing,
    ),
    haRpoRtoBound: Boolean(
      rehearsal?.checks.haRpoRtoBound &&
        input.haFinOps.metrics.failoverRehearsals > 0,
    ),
    releaseSecurityBound:
      input.security.status === "pass" && input.security.integrity.status === "verified",
    approvalBoundaryBound: Boolean(rehearsal?.checks.approvalBoundaryBound),
    freshnessWithinWindow: Boolean(
      rehearsal &&
        now - Date.parse(rehearsal.generatedAt) <= 24 * 60 * 60 * 1_000,
    ),
  };
  const blockers = [
    ...(checks.deploymentRevisionBound
      ? []
      : ["No current deployment revision is bound to a control-plane rehearsal."]),
    ...(checks.scopedPolicyBound
      ? []
      : ["No fail-closed scoped-key and policy-diff contract is bound."]),
    ...(checks.usageLedgerBound
      ? []
      : ["No local usage ledger reference is bound to the deployment receipt."]),
    ...(checks.settlementRetryBound
      ? []
      : ["No idempotent usage-settlement retry receipt is bound."]),
    ...(checks.auditArchiveBound
      ? []
      : ["No hash-bound audit archive is linked to the control-plane receipt."]),
    ...(checks.identityLifecycleBound
      ? []
      : ["No passing local enterprise identity lifecycle receipt is linked."]),
    ...(checks.redactionRetentionBound
      ? []
      : ["No passing redacted request-log retention receipt is linked."]),
    ...(checks.haRpoRtoBound
      ? []
      : ["No RPO/RTO failover rehearsal is linked to the control-plane receipt."]),
    ...(checks.releaseSecurityBound
      ? []
      : ["No fresh integrity-verified release-security preflight is linked."]),
    ...(checks.approvalBoundaryBound
      ? []
      : ["No distinct-approver and rollback-bound release policy is recorded."]),
    ...(checks.freshnessWithinWindow
      ? []
      : ["The latest enterprise control-plane rehearsal is older than the 24-hour window."]),
    "Managed PostgreSQL, real OIDC/SCIM, cloud KMS/Object Lock, billing settlement acknowledgements, multi-region failover, independent security testing, and organization sign-off remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      deploymentRevision: input.deployment.revision,
      localReadinessPct: input.deployment.localReadiness.completionPct,
      productionReadinessPct: input.deployment.productionReadiness.completionPct,
      cloudConfigured: input.deployment.controlPlane.cloud.configured,
      identityReceiptId: input.identity.latestPassing?.id || null,
      settlementReceiptId: input.settlement.latestPassing?.id || null,
      releaseSecurityStatus: input.security.status,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState(rehearsal: CandidateRehearsal | null) {
  return buildEnterpriseControlPlaneCandidateState({
    deployment: readDeploymentControlPlane(),
    haFinOps: readHaFinOpsReadiness(),
    identity: readEnterpriseIdentityAcceptanceEvidence(),
    settlement: readUsageSettlementEvidence(),
    retention: readServerLogRetentionEvidence(),
    security: readReleaseSecurityEvidence(),
    rehearsal,
  });
}

/** Runs local control-plane mechanics only; cloud KMS/Object Lock and external approval are never synthesized. */
export function runEnterpriseControlPlaneCandidateRehearsal() {
  const control = runDeploymentControlPlaneRehearsal({
    action: "rehearse-production-control-plane",
    operatorId: "enterprise-control-plane-candidate",
    tenantId: "local-lab",
    targetId: "enterprise-control-plane-candidate",
    primaryRegion: "local-primary",
    standbyRegion: "local-standby",
    promptTokens: 256,
    completionTokens: 128,
    estimatedCostUsd: 0,
  });
  const identity = runEnterpriseIdentityAcceptance();
  const settlement = rehearseUsageSettlement();
  const retention = rehearseServerLogRetention();
  const scopedPolicy = {
    revision: "enterprise-control-plane-policy.v1",
    keyScopes: ["deployment:read", "usage:write"],
    requirePolicyDiff: true,
    requireDistinctApprover: true,
    requireRollbackReference: true,
  };
  const rehearsal: CandidateRehearsal = {
    id: `enterprise-control-plane-candidate-rehearsal-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    deploymentRevision: control.summary.revision,
    references: {
      usageRecordId: control.result.usage.id,
      auditRecordId: control.result.audit.id,
      signingReceiptId: control.result.receipt.id,
      failoverReceiptId: control.result.failover.id,
      identityReceiptId: identity.id,
      settlementReceiptId: settlement.id,
      retentionReceiptId: retention.id,
    },
    checks: {
      revisionBound:
        /^[a-f0-9]{16}$/iu.test(control.summary.revision) &&
        control.summary.revision === readDeploymentControlPlane().revision,
      scopedPolicyBound:
        scopedPolicy.keyScopes.length === 2 &&
        scopedPolicy.requirePolicyDiff &&
        scopedPolicy.requireDistinctApprover,
      usageLedgerBound:
        control.result.usage.totalTokens ===
          control.result.usage.promptTokens + control.result.usage.completionTokens &&
        /^[a-f0-9]{64}$/iu.test(control.result.usage.payloadHash),
      settlementRetryBound:
        settlement.status === "pass" && settlement.checks.duplicateSuppressed,
      auditArchiveBound:
        /^[a-f0-9]{64}$/iu.test(control.result.audit.immutableHash) &&
        Boolean(control.result.audit.archivePath),
      identityLifecycleBound: identity.status === "pass",
      redactionRetentionBound: retention.status === "pass",
      haRpoRtoBound:
        control.result.failover.status === "completed" &&
        control.result.failover.measuredRpoMs >= 0 &&
        control.result.failover.measuredRtoMs > 0 &&
        control.result.failover.oldPrimaryFenced &&
        control.result.failover.standbyPromoted,
      approvalBoundaryBound:
        scopedPolicy.requireDistinctApprover && scopedPolicy.requireRollbackReference,
    },
  };
  const state = readCurrentState(rehearsal);
  const withoutDigest = {
    id: `enterprise-control-plane-candidate-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: EnterpriseControlPlaneCandidateReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal };
}

export function readEnterpriseControlPlaneCandidateEvidence() {
  const receipts = readDurableReceipts<EnterpriseControlPlaneCandidateReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState(receipts[0]?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: ENTERPRISE_CONTROL_PLANE_CANDIDATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
