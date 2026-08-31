import { createHash } from "node:crypto";

import {
  buildOwnerWorkloadProtocol,
  type OwnerWorkloadProtocol,
  type OwnerWorkloadRequest,
} from "@/features/experiments/owner-workload-protocol";
import {
  readRemediationExecutionSourceSignals,
  type RemediationExecutionPlan,
} from "@/features/experiments/remediation-execution-source-signals";
import type { SourceBackedSignalStatus } from "@/features/experiments/source-backed-assurance-projection";

export const OWNER_WORKLOAD_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.owner-workload-source-signals.v1" as const;

export type OwnerWorkloadSourceSignalId =
  | "provider-workload-admission"
  | "retrieval-workload-admission"
  | "model-supply-chain-workload-admission"
  | "workspace-audit-workload-admission"
  | "runtime-capacity-workload-admission"
  | "benchmark-candidate-workload-admission"
  | "telemetry-export-workload-admission"
  | "owner-workload-request-protocol"
  | "owner-workload-receipt-protocol"
  | "independent-workload-receipt-closure"
  | "evidence-freshness-and-drift"
  | "dependency-unblock-impact"
  | "owner-sla-escalation"
  | "bounded-waiver-expiry"
  | "independent-operational-decision-closure";

export type OwnerWorkloadSourceSignal = {
  id: OwnerWorkloadSourceSignalId;
  label: string;
  status: SourceBackedSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type OwnerWorkloadSourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof OWNER_WORKLOAD_SOURCE_SIGNALS_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  summary: {
    totalSignals: number;
    sourceOwnedSignals: number;
    passingSignals: number;
    attentionSignals: number;
    unavailableSignals: number;
    externalOnlySignals: number;
  };
  signals: OwnerWorkloadSourceSignal[];
  ownerWorkloadProtocol: OwnerWorkloadProtocol;
  remediationExecutionPlan: RemediationExecutionPlan;
  stateDigest: string;
};

type AdmissionDefinition = {
  requestId: string;
  signalId: OwnerWorkloadSourceSignalId;
  label: string;
};

const ADMISSION_DEFINITIONS: AdmissionDefinition[] = [
  { requestId: "provider-release-probe", signalId: "provider-workload-admission", label: "Provider workload admission" },
  { requestId: "managed-retrieval-rehearsal", signalId: "retrieval-workload-admission", label: "Retrieval workload admission" },
  { requestId: "authenticated-model-transfer", signalId: "model-supply-chain-workload-admission", label: "Model supply-chain workload admission" },
  { requestId: "signed-workspace-action", signalId: "workspace-audit-workload-admission", label: "Workspace audit workload admission" },
  { requestId: "runtime-recovery-rehearsal", signalId: "runtime-capacity-workload-admission", label: "Runtime capacity workload admission" },
  { requestId: "benchmark-candidate-run", signalId: "benchmark-candidate-workload-admission", label: "Benchmark candidate workload admission" },
  { requestId: "telemetry-export-reconciliation", signalId: "telemetry-export-workload-admission", label: "Telemetry export workload admission" },
];

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function computedSignal(
  input: Omit<OwnerWorkloadSourceSignal, "status">,
): OwnerWorkloadSourceSignal {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean) ? "pass" : "attention",
  };
}

function externalSignal(
  id: OwnerWorkloadSourceSignalId,
  label: string,
  summary: string,
): OwnerWorkloadSourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary,
    checks: { localSubstitutionDenied: true, productionTransitionDenied: true },
    metrics: {},
    blockers: [
      "A distinct authority must sign, retain, and independently verify this evidence outside the Studio.",
    ],
    evidenceUri: "/experiments",
  };
}

