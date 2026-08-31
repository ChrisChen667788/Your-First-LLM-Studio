import { createHash } from "node:crypto";

import {
  readOperationalRemediationControlPlane,
  type OperationalRemediationControlPlane,
  type OperationalRemediationItem,
} from "@/features/experiments/operational-remediation-control-plane";
import type { SourceBackedSignalStatus } from "@/features/experiments/source-backed-assurance-projection";

export const REMEDIATION_EXECUTION_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.remediation-execution-source-signals.v1" as const;
export const REMEDIATION_EXECUTION_PLAN_SCHEMA_VERSION =
  "experiments.remediation-execution-plan.v1" as const;

export type RemediationExecutionSourceSignalId =
  | "provider-remediation-execution"
  | "retrieval-remediation-execution"
  | "model-supply-chain-remediation-execution"
  | "workspace-audit-remediation-execution"
  | "runtime-capacity-remediation-execution"
  | "benchmark-candidate-remediation-execution"
  | "telemetry-export-remediation-execution"
  | "execution-lease-and-fencing"
  | "rollback-evidence-package"
  | "independent-execution-acceptance"
  | "slo-quality-acceptance-policy"
  | "incident-change-rehearsal"
  | "owner-signoff-queue"
  | "release-readiness-decision"
  | "independent-operational-acceptance";

export type RemediationExecutionActionState =
  | "satisfied"
  | "ready"
  | "blocked"
  | "external-only";

export type RemediationExecutionAction = {
  id: string;
  version: string;
  sourceSignalId: OperationalRemediationItem["sourceSignalId"];
  label: string;
  owner: string;
  priority: OperationalRemediationItem["priority"];
  state: RemediationExecutionActionState;
  localValidationRoute: string;
  dependencyIds: OperationalRemediationItem["sourceSignalId"][];
  blockedBy: OperationalRemediationItem["sourceSignalId"][];
  idempotencyKey: string;
  lease: {
    durationSeconds: number;
    fencingTokenDigest: string;
    staleWriterRejected: true;
  };
  rollback: {
    required: true;
    plan: string;
    evidenceFingerprint: string;
  };
  nextAction: string;
  evidenceUri: string;
  remoteMutationAllowed: false;
};

export type RemediationExecutionPlan = {
  ok: true;
  schemaVersion: typeof REMEDIATION_EXECUTION_PLAN_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  productionStatus: "blocked";
  summary: {
    totalActions: number;
    satisfiedActions: number;
    readyActions: number;
    blockedActions: number;
    externalOnlyActions: number;
  };
  checks: {
    everyActionHasIdempotencyKey: boolean;
    everyActionHasLeaseAndFence: boolean;
    everyActionHasRollback: boolean;
    dependencyOrderPreserved: boolean;
    remoteMutationDenied: true;
    productionTransitionDenied: true;
  };
  actions: RemediationExecutionAction[];
  queueDigest: string;
  packageDigest: string;
};

export type RemediationExecutionSourceSignal = {
  id: RemediationExecutionSourceSignalId;
  label: string;
  status: SourceBackedSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type RemediationExecutionSourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof REMEDIATION_EXECUTION_SOURCE_SIGNALS_SCHEMA_VERSION;
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
  signals: RemediationExecutionSourceSignal[];
  remediationControlPlane: OperationalRemediationControlPlane;
  remediationExecutionPlan: RemediationExecutionPlan;
  stateDigest: string;
};

type ActionDefinition = {
  id: string;
  version: string;
  sourceSignalId: OperationalRemediationItem["sourceSignalId"];
  signalId: RemediationExecutionSourceSignalId;
  label: string;
  localValidationRoute: string;
  rollbackPlan: string;
};

