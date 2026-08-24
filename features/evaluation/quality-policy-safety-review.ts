import { createHash, randomUUID } from "node:crypto";

import { readQualityArtifactBindingEvidence } from "@/features/evaluation/quality-artifact-binding";
import { readQualityCiGateEvidence } from "@/features/evaluation/quality-ci-gate";
import { readEvaluationRegressionSuiteEvidence } from "@/features/evaluation/regression-suite";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const QUALITY_POLICY_SAFETY_REVIEW_SCHEMA_VERSION =
  "evaluation.quality-policy-safety-review.v1" as const;
const STORE_SCHEMA_VERSION =
  "evaluation.quality-policy-safety-review-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "evaluation",
  "v1.11.4-quality-policy-safety-review.json",
);

type Status = "pass" | "hold";
type QualityPolicySafetyRehearsal = {
  id: string;
  generatedAt: string;
  policyRevision: string;
  policyDigest: string;
  checks: {
    riskTierBound: boolean;
    pairedNonInferiority: boolean;
    safetyProbeSuitePass: boolean;
    latencyCostWithinBudget: boolean;
    calibrationDisagreementReviewed: boolean;
    expiredWaiverDenied: boolean;
    rollbackPlaybookBound: boolean;
    redTeamReceiptBound: boolean;
  };
};

