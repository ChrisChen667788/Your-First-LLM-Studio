import { readAgentEvidenceCollectorPlans } from "@/features/agent/evidence-collector-plans";
import { readBenchmarkEvidenceCollectorPlans } from "@/features/benchmark/evidence-collector-plans";
import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";
import { readFineTuneEvidenceCollectorPlans } from "@/features/finetune/evidence-collector-plans";
import { readGovernanceEvidenceCollectorPlans } from "@/features/governance/evidence-collector-plans";
import { readModelEvidenceCollectorPlans } from "@/features/models/evidence-collector-plans";
import { readProviderEvidenceCollectorPlans } from "@/features/providers/evidence-collector-plans";
import { readRetrievalEvidenceCollectorPlans } from "@/features/retrieval/evidence-collector-plans";

export function evidenceCollectorExecutionStatus(version: string) {
  return [
    "v4.2.4", "v4.2.5", "v4.2.6", "v4.2.7", "v4.2.8",
    "v4.2.9", "v4.3.0", "v4.3.1", "v4.3.2", "v4.3.3",
  ].includes(version) ? "implemented" as const : "planned" as const;
}

export const EVIDENCE_COLLECTION_SOURCE_MILESTONES = [
  "v4.0.0", "v4.0.1", "v4.0.2", "v4.0.3", "v4.0.4", "v4.0.5", "v4.0.6",
  "v4.0.7", "v4.0.8", "v4.0.9", "v4.1.0", "v4.1.1", "v4.1.2", "v4.1.3",
] as const;

function controlPlans(): EvidenceCollectionPlan[] {
  return [
    {
      version: "v4.2.0",
      label: "Evidence Collection Job Contract",
      owner: "features/evidence",
      track: "platform",
      kind: "control",
      mode: "operator-assisted",
      sourceMilestones: [],
      requiredInputs: ["durable operator identity", "source milestone", "subject", "idempotency key"],
      artifactKinds: ["strict job envelope", "append-only transition events"],
      executionSteps: ["validate exact identifiers", "bind plan and source milestone", "seal initial revision"],
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1_000, maxDelayMs: 1_000 },
      localGate: "Strict contracts reject placeholder identity, unsupported milestones, and malformed revisions.",
      externalGate: "A valid local job does not establish workload authorization.",
    },
    {
      version: "v4.2.1",
      label: "Durable Queue and Idempotency",
      owner: "features/evidence",
      track: "platform",
      kind: "control",
      mode: "automatic",
      sourceMilestones: [],
      requiredInputs: ["validated collection job", "bounded idempotency key"],
      artifactKinds: ["atomic queue state", "recovery backup", "deduplication index"],
      executionSteps: ["lock durable store", "deduplicate enqueue", "atomically replace state", "recover or quarantine corruption"],
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1_000, maxDelayMs: 1_000 },
      localGate: "Repeated enqueue with one idempotency key returns one durable job.",
      externalGate: "Remote durable queue and organization retention policy remain external.",
    },
    {
      version: "v4.2.2",
      label: "Lease Heartbeat and Fencing",
      owner: "features/evidence",
      track: "platform",
      kind: "control",
      mode: "automatic",
      sourceMilestones: [],
      requiredInputs: ["worker identity", "expected job revision", "bounded lease TTL"],
      artifactKinds: ["lease transitions", "fence token", "retry schedule"],
      executionSteps: ["claim exclusive lease", "heartbeat", "recover expiry", "deny stale worker"],
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1_000, maxDelayMs: 1_000 },
      localGate: "Expired leases recover with a higher fence token and stale workers cannot mutate the job.",
      externalGate: "Independent worker hosts and remote lease storage remain external.",
    },
    {
      version: "v4.2.3",
      label: "Collector Capability Registry",
      owner: "features/evidence",
      track: "platform",
      kind: "control",
      mode: "automatic",
      sourceMilestones: [],
      requiredInputs: ["feature-owned collector descriptors", "source milestone coverage"],
      artifactKinds: ["collector matrix", "retry and timeout policy", "coverage digest"],
      executionSteps: ["load feature plans", "validate unique ownership", "verify complete source coverage", "publish capabilities"],
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1_000, maxDelayMs: 1_000 },
      localGate: "All fourteen domain milestones map exactly once to ten feature-owned collector plans.",
      externalGate: "Registered capability does not prove an authorized workload ran.",
    },
  ];
}

