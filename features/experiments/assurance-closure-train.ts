import {
  buildExternalAssuranceChainState,
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
  type ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import { readContinuousAssuranceTrain } from "@/features/experiments/continuous-assurance-train";

export const ASSURANCE_CLOSURE_TRAIN_SCHEMA_VERSION =
  "experiments.assurance-closure-train.v1" as const;

export const ASSURANCE_CLOSURE_DEFINITIONS: ExternalAssuranceDefinition[] = [
  {
    version: "v2.3.0",
    key: "EVIDENCE_PORTABILITY",
    label: "Assurance Evidence Portability",
    schemaVersion: "enterprise.assurance-evidence-portability.v1",
    sourceContracts: ["portable signed evidence manifest", "digest and predecessor preservation", "destination read-back verification"],
    externalBlocker: "An independent destination must import and read back the evidence package without changing its signatures or digests.",
    requiredAssertions: ["portable-manifest-exported", "destination-readback-verified"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.3.1",
    key: "TRUST_CENTER",
    label: "Trust Center Publication",
    schemaVersion: "enterprise.trust-center-publication.v1",
    sourceContracts: ["published disclosure inventory", "audience and confidentiality policy", "freshness and withdrawal controls"],
    externalBlocker: "A separately operated trust center must publish, scope, refresh, and withdraw approved disclosures.",
    requiredAssertions: ["approved-disclosures-published", "audience-scoping-enforced"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.3.2",
    key: "CONTINUOUS_MONITORING",
    label: "Continuous Assurance Automation",
    schemaVersion: "enterprise.continuous-assurance-automation.v1",
    sourceContracts: ["deployed control-monitor inventory", "alert and escalation evidence", "false-negative and stale-signal review"],
    externalBlocker: "Managed monitors, alert receivers, and accountable responders must prove sustained operation outside this repository.",
    requiredAssertions: ["control-monitors-operational", "alert-escalation-tested"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.3.3",
    key: "AUDIT_REMEDIATION",
    label: "Independent Audit Remediation",
    schemaVersion: "enterprise.independent-audit-remediation.v1",
    sourceContracts: ["independent finding and action ledger", "owner, deadline, closure, and retest lineage", "zero overdue critical finding assertion"],
    externalBlocker: "Independent auditors and organization owners must retain findings, retests, closures, and accepted residual risk.",
    requiredAssertions: ["findings-lineage-complete", "overdue-critical-findings-zero"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.3.4",
    key: "ASSURANCE_ARCHIVE",
    label: "Assurance Closure Archive",
    schemaVersion: "enterprise.assurance-closure-archive.v1",
    sourceContracts: ["ordered v2.3.0-v2.3.3 closure digest chain", "immutable retention and independent reviewer", "terminal no-transition archive projection"],
    externalBlocker: "A distinct archive and assurance authority must sign and retain the complete closure package in externally controlled immutable storage.",
    requiredAssertions: ["closure-chain-reviewed", "immutable-retention-confirmed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildAssuranceClosureTrainState(input: {
  anchor: Parameters<typeof buildExternalAssuranceChainState>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  now: number;
}) {
  return buildExternalAssuranceChainState({
    definitions: ASSURANCE_CLOSURE_DEFINITIONS,
    ...input,
  });
}

export function readAssuranceClosureTrain() {
  const continuousAssurance = readContinuousAssuranceTrain();
  const anchorVersion = continuousAssurance.versions.find(
    (version) => version.version === "v2.2.9",
  );
  const artifacts = ASSURANCE_CLOSURE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_ASSURANCE_CLOSURE_${definition.key}`),
  );
  const state = buildAssuranceClosureTrainState({
    anchor: {
      version: "v2.2.9",
      evidenceStatus: anchorVersion?.evidenceStatus || "missing",
      digest: anchorVersion?.digest || null,
      recordId: anchorVersion?.recordId || null,
      issuerOrganizationId: anchorVersion?.issuerOrganizationId || null,
    },
    artifacts,
    now: Date.now(),
  });
  return {
    ok: true as const,
    schemaVersion: ASSURANCE_CLOSURE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    configuredVersions: ASSURANCE_CLOSURE_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