const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    id: "provider-release-probe",
    version: "v3.2.0",
    sourceSignalId: "provider-traffic-reconciliation",
    signalId: "provider-remediation-execution",
    label: "Provider remediation execution",
    localValidationRoute: "/api/admin/provider-health/evidence",
    rollbackPlan: "Restore the pinned provider routing snapshot and retain the failed probe receipt.",
  },
  {
    id: "managed-retrieval-rehearsal",
    version: "v3.2.1",
    sourceSignalId: "retrieval-freshness-remediation",
    signalId: "retrieval-remediation-execution",
    label: "Retrieval remediation execution",
    localValidationRoute: "/api/retrieval/governance",
    rollbackPlan: "Restore the prior corpus revision and vector index snapshot before replaying frozen probes.",
  },
  {
    id: "authenticated-model-transfer",
    version: "v3.2.2",
    sourceSignalId: "model-supply-chain-reconciliation",
    signalId: "model-supply-chain-remediation-execution",
    label: "Model supply-chain remediation execution",
    localValidationRoute: "/api/models/supply-chain-operations",
    rollbackPlan: "Deactivate the candidate revision, restore the previous registry pointer, and verify destination checksums.",
  },
  {
    id: "signed-workspace-action",
    version: "v3.2.3",
    sourceSignalId: "workspace-audit-completeness",
    signalId: "workspace-audit-remediation-execution",
    label: "Workspace audit remediation execution",
    localValidationRoute: "/api/governance/workspace-provenance?execution=local",
    rollbackPlan: "Revoke the staged action, retain signed provenance, and reconcile the compensating audit event.",
  },
  {
    id: "runtime-recovery-rehearsal",
    version: "v3.2.4",
    sourceSignalId: "runtime-recovery-efficiency",
    signalId: "runtime-capacity-remediation-execution",
    label: "Runtime capacity remediation execution",
    localValidationRoute: "/api/models/runtime-recovery-performance",
    rollbackPlan: "Unload the candidate runtime profile and restore the last known-good activation receipt.",
  },
  {
    id: "benchmark-candidate-run",
    version: "v3.2.5",
    sourceSignalId: "benchmark-cost-quality",
    signalId: "benchmark-candidate-remediation-execution",
    label: "Benchmark candidate remediation execution",
    localValidationRoute: "/api/benchmarks/decision-intelligence",
    rollbackPlan: "Keep the baseline decision active and quarantine incomplete or non-qualified candidate artifacts.",
  },
  {
    id: "telemetry-export-reconciliation",
    version: "v3.2.6",
    sourceSignalId: "telemetry-resource-transparency",
    signalId: "telemetry-export-remediation-execution",
    label: "Telemetry export remediation execution",
    localValidationRoute: "/api/telemetry",
    rollbackPlan: "Disable the candidate exporter, restore the prior sampling policy, and retain the redacted failure trace.",
  },
];

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

function actionState(item: OperationalRemediationItem): RemediationExecutionActionState {
  if (item.state === "satisfied") return "satisfied";
  if (item.state === "open") return "ready";
  return item.state;
}

export function buildRemediationExecutionPlan(
  controlPlane: OperationalRemediationControlPlane,
): RemediationExecutionPlan {
  const items = new Map(controlPlane.items.map((item) => [item.sourceSignalId, item]));
  const actions = ACTION_DEFINITIONS.flatMap((definition) => {
    const item = items.get(definition.sourceSignalId);
    if (!item) return [];
    const idempotencyKey = digest({
      actionId: definition.id,
      evidenceFingerprint: item.evidenceFingerprint,
      dependencies: item.dependencyIds,
    });
    return [{
      id: definition.id,
      version: definition.version,
      sourceSignalId: definition.sourceSignalId,
      label: definition.label,
      owner: item.owner,
      priority: item.priority,
      state: actionState(item),
      localValidationRoute: definition.localValidationRoute,
      dependencyIds: item.dependencyIds,
      blockedBy: item.blockedBy,
      idempotencyKey,
      lease: {
        durationSeconds: 900,
        fencingTokenDigest: digest({ idempotencyKey, owner: item.owner, version: definition.version }),
        staleWriterRejected: true as const,
      },
      rollback: {
        required: true as const,
        plan: definition.rollbackPlan,
        evidenceFingerprint: item.evidenceFingerprint,
      },
      nextAction: item.nextActions[0] || "Retain the owner-reviewed execution receipt.",
      evidenceUri: item.evidenceUri,
      remoteMutationAllowed: false as const,
    }];
  });
  const actionIds = new Set(actions.map((action) => action.sourceSignalId));
  const checks = {
    everyActionHasIdempotencyKey: actions.length === ACTION_DEFINITIONS.length && actions.every((action) => /^[a-f0-9]{64}$/u.test(action.idempotencyKey)),
    everyActionHasLeaseAndFence: actions.every((action) => action.lease.durationSeconds > 0 && /^[a-f0-9]{64}$/u.test(action.lease.fencingTokenDigest) && action.lease.staleWriterRejected),
    everyActionHasRollback: actions.every((action) => action.rollback.required && Boolean(action.rollback.plan) && /^[a-f0-9]{64}$/u.test(action.rollback.evidenceFingerprint)),
    dependencyOrderPreserved: controlPlane.checks.dependencyGraphAcyclic && actions.every((action) => action.dependencyIds.filter((id) => actionIds.has(id)).every((dependencyId) => controlPlane.topologicalOrder.indexOf(dependencyId) < controlPlane.topologicalOrder.indexOf(action.sourceSignalId))),
    remoteMutationDenied: true as const,
    productionTransitionDenied: true as const,
  };
  const summary = {
    totalActions: actions.length,
    satisfiedActions: actions.filter((action) => action.state === "satisfied").length,
    readyActions: actions.filter((action) => action.state === "ready").length,
    blockedActions: actions.filter((action) => action.state === "blocked").length,
    externalOnlyActions: actions.filter((action) => action.state === "external-only").length,
  };
  const queueDigest = digest(actions.map((action) => ({
    id: action.id,
    state: action.state,
    idempotencyKey: action.idempotencyKey,
    fencingTokenDigest: action.lease.fencingTokenDigest,
  })));
  const withoutDigest = {
    ok: true as const,
    schemaVersion: REMEDIATION_EXECUTION_PLAN_SCHEMA_VERSION,
    generatedAt: controlPlane.generatedAt,
    localStatus: Object.values(checks).every(Boolean) && summary.satisfiedActions === summary.totalActions
      ? ("pass" as const)
      : ("attention" as const),
    productionStatus: "blocked" as const,
    summary,
    checks,
    actions,
    queueDigest,
  };
  return {
    ...withoutDigest,
    packageDigest: digest({
      schemaVersion: withoutDigest.schemaVersion,
      localStatus: withoutDigest.localStatus,
      productionStatus: withoutDigest.productionStatus,
      summary: withoutDigest.summary,
      checks: withoutDigest.checks,
      actions: withoutDigest.actions,
      queueDigest: withoutDigest.queueDigest,
    }),
  };
}

