import { createHash } from "node:crypto";

import {
  readOperationalSustainabilitySourceSignals,
  type OperationalSustainabilitySourceSignal,
  type OperationalSustainabilitySourceSignalId,
  type OperationalSustainabilitySourceSignalSnapshot,
} from "@/features/experiments/operational-sustainability-source-signals";

export const OPERATIONAL_REMEDIATION_CONTROL_PLANE_SCHEMA_VERSION =
  "experiments.operational-remediation-control-plane.v1" as const;

export type RemediationPriority = "critical" | "high" | "medium" | "low";
export type RemediationState =
  | "satisfied"
  | "open"
  | "blocked"
  | "external-only";

type RemediationPolicy = {
  sourceSignalId: OperationalSustainabilitySourceSignalId;
  owner: string;
  priority: RemediationPriority;
  reviewWithinHours: number;
  dependencyIds: OperationalSustainabilitySourceSignalId[];
  acceptanceChecks: string[];
  nextActions: string[];
};

export type OperationalRemediationItem = RemediationPolicy & {
  label: string;
  sourceStatus: OperationalSustainabilitySourceSignal["status"];
  state: RemediationState;
  summary: string;
  blockers: string[];
  blockedBy: OperationalSustainabilitySourceSignalId[];
  evidenceUri: string;
  evidenceFingerprint: string;
};

export type OperationalRemediationControlPlane = {
  ok: true;
  schemaVersion: typeof OPERATIONAL_REMEDIATION_CONTROL_PLANE_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "attention";
  productionStatus: "blocked";
  summary: {
    totalItems: number;
    satisfiedItems: number;
    openItems: number;
    blockedItems: number;
    externalOnlyItems: number;
    criticalAttentionItems: number;
  };
  checks: {
    everySignalHasPolicy: boolean;
    everyPolicyHasSignal: boolean;
    dependencyGraphAcyclic: boolean;
    everyItemHasAcceptance: boolean;
    everyItemHasAction: boolean;
    productionTransitionDenied: true;
  };
  topologicalOrder: OperationalSustainabilitySourceSignalId[];
  items: OperationalRemediationItem[];
  blockers: string[];
  stateDigest: string;
};