function admissionSignal(
  definition: AdmissionDefinition,
  request: OwnerWorkloadRequest | undefined,
): OwnerWorkloadSourceSignal {
  if (!request) {
    return {
      id: definition.signalId,
      label: definition.label,
      status: "unavailable",
      summary: "The owner workload request is missing from the admission protocol.",
      checks: { requestAvailable: false },
      metrics: {},
      blockers: ["Restore the workload request binding before external execution."],
      evidenceUri: "/experiments",
    };
  }
  const completed = request.admissionState === "completed";
  return {
    id: definition.signalId,
    label: definition.label,
    status: completed ? "pass" : "attention",
    summary: `${request.owner} workload is ${request.admissionState}; its request is digest-bound and remains dry-run only inside the Studio.`,
    checks: {
      requestAvailable: true,
      requestDigestBound: /^[a-f0-9]{64}$/u.test(request.requestDigest),
      idempotencyBound: /^[a-f0-9]{64}$/u.test(request.idempotencyKey),
      fencingBound: /^[a-f0-9]{64}$/u.test(request.fencingTokenDigest),
      rollbackRequired: request.rollbackRequired,
      sourceControlSatisfied: completed,
      remoteMutationDenied: !request.remoteMutationAllowed,
    },
    metrics: {
      owner: request.owner,
      admissionState: request.admissionState,
      reviewWithinHours: request.reviewWithinHours,
      escalationAfterHours: request.escalationAfterHours,
    },
    blockers: completed
      ? []
      : ["An authorized owner must execute the real workload and bind its signed external receipt."],
    evidenceUri: request.validation.route,
  };
}