function externalSignal(
  id: RemediationExecutionSourceSignalId,
  label: string,
): RemediationExecutionSourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary: "A distinct operating authority must sign and retain this acceptance outside the Studio.",
    checks: { localSubstitutionDenied: true },
    metrics: {},
    blockers: ["Local source, fixtures, and self-authored receipts cannot replace independent acceptance."],
    evidenceUri: "/experiments",
  };
}

function executionSignal(
  definition: ActionDefinition,
  plan: RemediationExecutionPlan,
): RemediationExecutionSourceSignal {
  const action = plan.actions.find((entry) => entry.id === definition.id);
  if (!action) {
    return {
      id: definition.signalId,
      label: definition.label,
      status: "unavailable",
      summary: "The owner action could not be joined to its remediation control.",
      checks: { executionActionAvailable: false },
      metrics: {},
      blockers: ["The remediation execution definition has no matching control item."],
      evidenceUri: "/experiments",
    };
  }
  return {
    id: definition.signalId,
    label: definition.label,
    status: action.state === "satisfied" ? "pass" : "attention",
    summary: `${action.owner} action is ${action.state}; remote mutation remains disabled until an authorized operator executes and retains the receipt.`,
    checks: {
      executionActionAvailable: true,
      sourceControlSatisfied: action.state === "satisfied",
      idempotencyKeyPresent: /^[a-f0-9]{64}$/u.test(action.idempotencyKey),
      leaseAndFencePresent: /^[a-f0-9]{64}$/u.test(action.lease.fencingTokenDigest),
      rollbackDefined: Boolean(action.rollback.plan),
      remoteMutationDenied: !action.remoteMutationAllowed,
    },
    metrics: {
      owner: action.owner,
      priority: action.priority,
      state: action.state,
      leaseSeconds: action.lease.durationSeconds,
      blockedDependencies: action.blockedBy.length,
    },
    blockers: action.state === "satisfied" ? [] : [action.nextAction],
    evidenceUri: action.evidenceUri,
  };
}

function computedSignal(input: Omit<RemediationExecutionSourceSignal, "status">) {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean)
      ? ("pass" as const)
      : ("attention" as const),
  };
}

