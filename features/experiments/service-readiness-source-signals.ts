import { createHash } from "node:crypto";

import {
  readOperationalRemediationControlPlane,
  type OperationalRemediationControlPlane,
  type OperationalRemediationItem,
} from "@/features/experiments/operational-remediation-control-plane";
import type { SourceBackedSignalStatus } from "@/features/experiments/source-backed-assurance-projection";

export const SERVICE_READINESS_SOURCE_SIGNALS_SCHEMA_VERSION =
  "experiments.service-readiness-source-signals.v1" as const;

export type ServiceReadinessSourceSignalId =
  | "provider-remediation-control"
  | "retrieval-remediation-control"
  | "model-supply-chain-remediation-control"
  | "workspace-audit-remediation-control"
  | "runtime-capacity-remediation-control"
  | "benchmark-candidate-remediation-control"
  | "telemetry-export-remediation-control"
  | "remediation-dependency-graph"
  | "remediation-evidence-package"
  | "independent-remediation-acceptance"
  | "service-readiness-disclosure"
  | "support-diagnostics-readiness"
  | "upgrade-change-readiness"
  | "operational-transition-board"
  | "independent-service-readiness-closure";

export type ServiceReadinessSourceSignal = {
  id: ServiceReadinessSourceSignalId;
  label: string;
  status: SourceBackedSignalStatus;
  summary: string;
  checks: Record<string, boolean>;
  metrics: Record<string, string | number | boolean | null>;
  blockers: string[];
  evidenceUri: string;
};