function promotionPlan(): EvidenceCollectionPlan {
  return {
    version: "v4.3.4",
    label: "Evidence Review and Promotion Bundle",
    owner: "features/experiments",
    track: "release",
    kind: "release",
    mode: "operator-assisted",
    sourceMilestones: [],
    requiredInputs: ["accepted reviewed jobs", "current evidence operations state", "artifact digests"],
    artifactKinds: ["review queue summary", "promotion bundle", "independent acceptance backlog"],
    executionSteps: ["revalidate accepted receipts", "join source milestones", "seal promotion bundle", "preserve external holds"],
    timeoutMs: 60_000,
    retryPolicy: { maxAttempts: 1, baseDelayMs: 1_000, maxDelayMs: 1_000 },
    localGate: "All fourteen source milestones have distinct accepted jobs and the upstream evidence-operations gate passes.",
    externalGate: "Independent signatures, immutable archive read-back, distribution approval, and production authority remain external.",
  };
}

export function readEvidenceCollectorPlans() {
  return [
    ...readProviderEvidenceCollectorPlans(),
    ...readAgentEvidenceCollectorPlans(),
    ...readBenchmarkEvidenceCollectorPlans(),
    ...readModelEvidenceCollectorPlans(),
    ...readRetrievalEvidenceCollectorPlans(),
    ...readFineTuneEvidenceCollectorPlans(),
    ...readGovernanceEvidenceCollectorPlans(),
  ];
}

export function readEvidenceCollectionPlans() {
  return [...controlPlans(), ...readEvidenceCollectorPlans(), promotionPlan()];
}

export function validateEvidenceCollectionCatalog(plans = readEvidenceCollectionPlans()) {
  const collectors = plans.filter((plan) => plan.kind === "collector");
  const covered = collectors.flatMap((plan) => plan.sourceMilestones);
  const expected = [...EVIDENCE_COLLECTION_SOURCE_MILESTONES];
  const checks = {
    fifteenVersions: plans.length === 15,
    uniqueVersions: new Set(plans.map((plan) => plan.version)).size === plans.length,
    tenCollectors: collectors.length === 10,
    completeSourceCoverage:
      covered.length === expected.length && expected.every((version) => covered.includes(version)),
    uniqueSourceOwnership: new Set(covered).size === covered.length,
    featureOwnership: plans.every((plan) => plan.owner.startsWith("features/")),
    boundedExecution: plans.every((plan) => plan.timeoutMs >= 5_000 && plan.timeoutMs <= 24 * 60 * 60_000),
    boundedRetry: plans.every((plan) =>
      plan.retryPolicy.maxAttempts >= 1 &&
      plan.retryPolicy.maxAttempts <= 5 &&
      plan.retryPolicy.baseDelayMs >= 0 &&
      plan.retryPolicy.maxDelayMs >= plan.retryPolicy.baseDelayMs
    ),
    actionablePlans: plans.every((plan) =>
      plan.requiredInputs.length > 0 &&
      plan.artifactKinds.length > 0 &&
      plan.executionSteps.length > 0 &&
      plan.localGate.length > 0 &&
      plan.externalGate.length > 0
    ),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    schemaVersion: "evidence.collection-capability-registry.v1" as const,
    checks,
    totals: { plans: plans.length, collectors: collectors.length, coveredSourceMilestones: covered.length },
    coveredSourceMilestones: covered,
  };
}