const POLICIES: RemediationPolicy[] = [
  {
    sourceSignalId: "provider-traffic-reconciliation",
    owner: "Provider Operations",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: [],
    acceptanceChecks: [
      "Representative traffic and one successful release probe are retained.",
      "Fallback, quota, cost, and snapshot integrity reconcile in one window.",
    ],
    nextActions: [
      "Run a configured remote provider release probe.",
      "Pin the resulting traffic and billing reconciliation snapshot.",
    ],
  },
  {
    sourceSignalId: "model-supply-chain-reconciliation",
    owner: "Model Hub",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: [],
    acceptanceChecks: [
      "An authenticated immutable Hub revision binds every selected file.",
      "Destination checksums and activation rollback are read back.",
    ],
    nextActions: [
      "Run an authenticated multi-file Hub transfer.",
      "Retain provider identity, immutable revision, and destination checksums.",
    ],
  },
  {
    sourceSignalId: "workspace-audit-completeness",
    owner: "Governance",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: [],
    acceptanceChecks: [
      "Database ACL decisions and audit events are retained.",
      "Signed privacy-safe action provenance binds request identity to effects.",
    ],
    nextActions: [
      "Run a signed workspace action through the trusted identity adapter.",
      "Reconcile the action receipt with database audit events.",
    ],
  },
  {
    sourceSignalId: "retrieval-freshness-remediation",
    owner: "Retrieval",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: ["workspace-audit-completeness"],
    acceptanceChecks: [
      "Managed vector, embedding, reranker, and RLS dependencies are configured.",
      "Freshness, deletion, citation, and cross-workspace denial probes pass.",
    ],
    nextActions: [
      "Run the managed Retrieval dependency preflight.",
      "Execute the frozen freshness, citation, deletion, and ACL evaluation set.",
    ],
  },
  {
    sourceSignalId: "runtime-recovery-efficiency",
    owner: "Runtime Fabric",
    priority: "high",
    reviewWithinHours: 48,
    dependencyIds: ["model-supply-chain-reconciliation"],
    acceptanceChecks: [
      "Two same-profile performance receipts are comparable.",
      "Load, unload, cancel, resume, restart, and benchmark recovery are covered.",
    ],
    nextActions: [
      "Run the same runtime profile twice on a representative model.",
      "Complete the six-operation lifecycle recovery rehearsal.",
    ],
  },
  {
    sourceSignalId: "agent-session-recovery",
    owner: "Agent",
    priority: "medium",
    reviewWithinHours: 168,
    dependencyIds: ["workspace-audit-completeness"],
    acceptanceChecks: [
      "Protected actions interrupt before side effects.",
      "Resume and replay produce zero duplicate side effects.",
    ],
    nextActions: [
      "Retain the passing protected-action shadow receipt.",
      "Repeat reconnect and replay after any session contract change.",
    ],
  },
  {
    sourceSignalId: "workflow-queue-failover",
    owner: "Workflow",
    priority: "high",
    reviewWithinHours: 72,
    dependencyIds: ["workspace-audit-completeness", "runtime-recovery-efficiency"],
    acceptanceChecks: [
      "Durable worker receipts have no orphan active lease.",
      "Failover fencing rejects stale workers and duplicate effects.",
    ],
    nextActions: [
      "Retain the passing process-isolated failover receipt.",
      "Repeat on an independent worker when remote lease storage is configured.",
    ],
  },
  {
    sourceSignalId: "benchmark-cost-quality",
    owner: "Benchmark",
    priority: "high",
    reviewWithinHours: 72,
    dependencyIds: ["runtime-recovery-efficiency"],
    acceptanceChecks: [
      "Distinct complete baseline and candidate runs are qualified.",
      "Confidence, non-inferiority, latency, token, and error gates are decided.",
    ],
    nextActions: [
      "Run a distinct complete 500-item candidate benchmark.",
      "Review the paired decision and bounded manual-review queue.",
    ],
  },
  {
    sourceSignalId: "finetune-cost-quality-export",
    owner: "Fine-tune",
    priority: "medium",
    reviewWithinHours: 168,
    dependencyIds: ["model-supply-chain-reconciliation", "benchmark-cost-quality"],
    acceptanceChecks: [
      "Paired quality selects the exact exported checkpoint bytes.",
      "Install read-back, rollback, cost, and ROI remain bound to the package.",
    ],
    nextActions: [
      "Retain the passing local quality and export package.",
      "Repeat publication and read-back under an organization-controlled registry.",
    ],
  },
  {
    sourceSignalId: "telemetry-resource-transparency",
    owner: "Telemetry",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: ["provider-traffic-reconciliation", "runtime-recovery-efficiency"],
    acceptanceChecks: [
      "A configured exporter emits real traces without secret disclosure.",
      "Runtime, provider, token, queue, error, and cost identities reconcile.",
    ],
    nextActions: [
      "Configure a real OTLP or Langfuse exporter.",
      "Reconcile one end-to-end trace with provider and usage receipts.",
    ],
  },
  {
    sourceSignalId: "incident-diagnostics-retention",
    owner: "Support and SRE",
    priority: "medium",
    reviewWithinHours: 168,
    dependencyIds: ["telemetry-resource-transparency"],
    acceptanceChecks: [
      "Connection, provider, and supervisor diagnostics remain replayable.",
      "Snapshot integrity, retention, redaction, and export are observable.",
    ],
    nextActions: [
      "Retain the current local diagnostics package.",
      "Repeat a representative incident replay with support ownership.",
    ],
  },
  {
    sourceSignalId: "admin-compatibility-sunset",
    owner: "Admin Platform",
    priority: "medium",
    reviewWithinHours: 720,
    dependencyIds: ["incident-diagnostics-retention"],
    acceptanceChecks: [
      "Every compatibility wrapper has a canonical replacement and smoke coverage.",
      "Runtime and historical access evidence satisfy the sunset threshold.",
    ],
    nextActions: [
      "Keep collecting source-tagged access evidence until the sunset date.",
      "Archive the final zero-traffic window before deleting wrappers.",
    ],
  },
  {
    sourceSignalId: "desktop-upgrade-data-lifecycle",
    owner: "Desktop Release",
    priority: "medium",
    reviewWithinHours: 168,
    dependencyIds: ["admin-compatibility-sunset"],
    acceptanceChecks: [
      "Signed update rollback and atomic data migration restore pass.",
      "Permission repair, uninstall, and purge remain bounded and auditable.",
    ],
    nextActions: [
      "Retain the passing local lifecycle receipts.",
      "Repeat the upgrade and restore on an independently operated clean machine.",
    ],
  },
  {
    sourceSignalId: "independent-remediation-review",
    owner: "Independent Assurance",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: [
      "provider-traffic-reconciliation",
      "retrieval-freshness-remediation",
      "model-supply-chain-reconciliation",
      "workspace-audit-completeness",
      "runtime-recovery-efficiency",
      "benchmark-cost-quality",
      "telemetry-resource-transparency",
    ],
    acceptanceChecks: [
      "A distinct authority reviews the ordered remediation evidence.",
      "The terminal digest is retained outside the repository.",
    ],
    nextActions: [
      "Submit the complete remediation package to an independent authority.",
      "Import only a signed, pinned, fresh terminal record.",
    ],
  },
  {
    sourceSignalId: "independent-sustainable-operations-review",
    owner: "Independent Service Authority",
    priority: "critical",
    reviewWithinHours: 24,
    dependencyIds: [
      "independent-remediation-review",
      "incident-diagnostics-retention",
      "admin-compatibility-sunset",
      "desktop-upgrade-data-lifecycle",
    ],
    acceptanceChecks: [
      "A separate service authority reviews supportability and upgrade continuity.",
      "The final closure remains immutable and predecessor-bound.",
    ],
    nextActions: [
      "Submit the sustainable-operations chain for independent closure.",
      "Keep production blocked until every predecessor and reviewer verifies.",
    ],
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

function buildTopologicalOrder(policies: RemediationPolicy[]) {
  const policyIds = new Set(policies.map((policy) => policy.sourceSignalId));
  const pending = new Map(
    policies.map((policy) => [
      policy.sourceSignalId,
      new Set(policy.dependencyIds.filter((id) => policyIds.has(id))),
    ]),
  );
  const order: OperationalSustainabilitySourceSignalId[] = [];
  while (pending.size) {
    const ready = [...pending.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort();
    if (!ready.length) return [];
    for (const id of ready) {
      pending.delete(id);
      order.push(id);
      for (const dependencies of pending.values()) dependencies.delete(id);
    }
  }
  return order;
}

function stateFor(
  signal: OperationalSustainabilitySourceSignal,
  blockedBy: OperationalSustainabilitySourceSignalId[],
): RemediationState {
  if (signal.status === "external-only") return "external-only";
  if (signal.status === "unavailable" || blockedBy.length) return "blocked";
  if (signal.status === "pass") return "satisfied";
  return "open";
}

export function buildOperationalRemediationControlPlane(
  source: OperationalSustainabilitySourceSignalSnapshot,
): OperationalRemediationControlPlane {
  const signals = new Map(source.signals.map((signal) => [signal.id, signal]));
  const policyIds = new Set(POLICIES.map((policy) => policy.sourceSignalId));
  const topologicalOrder = buildTopologicalOrder(POLICIES);
  const items = POLICIES.flatMap((policy) => {
    const sourceSignal = signals.get(policy.sourceSignalId);
    if (!sourceSignal) return [];
    const blockedBy = policy.dependencyIds.filter(
      (id) => signals.get(id)?.status !== "pass",
    );
    return [
      {
        ...policy,
        label: sourceSignal.label,
        sourceStatus: sourceSignal.status,
        state: stateFor(sourceSignal, blockedBy),
        summary: sourceSignal.summary,
        blockers: sourceSignal.blockers,
        blockedBy,
        evidenceUri: sourceSignal.evidenceUri,
        evidenceFingerprint: digest({
          id: sourceSignal.id,
          status: sourceSignal.status,
          checks: sourceSignal.checks,
          metrics: sourceSignal.metrics,
          blockers: sourceSignal.blockers,
        }),
      },
    ];
  });
  const checks = {
    everySignalHasPolicy: source.signals.every((signal) => policyIds.has(signal.id)),
    everyPolicyHasSignal: POLICIES.every((policy) => signals.has(policy.sourceSignalId)),
    dependencyGraphAcyclic: topologicalOrder.length === POLICIES.length,
    everyItemHasAcceptance: items.every((item) => item.acceptanceChecks.length > 0),
    everyItemHasAction: items.every((item) => item.nextActions.length > 0),
    productionTransitionDenied: true as const,
  };
  const summary = {
    totalItems: items.length,
    satisfiedItems: items.filter((item) => item.state === "satisfied").length,
    openItems: items.filter((item) => item.state === "open").length,
    blockedItems: items.filter((item) => item.state === "blocked").length,
    externalOnlyItems: items.filter((item) => item.state === "external-only").length,
    criticalAttentionItems: items.filter(
      (item) => item.priority === "critical" && ["open", "blocked"].includes(item.state),
    ).length,
  };
  const blockers = [
    ...Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => `Remediation control-plane integrity requires attention: ${key}.`),
    ...items
      .filter((item) => item.state === "open" || item.state === "blocked")
      .map((item) => `${item.label}: ${item.blockers[0] || item.nextActions[0]}`),
  ];
  const withoutDigest = {
    ok: true as const,
    schemaVersion: OPERATIONAL_REMEDIATION_CONTROL_PLANE_SCHEMA_VERSION,
    generatedAt: source.generatedAt,
    localStatus:
      Object.values(checks).every(Boolean) && summary.openItems + summary.blockedItems === 0
        ? ("pass" as const)
        : ("attention" as const),
    productionStatus: "blocked" as const,
    summary,
    checks,
    topologicalOrder,
    items,
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

export function readOperationalRemediationControlPlane() {
  return buildOperationalRemediationControlPlane(
    readOperationalSustainabilitySourceSignals(),
  );
}