export function buildOwnerWorkloadSourceSignalSnapshot(input: {
  executionPlan: RemediationExecutionPlan;
  now?: number;
}): OwnerWorkloadSourceSignalSnapshot {
  const protocol = buildOwnerWorkloadProtocol(input.executionPlan);
  const now = input.now ?? Date.now();
  const generatedAt = Date.parse(input.executionPlan.generatedAt);
  const ageHours = Number.isFinite(generatedAt)
    ? Math.max(0, (now - generatedAt) / (60 * 60 * 1000))
    : Number.POSITIVE_INFINITY;
  const allOwnerActionsCompleted =
    protocol.summary.totalRequests === ADMISSION_DEFINITIONS.length &&
    protocol.summary.completedRequests === protocol.summary.totalRequests;
  const signals: OwnerWorkloadSourceSignal[] = [
    ...ADMISSION_DEFINITIONS.map((definition) =>
      admissionSignal(
        definition,
        protocol.requests.find((request) => request.actionId === definition.requestId),
      ),
    ),
    computedSignal({
      id: "owner-workload-request-protocol",
      label: "Owner workload request protocol",
      summary: "Every owner workload has a strict request digest, bounded review window, fencing token, and rollback requirement.",
      checks: {
        everyActionBound: protocol.checks.everyActionBound,
        strictRequestDigests: protocol.checks.strictRequestDigests,
        boundedReviewAndEscalation: protocol.checks.boundedReviewAndEscalation,
        rollbackAlwaysRequired: protocol.checks.rollbackAlwaysRequired,
        remoteMutationDenied: protocol.checks.remoteMutationDenied,
      },
      metrics: {
        requests: protocol.summary.totalRequests,
        protocolDigest: protocol.protocolDigest,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "owner-workload-receipt-protocol",
      label: "Owner workload receipt protocol",
      summary: "Candidate receipts are strict-schema, action-bound, fresh, execution-bounded, and still require detached external signature verification.",
      checks: {
        detachedSignatureRequired: protocol.receiptPolicy.detachedSignatureRequired,
        pinnedTrustAnchorRequired: protocol.receiptPolicy.pinnedTrustAnchorRequired,
        immutableArchiveRequired: protocol.receiptPolicy.immutableArchiveRequired,
        selfApprovalDenied: protocol.receiptPolicy.selfApprovalDenied,
        productionTransitionDenied: protocol.checks.productionTransitionDenied,
      },
      metrics: {
        maximumAgeHours: protocol.receiptPolicy.maximumAgeHours,
        maximumExecutionHours: protocol.receiptPolicy.maximumExecutionHours,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-workload-receipt-closure",
      "Independent workload receipt closure",
      "All v3.4.0-v3.4.8 owner requests and signed receipts require independent archive closure.",
    ),
    computedSignal({
      id: "evidence-freshness-and-drift",
      label: "Evidence freshness and drift",
      summary: "Owner request digests expose drift, while promotion remains held until all seven owner receipts are complete and current.",
      checks: {
        generatedAtValid: Number.isFinite(generatedAt),
        sourceSnapshotFresh: ageHours <= protocol.receiptPolicy.maximumAgeHours,
        protocolDigestBound: /^[a-f0-9]{64}$/u.test(protocol.protocolDigest),
        allOwnerActionsCompleted,
        productionTransitionDenied: protocol.productionStatus === "blocked",
      },
      metrics: {
        ageHours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(2)) : null,
        completedRequests: protocol.summary.completedRequests,
        totalRequests: protocol.summary.totalRequests,
      },
      blockers: allOwnerActionsCompleted
        ? []
        : ["Refresh and complete all owner workload receipts before a release decision."],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "dependency-unblock-impact",
      label: "Dependency unblock impact",
      summary: "Blocked owner actions preserve dependency order, and each request remains tied to its upstream evidence fingerprint.",
      checks: {
        dependencyOrderPreserved: input.executionPlan.checks.dependencyOrderPreserved,
        everyRequestEvidenceBound: protocol.requests.every((request) =>
          /^[a-f0-9]{64}$/u.test(request.upstreamEvidenceFingerprint),
        ),
        everyRequestFenced: protocol.requests.every((request) =>
          /^[a-f0-9]{64}$/u.test(request.fencingTokenDigest),
        ),
        productionTransitionDenied: protocol.checks.productionTransitionDenied,
      },
      metrics: {
        admittedRequests: protocol.summary.admittedRequests,
        blockedRequests: protocol.summary.blockedRequests,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "owner-sla-escalation",
      label: "Owner SLA and escalation",
      summary: "Every owner request has a priority-derived review SLA and a later bounded escalation threshold.",
      checks: {
        everyRequestHasOwner: protocol.requests.every((request) => Boolean(request.owner)),
        everyRequestHasReviewSla: protocol.requests.every((request) => request.reviewWithinHours > 0),
        escalationFollowsReview: protocol.requests.every(
          (request) => request.escalationAfterHours >= request.reviewWithinHours,
        ),
        selfApprovalDenied: protocol.receiptPolicy.selfApprovalDenied,
      },
      metrics: {
        requests: protocol.summary.totalRequests,
        shortestReviewHours: Math.min(...protocol.requests.map((request) => request.reviewWithinHours)),
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "bounded-waiver-expiry",
      label: "Bounded waiver and expiry",
      summary: "Temporary waivers are non-renewable, expire within 24 hours, and cannot bypass production, signature, trust, security, or ACL controls.",
      checks: {
        durationBounded: protocol.waiverPolicy.maximumDurationHours <= 24,
        renewalDenied: !protocol.waiverPolicy.renewalAllowed,
        productionOverrideDenied: !protocol.waiverPolicy.productionOverrideAllowed,
        criticalScopesProtected: protocol.waiverPolicy.forbiddenScopes.length >= 5,
      },
      metrics: {
        maximumDurationHours: protocol.waiverPolicy.maximumDurationHours,
        forbiddenScopes: protocol.waiverPolicy.forbiddenScopes.length,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-operational-decision-closure",
      "Independent operational decision closure",
      "A distinct authority must retain the final decision, reviewed receipt digests, expiry state, and predecessor binding.",
    ),
  ];
  const sourceOwned = signals.filter((signal) => signal.status !== "external-only");
  const summary = {
    totalSignals: signals.length,
    sourceOwnedSignals: sourceOwned.length,
    passingSignals: signals.filter((signal) => signal.status === "pass").length,
    attentionSignals: signals.filter((signal) => signal.status === "attention").length,
    unavailableSignals: signals.filter((signal) => signal.status === "unavailable").length,
    externalOnlySignals: signals.filter((signal) => signal.status === "external-only").length,
  };
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OWNER_WORKLOAD_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    localStatus: sourceOwned.every((signal) => signal.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    summary,
    signals,
    ownerWorkloadProtocol: protocol,
    remediationExecutionPlan: input.executionPlan,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function readOwnerWorkloadSourceSignals() {
  const execution = readRemediationExecutionSourceSignals();
  return buildOwnerWorkloadSourceSignalSnapshot({
    executionPlan: execution.remediationExecutionPlan,
  });
}