export type ServiceReadinessSourceSignalSnapshot = {
  ok: true;
  schemaVersion: typeof SERVICE_READINESS_SOURCE_SIGNALS_SCHEMA_VERSION;
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
  signals: ServiceReadinessSourceSignal[];
  remediationControlPlane: OperationalRemediationControlPlane;
  stateDigest: string;
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

function externalSignal(
  id: ServiceReadinessSourceSignalId,
  label: string,
): ServiceReadinessSourceSignal {
  return {
    id,
    label,
    status: "external-only",
    summary: "A separately operated authority must review and retain this transition.",
    checks: { localSubstitutionDenied: true },
    metrics: {},
    blockers: [
      "Repository code, local fixtures, and self-authored receipts cannot replace independent operational authority.",
    ],
    evidenceUri: "/experiments",
  };
}

function itemSignal(input: {
  id: ServiceReadinessSourceSignalId;
  label: string;
  item: OperationalRemediationItem | undefined;
}): ServiceReadinessSourceSignal {
  if (!input.item) {
    return {
      id: input.id,
      label: input.label,
      status: "unavailable",
      summary: "The remediation control item is missing.",
      checks: { controlItemAvailable: false },
      metrics: {},
      blockers: ["The remediation policy and owner signal could not be joined."],
      evidenceUri: "/experiments",
    };
  }
  return {
    id: input.id,
    label: input.label,
    status: input.item.sourceStatus,
    summary: `${input.item.summary} Owner: ${input.item.owner}; state: ${input.item.state}.`,
    checks: {
      controlItemAvailable: true,
      sourceSignalPassing: input.item.sourceStatus === "pass",
      acceptanceDefined: input.item.acceptanceChecks.length > 0,
      nextActionDefined: input.item.nextActions.length > 0,
      evidenceFingerprintPresent: /^[a-f0-9]{64}$/u.test(input.item.evidenceFingerprint),
    },
    metrics: {
      owner: input.item.owner,
      priority: input.item.priority,
      state: input.item.state,
      reviewWithinHours: input.item.reviewWithinHours,
      blockedDependencies: input.item.blockedBy.length,
    },
    blockers: input.item.blockers.length
      ? input.item.blockers
      : input.item.sourceStatus === "pass"
        ? []
        : input.item.nextActions,
    evidenceUri: input.item.evidenceUri,
  };
}

function computedSignal(input: Omit<ServiceReadinessSourceSignal, "status">) {
  return {
    ...input,
    status: Object.values(input.checks).every(Boolean)
      ? ("pass" as const)
      : ("attention" as const),
  };
}

function findItem(
  controlPlane: OperationalRemediationControlPlane,
  sourceSignalId: OperationalRemediationItem["sourceSignalId"],
) {
  return controlPlane.items.find((item) => item.sourceSignalId === sourceSignalId);
}

export function buildServiceReadinessSourceSignalSnapshot(
  controlPlane: OperationalRemediationControlPlane,
): ServiceReadinessSourceSignalSnapshot {
  const directSignals: ServiceReadinessSourceSignal[] = [
    itemSignal({ id: "provider-remediation-control", label: "Provider remediation control", item: findItem(controlPlane, "provider-traffic-reconciliation") }),
    itemSignal({ id: "retrieval-remediation-control", label: "Retrieval remediation control", item: findItem(controlPlane, "retrieval-freshness-remediation") }),
    itemSignal({ id: "model-supply-chain-remediation-control", label: "Model supply-chain remediation control", item: findItem(controlPlane, "model-supply-chain-reconciliation") }),
    itemSignal({ id: "workspace-audit-remediation-control", label: "Workspace audit remediation control", item: findItem(controlPlane, "workspace-audit-completeness") }),
    itemSignal({ id: "runtime-capacity-remediation-control", label: "Runtime capacity remediation control", item: findItem(controlPlane, "runtime-recovery-efficiency") }),
    itemSignal({ id: "benchmark-candidate-remediation-control", label: "Benchmark candidate remediation control", item: findItem(controlPlane, "benchmark-cost-quality") }),
    itemSignal({ id: "telemetry-export-remediation-control", label: "Telemetry export remediation control", item: findItem(controlPlane, "telemetry-resource-transparency") }),
  ];
  const graphChecks = {
    everySignalHasPolicy: controlPlane.checks.everySignalHasPolicy,
    everyPolicyHasSignal: controlPlane.checks.everyPolicyHasSignal,
    dependencyGraphAcyclic: controlPlane.checks.dependencyGraphAcyclic,
    completeTopologicalOrder:
      controlPlane.topologicalOrder.length === controlPlane.summary.totalItems,
  };
  const packageChecks = {
    controlPlaneDigestPresent: /^[a-f0-9]{64}$/u.test(controlPlane.stateDigest),
    everyItemFingerprinted: controlPlane.items.every((item) =>
      /^[a-f0-9]{64}$/u.test(item.evidenceFingerprint),
    ),
    everyItemActionable: controlPlane.items.every(
      (item) => item.acceptanceChecks.length > 0 && item.nextActions.length > 0,
    ),
    productionTransitionDenied: controlPlane.checks.productionTransitionDenied,
  };
  const incident = findItem(controlPlane, "incident-diagnostics-retention");
  const admin = findItem(controlPlane, "admin-compatibility-sunset");
  const desktop = findItem(controlPlane, "desktop-upgrade-data-lifecycle");
  const signals: ServiceReadinessSourceSignal[] = [
    ...directSignals,
    computedSignal({
      id: "remediation-dependency-graph",
      label: "Remediation dependency graph",
      summary: `${controlPlane.topologicalOrder.length}/${controlPlane.summary.totalItems} remediation controls have a deterministic dependency order.`,
      checks: graphChecks,
      metrics: {
        controls: controlPlane.summary.totalItems,
        orderedControls: controlPlane.topologicalOrder.length,
        blockedItems: controlPlane.summary.blockedItems,
      },
      blockers: Object.entries(graphChecks)
        .filter(([, passed]) => !passed)
        .map(([key]) => `Remediation graph requires attention: ${key}.`),
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "remediation-evidence-package",
      label: "Remediation evidence package",
      summary: `${controlPlane.summary.totalItems} controls carry acceptance, action, and evidence fingerprints in one exportable package.`,
      checks: packageChecks,
      metrics: {
        controls: controlPlane.summary.totalItems,
        stateDigest: controlPlane.stateDigest,
        criticalAttentionItems: controlPlane.summary.criticalAttentionItems,
      },
      blockers: Object.entries(packageChecks)
        .filter(([, passed]) => !passed)
        .map(([key]) => `Remediation package requires attention: ${key}.`),
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-remediation-acceptance",
      "Independent remediation acceptance",
    ),
    computedSignal({
      id: "service-readiness-disclosure",
      label: "Customer service-readiness disclosure",
      summary: "Local implementation, unresolved remediation, external evidence, distribution, and production authority remain separate facts.",
      checks: {
        localStatusExplicit: ["pass", "attention"].includes(controlPlane.localStatus),
        sourceRemediationCleared: controlPlane.localStatus === "pass",
        unresolvedCountsExplicit:
          controlPlane.summary.openItems + controlPlane.summary.blockedItems >= 0,
        productionTransitionDenied: controlPlane.productionStatus === "blocked",
      },
      metrics: {
        localStatus: controlPlane.localStatus,
        unresolvedItems:
          controlPlane.summary.openItems + controlPlane.summary.blockedItems,
        productionStatus: controlPlane.productionStatus,
      },
      blockers:
        controlPlane.localStatus === "pass"
          ? []
          : ["Customer service-readiness remains attention until source-owned remediation is cleared."],
      evidenceUri: "/experiments",
    }),
    itemSignal({
      id: "support-diagnostics-readiness",
      label: "Support diagnostics readiness",
      item: incident,
    }),
    computedSignal({
      id: "upgrade-change-readiness",
      label: "Upgrade and change readiness",
      summary: "Compatibility sunset and desktop lifecycle controls stay joined without deleting wrappers or claiming notarized clean-machine acceptance.",
      checks: {
        compatibilityControlPassing: admin?.sourceStatus === "pass",
        desktopLifecyclePassing: desktop?.sourceStatus === "pass",
        localSubstitutionDenied: true,
      },
      metrics: {
        compatibilityState: admin?.state || "missing",
        desktopState: desktop?.state || "missing",
      },
      blockers: [
        ...(admin?.blockers || []),
        ...(desktop?.blockers || []),
      ],
      evidenceUri: "/experiments",
    }),
    computedSignal({
      id: "operational-transition-board",
      label: "Operational transition board",
      summary: `${controlPlane.summary.satisfiedItems} satisfied, ${controlPlane.summary.openItems} open, ${controlPlane.summary.blockedItems} blocked, and ${controlPlane.summary.externalOnlyItems} external-only controls are visible without changing authority.`,
      checks: {
        allItemsClassified:
          controlPlane.summary.satisfiedItems +
            controlPlane.summary.openItems +
            controlPlane.summary.blockedItems +
            controlPlane.summary.externalOnlyItems ===
          controlPlane.summary.totalItems,
        priorityAvailable: controlPlane.items.every((item) => Boolean(item.priority)),
        ownerAvailable: controlPlane.items.every((item) => Boolean(item.owner)),
        productionTransitionDenied: controlPlane.productionStatus === "blocked",
      },
      metrics: {
        satisfied: controlPlane.summary.satisfiedItems,
        open: controlPlane.summary.openItems,
        blocked: controlPlane.summary.blockedItems,
        externalOnly: controlPlane.summary.externalOnlyItems,
      },
      blockers: [],
      evidenceUri: "/experiments",
    }),
    externalSignal(
      "independent-service-readiness-closure",
      "Independent service-readiness closure",
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
    schemaVersion: SERVICE_READINESS_SOURCE_SIGNALS_SCHEMA_VERSION,
    generatedAt: controlPlane.generatedAt,
    localStatus: sourceOwned.every((signal) => signal.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    summary,
    signals,
    remediationControlPlane: controlPlane,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function readServiceReadinessSourceSignals() {
  return buildServiceReadinessSourceSignalSnapshot(
    readOperationalRemediationControlPlane(),
  );
}
