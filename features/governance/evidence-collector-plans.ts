import type { EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";

export function readGovernanceEvidenceCollectorPlans(): EvidenceCollectionPlan[] {
  return [{
    version: "v4.3.3",
    label: "Sandbox and Team Asset Collector",
    owner: "features/governance",
    track: "governance",
    kind: "collector",
    mode: "operator-assisted",
    sourceMilestones: ["v4.0.6", "v4.1.3"],
    requiredInputs: ["runtime sandbox policy", "workspace identities", "signed asset revision", "review policy"],
    artifactKinds: ["sandbox execution receipt", "teardown report", "conflict ledger", "revocation propagation"],
    executionSteps: ["deny protected scopes", "verify teardown", "race concurrent writers", "review, revoke and rollback asset"],
    timeoutMs: 30 * 60_000,
    retryPolicy: { maxAttempts: 2, baseDelayMs: 5_000, maxDelayMs: 30_000 },
    localGate: "Runtime isolation and team-asset lifecycle each produce a distinct reviewed receipt under durable identities.",
    externalGate: "Cross-platform penetration evidence, organization trust roots, OIDC/SCIM, and access review remain external.",
  }];
}