export function buildRemediationExecutionSourceSignalSnapshot(
  controlPlane: OperationalRemediationControlPlane,
): RemediationExecutionSourceSignalSnapshot {
  const plan = buildRemediationExecutionPlan(controlPlane);
  const incident = controlPlane.items.find((item) => item.sourceSignalId === "incident-diagnostics-retention");
  const desktop = controlPlane.items.find((item) => item.sourceSignalId === "desktop-upgrade-data-lifecycle");
  const allOwnerActionsSatisfied = plan.summary.satisfiedActions === plan.summary.totalActions && plan.summary.totalActions === ACTION_DEFINITIONS.length;
  const signals: RemediationExecutionSourceSignal[] = [
    ...ACTION_DEFINITIONS.map((definition) => executionSignal(definition, plan)),
    computedSignal({
      id: "execution-lease-and-fencing",
      label: "Execution lease and fencing",
      summary: `${plan.summary.totalActions} owner actions have deterministic idempotency, bounded leases, and stale-writer fencing.`,
      checks: {
        everyActionHasIdempotencyKey: plan.checks.everyActionHasIdempotencyKey,
        everyActionHasLeaseAndFence: plan.checks.everyActionHasLeaseAndFence,
        dependencyOrderPreserved: plan.checks.dependencyOrderPreserved,
        remoteMutationDenied: plan.checks.remoteMutationDenied,
      },
      metrics: { actions: plan.summary.totalActions, queueDigest: plan.queueDigest },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "rollback-evidence-package",
      label: "Rollback evidence package",
      summary: "Every owner action binds rollback instructions and its upstream evidence fingerprint into one deterministic package.",
      checks: {
        everyActionHasRollback: plan.checks.everyActionHasRollback,
        packageDigestPresent: /^[a-f0-9]{64}$/u.test(plan.packageDigest),
        queueDigestPresent: /^[a-f0-9]{64}$/u.test(plan.queueDigest),
        productionTransitionDenied: plan.checks.productionTransitionDenied,
      },
      metrics: { actions: plan.summary.totalActions, packageDigest: plan.packageDigest },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    externalSignal("independent-execution-acceptance", "Independent execution acceptance"),
    computedSignal({
      id: "slo-quality-acceptance-policy",
      label: "SLO and quality acceptance policy",
      summary: "Owner remediation can advance only when all seven execution signals pass without weakening production authority.",
      checks: {
        allOwnerActionsSatisfied,
        noBlockedOwnerActions: plan.summary.blockedActions === 0,
        qualityDecisionBounded: true,
        productionTransitionDenied: plan.productionStatus === "blocked",
      },
      metrics: {
        satisfiedActions: plan.summary.satisfiedActions,
        readyActions: plan.summary.readyActions,
        blockedActions: plan.summary.blockedActions,
      },
      blockers: allOwnerActionsSatisfied ? [] : ["Complete all seven owner execution receipts before operational acceptance."],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "incident-change-rehearsal",
      label: "Incident and change rehearsal",
      summary: "Support diagnostics and desktop lifecycle controls remain joined for replay, restore, rollback, and purge rehearsal.",
      checks: {
        incidentDiagnosticsPassing: incident?.sourceStatus === "pass",
        desktopLifecyclePassing: desktop?.sourceStatus === "pass",
        localSubstitutionDenied: true,
      },
      metrics: { incidentState: incident?.state || "missing", desktopState: desktop?.state || "missing" },
      blockers: [...(incident?.blockers || []), ...(desktop?.blockers || [])],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "owner-signoff-queue",
      label: "Owner sign-off queue",
      summary: `${plan.summary.totalActions} actions expose owner, priority, dependencies, next action, lease, rollback, and evidence location without self-approving them.`,
      checks: {
        allActionsOwned: plan.actions.every((action) => Boolean(action.owner)),
        allActionsActionable: plan.actions.every((action) => Boolean(action.nextAction)),
        allActionsFingerprinted: plan.actions.every((action) => /^[a-f0-9]{64}$/u.test(action.rollback.evidenceFingerprint)),
        remoteMutationDenied: plan.checks.remoteMutationDenied,
      },
      metrics: { actions: plan.summary.totalActions, unresolvedActions: plan.summary.readyActions + plan.summary.blockedActions },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "release-readiness-decision",
      label: "Release readiness decision",
      summary: "The decision remains HOLD until every owner execution signal and predecessor review is complete.",
      checks: {
        allOwnerActionsSatisfied,
        noBlockedOwnerActions: plan.summary.blockedActions === 0,
        executionPackageComplete: plan.summary.totalActions === ACTION_DEFINITIONS.length,
        productionTransitionDenied: plan.productionStatus === "blocked",
      },
      metrics: { decision: allOwnerActionsSatisfied ? "external-review-required" : "hold", packageDigest: plan.packageDigest },
      blockers: allOwnerActionsSatisfied ? ["Independent operational authority is still required."] : ["Source-owned remediation execution is incomplete."],
      evidenceUri: "/experiments",
    }),
    externalSignal("independent-operational-acceptance", "Independent operational acceptance"),
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
    schemaVersion: REMEDIATION_EXECUTION_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: controlPlane.generatedAt,
    localStatus: sourceOwned.every((signal) => signal.status === "pass") ? ("pass" as const) : ("attention" as const),
    summary,
    signals,
    remediationControlPlane: controlPlane,
    remediationExecutionPlan: plan,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function readRemediationExecutionSourceSignals() {
  return buildRemediationExecutionSourceSignalSnapshot(
    readOperationalRemediationControlPlane(),
  );
}