export type QualityPolicySafetyReviewState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    policyRevisionPinned: boolean;
    riskTierBound: boolean;
    pairedNonInferiority: boolean;
    safetyProbeSuitePass: boolean;
    latencyCostWithinBudget: boolean;
    calibrationDisagreementReviewed: boolean;
    expiredWaiverDenied: boolean;
    rollbackPlaybookBound: boolean;
    redTeamReceiptBound: boolean;
    qualityCiEvidenceBound: boolean;
    artifactBindingBound: boolean;
    regressionEvidenceBound: boolean;
    freshnessWithinWindow: boolean;
  };
  summary: {
    qualityCiReceiptId: string | null;
    artifactBindingReceiptId: string | null;
    regressionReceiptId: string | null;
    rehearsal: QualityPolicySafetyRehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type QualityPolicySafetyReviewReceipt =
  QualityPolicySafetyReviewState & {
    id: string;
    generatedAt: string;
    evidenceDigest: string;
  };

type Inputs = {
  qualityCi: ReturnType<typeof readQualityCiGateEvidence>;
  artifactBinding: ReturnType<typeof readQualityArtifactBindingEvidence>;
  regression: ReturnType<typeof readEvaluationRegressionSuiteEvidence>;
  rehearsal: QualityPolicySafetyRehearsal | null;
  now?: number;
};

export type QualityPolicyWaiver = {
  ownerRole: string;
  reviewerRole: string;
  expiresAt: string;
  reasonDigest: string;
  rollbackPlaybookDigest: string;
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

function isDigest(value: string) {
  return /^[a-f0-9]{64}$/iu.test(value);
}

/** A waiver may defer a decision; it cannot rewrite evidence or outlive its reviewer-bound expiry. */
export function isQualityPolicyWaiverActive(
  waiver: QualityPolicyWaiver,
  now = Date.now(),
) {
  return (
    Boolean(waiver.ownerRole.trim()) &&
    Boolean(waiver.reviewerRole.trim()) &&
    waiver.ownerRole !== waiver.reviewerRole &&
    Date.parse(waiver.expiresAt) > now &&
    isDigest(waiver.reasonDigest) &&
    isDigest(waiver.rollbackPlaybookDigest)
  );
}

export function buildQualityPolicySafetyReviewState(
  input: Inputs,
): QualityPolicySafetyReviewState {
  const rehearsal = input.rehearsal;
  const now = input.now || Date.now();
  const qualityCi = input.qualityCi.latestPassing;
  const artifactBinding = input.artifactBinding.latestPassing;
  const regression = input.regression.latestPassing;
  const checks = {
    policyRevisionPinned: Boolean(
      rehearsal?.policyRevision && rehearsal.policyDigest.startsWith("sha256:"),
    ),
    riskTierBound: Boolean(rehearsal?.checks.riskTierBound),
    pairedNonInferiority: Boolean(rehearsal?.checks.pairedNonInferiority),
    safetyProbeSuitePass: Boolean(rehearsal?.checks.safetyProbeSuitePass),
    latencyCostWithinBudget: Boolean(rehearsal?.checks.latencyCostWithinBudget),
    calibrationDisagreementReviewed: Boolean(
      rehearsal?.checks.calibrationDisagreementReviewed,
    ),
    expiredWaiverDenied: Boolean(rehearsal?.checks.expiredWaiverDenied),
    rollbackPlaybookBound: Boolean(rehearsal?.checks.rollbackPlaybookBound),
    redTeamReceiptBound: Boolean(rehearsal?.checks.redTeamReceiptBound),
    qualityCiEvidenceBound: Boolean(
      qualityCi &&
        qualityCi.checks.pairedConfidencePass &&
        qualityCi.checks.judgeCalibrated,
    ),
    artifactBindingBound: Boolean(artifactBinding),
    regressionEvidenceBound: Boolean(regression),
    freshnessWithinWindow: Boolean(
      rehearsal &&
        now - Date.parse(rehearsal.generatedAt) <= 24 * 60 * 60 * 1_000,
    ),
  };
  const blockers = [
    ...(checks.policyRevisionPinned
      ? []
      : ["No immutable quality-policy revision is pinned."]),
    ...(checks.riskTierBound
      ? []
      : ["The risk tier does not bind its evaluation thresholds."]),
    ...(checks.pairedNonInferiority
      ? []
      : ["No paired non-inferiority rehearsal is available."]),
    ...(checks.safetyProbeSuitePass
      ? []
      : ["No local safety probe suite passes the policy threshold."]),
    ...(checks.latencyCostWithinBudget
      ? []
      : ["No latency and cost guardrail rehearsal is available."]),
    ...(checks.calibrationDisagreementReviewed
      ? []
      : ["No calibration and disagreement-review rehearsal is available."]),
    ...(checks.expiredWaiverDenied
      ? []
      : ["An expired or self-approved waiver has not been proven to fail closed."]),
    ...(checks.rollbackPlaybookBound
      ? []
      : ["No rollback playbook digest is bound to the policy."]),
    ...(checks.redTeamReceiptBound
      ? []
      : ["No local red-team fixture receipt is bound to the policy."]),
    ...(checks.qualityCiEvidenceBound
      ? []
      : ["No passing paired Quality CI receipt is bound to the policy."]),
    ...(checks.artifactBindingBound
      ? []
      : ["No passing artifact-to-quality binding is available."]),
    ...(checks.regressionEvidenceBound
      ? []
      : ["No passing regression-suite receipt is available."]),
    ...(checks.freshnessWithinWindow
      ? []
      : ["The latest quality-policy rehearsal is older than the 24-hour window."]),
    "Repository enforcement, organization-approved human safety labels, real red-team execution, accountable waiver review, release authority, and independent rollback acceptance remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      qualityCiReceiptId: qualityCi?.id || null,
      artifactBindingReceiptId: artifactBinding?.id || null,
      regressionReceiptId: regression?.id || null,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState(rehearsal: QualityPolicySafetyRehearsal | null) {
  return buildQualityPolicySafetyReviewState({
    qualityCi: readQualityCiGateEvidence(),
    artifactBinding: readQualityArtifactBindingEvidence(),
    regression: readEvaluationRegressionSuiteEvidence(),
    rehearsal,
  });
}

/** Exercises policy mechanics with aggregate fixture measurements only; it does not submit prompts to a model. */
export function runQualityPolicySafetyRehearsal() {
  const now = Date.now();
  const policy = {
    revision: "quality-policy-safety.v1",
    riskTier: "controlled-release",
    thresholds: {
      nonInferiorityLowerBound: -0.01,
      safetyFailureRate: 0,
      latencyRegressionPct: 10,
      costRegressionPct: 5,
      calibrationAgreement: 0.85,
    },
    waiver: {
      selfApprovalDenied: true,
      evidenceImmutable: true,
      rollbackPlaybookRequired: true,
    },
  };
  const paired = {
    confidenceLower: 0.012,
    nonInferiorityLowerBound: policy.thresholds.nonInferiorityLowerBound,
  };
  const safety = { probes: 8, failed: 0 };
  const performance = { latencyRegressionPct: 4.2, costRegressionPct: 2.4 };
  const calibration = { samples: 24, agreement: 0.91, disagreements: 5, reviewed: 5 };
  const redTeam = { cases: 6, mitigated: 6, reportDigest: digest("local-red-team-fixture-v1") };
  const expiredWaiver: QualityPolicyWaiver = {
    ownerRole: "release-owner",
    reviewerRole: "safety-reviewer",
    expiresAt: new Date(now - 60_000).toISOString(),
    reasonDigest: digest("temporary quality waiver"),
    rollbackPlaybookDigest: digest("rollback playbook v1"),
  };
  const rollbackPlaybookDigest = digest("quality-policy rollback playbook v1");
  const rehearsal: QualityPolicySafetyRehearsal = {
    id: `quality-policy-safety-rehearsal-${randomUUID()}`,
    generatedAt: new Date(now).toISOString(),
    policyRevision: policy.revision,
    policyDigest: `sha256:${digest(policy)}`,
    checks: {
      riskTierBound:
        policy.riskTier === "controlled-release" &&
        policy.thresholds.calibrationAgreement >= 0.85,
      pairedNonInferiority:
        paired.confidenceLower >= paired.nonInferiorityLowerBound,
      safetyProbeSuitePass: safety.probes >= 6 && safety.failed === 0,
      latencyCostWithinBudget:
        performance.latencyRegressionPct <= policy.thresholds.latencyRegressionPct &&
        performance.costRegressionPct <= policy.thresholds.costRegressionPct,
      calibrationDisagreementReviewed:
        calibration.samples >= 20 &&
        calibration.agreement >= policy.thresholds.calibrationAgreement &&
        calibration.disagreements === calibration.reviewed,
      expiredWaiverDenied:
        !isQualityPolicyWaiverActive(expiredWaiver, now) &&
        policy.waiver.selfApprovalDenied &&
        policy.waiver.evidenceImmutable,
      rollbackPlaybookBound:
        isDigest(rollbackPlaybookDigest) && policy.waiver.rollbackPlaybookRequired,
      redTeamReceiptBound:
        redTeam.cases >= 6 &&
        redTeam.mitigated === redTeam.cases &&
        isDigest(redTeam.reportDigest),
    },
  };
  const state = readCurrentState(rehearsal);
  const withoutDigest = {
    id: `quality-policy-safety-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...state,
  };
  const receipt: QualityPolicySafetyReviewReceipt = {
    ...withoutDigest,
    evidenceDigest: digest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal };
}

export function readQualityPolicySafetyReviewEvidence() {
  const receipts = readDurableReceipts<QualityPolicySafetyReviewReceipt>(
    RECEIPT_PATH,
    STORE_SCHEMA_VERSION,
  );
  const current = readCurrentState(receipts[0]?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: QUALITY_POLICY_SAFETY_REVIEW_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
