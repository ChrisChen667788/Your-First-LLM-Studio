import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { readSecureSandboxFabricEvidence } from "@/features/extensions/secure-sandbox-fabric";
import { readTeamStudioMarketplaceEvidence } from "@/features/governance/team-studio-marketplace";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";

export function readGovernanceCollectionObservation(): DomainCollectionObservation {
  const sandbox = readSecureSandboxFabricEvidence();
  const marketplace = readTeamStudioMarketplaceEvidence();
  const evidence = { sandbox, marketplace };
  return {
    schemaVersion: "governance.sandbox-team-collection-source.v1",
    sourceKind: "derived",
    sourceStatus: sandbox.sourceStatus === "pass" && marketplace.sourceStatus === "pass" ? "pass" : "hold",
    localStatus: sandbox.localStatus === "pass" && marketplace.localStatus === "pass" ? "pass" : "hold",
    observedAt: new Date().toISOString(),
    evidenceDigest: operationalReadModelDigest(evidence),
    metrics: {
      executions: sandbox.latestOsEnforcedPassing ? 1 : 0,
      deniedScopes: sandbox.probes.denied.violations.length,
      teardownPasses: sandbox.latestOsEnforcedPassing ? 1 : 0,
      concurrentWriters: 0,
      conflicts: 0,
      revocations: 0,
    },
    summary: "Sandbox and marketplace policy evidence is available without an organization-scoped multi-user receipt.",
    blockers: ["Real multi-user conflict, revocation, rollback, and identity-bound sandbox observations have not been imported."],
    artifact: { sandbox: sandbox.probes, marketplace: marketplace.checks },
  };
}

export function collectGovernanceEvidence(
  job: EvidenceCollectionJob,
  readObservation: () => DomainCollectionObservation = readGovernanceCollectionObservation,
) {
  return collectDomainEvidenceFromObservation(job, readObservation());
}
