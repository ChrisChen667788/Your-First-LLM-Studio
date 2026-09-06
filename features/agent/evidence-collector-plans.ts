import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readAgentEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [
    {
      version: "v4.2.6",
      label: "Agent Harness and Worker Collector",
      owner: "features/agent",
      track: "agent",
      kind: "collector",
      mode: "operator-assisted",
      sourceMilestones: ["v4.0.3", "v4.0.5"],
      requiredInputs: ["eligible live targets", "protected-action policy", "isolated worker identities"],
      artifactKinds: ["harness matrix", "protected-effect ledger", "worker isolation trace", "merge review"],
      executionSteps: ["run lifecycle scenarios", "exercise approval and resume", "recover expired worker", "review file conflicts"],
      timeoutMs: 45 * 60_000,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 10_000, maxDelayMs: 60_000 },
      localGate: "Every eligible target and isolated worker path has a reviewed receipt with zero duplicate protected effects.",
      externalGate: "Independent worker-host identity and provider-side request evidence remain external.",
    },
    {
      version: "v4.2.7",
      label: "Cache and Billing Reconciliation Collector",
      owner: "features/agent",
      track: "agent",
      kind: "collector",
      mode: "external-import",
      sourceMilestones: ["v4.0.4"],
      requiredInputs: ["request-chain ledger", "provider cached-token record", "billing-period export"],
      artifactKinds: ["cache attribution", "token reconciliation", "unattributed exception report"],
      executionSteps: ["join request identities", "compare cached and billed tokens", "isolate mismatches", "seal non-financial diagnostics"],
      timeoutMs: 10 * 60_000,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 5_000, maxDelayMs: 30_000 },
      localGate: "Provider-native token records reconcile with local request chains and all exceptions stay visible.",
      externalGate: "Provider invoices remain the financial system of record.",
    },
  ];
}
