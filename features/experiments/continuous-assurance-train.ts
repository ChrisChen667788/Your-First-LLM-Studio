import {
  buildExternalAssuranceChainState,
  readExternalAssuranceArtifact,
  type ExternalAssuranceArtifact,
  type ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import { readPostGaOperationsTrain } from "@/features/experiments/post-ga-operations-train";

export const CONTINUOUS_ASSURANCE_TRAIN_SCHEMA_VERSION =
  "experiments.continuous-assurance-train.v1" as const;

export const CONTINUOUS_ASSURANCE_DEFINITIONS: ExternalAssuranceDefinition[] = [
  {
    version: "v2.2.0",
    key: "COMPLIANCE_SCOPE",
    label: "Compliance Scope Baseline",
    schemaVersion: "enterprise.compliance-scope-baseline.v1",
    sourceContracts: ["versioned control inventory and jurisdiction map", "externally signed observation window and coverage", "v2.1.9 predecessor binding"],
    externalBlocker: "The organization compliance owner must attest the deployed control inventory and applicable jurisdictions.",
    requiredAssertions: ["control-inventory-versioned", "jurisdictions-declared"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.1",
    key: "PRIVACY_PROCESSING",
    label: "Privacy Processing Review",
    schemaVersion: "enterprise.privacy-processing-review.v1",
    sourceContracts: ["processing-register and purpose-limitation evidence", "data-subject control rehearsal", "predecessor-bound privacy decision"],
    externalBlocker: "A deployed privacy program and its accountable owner must supply processing, consent, deletion, and data-subject evidence.",
    requiredAssertions: ["processing-register-reviewed", "data-subject-controls-tested"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 95,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.2",
    key: "AI_MODEL_RISK",
    label: "AI and Model Risk Governance",
    schemaVersion: "enterprise.ai-model-risk-governance.v1",
    sourceContracts: ["deployed model inventory and risk-tier digest", "high-risk system review and human oversight", "fail-closed model governance projection"],
    externalBlocker: "The independent model-risk function must reconcile deployed models, risk tiers, evaluations, and accountable human oversight.",
    requiredAssertions: ["model-inventory-reconciled", "high-risk-systems-reviewed"],
    minObservationWindowHours: 48,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.3",
    key: "THIRD_PARTY_RISK",
    label: "Third-party Assurance",
    schemaVersion: "enterprise.third-party-assurance.v1",
    sourceContracts: ["critical-vendor inventory and assessment digest", "subprocessor change reconciliation", "revocation-aware dependency review"],
    externalBlocker: "Procurement, security, and privacy owners must attest critical vendors and deployed subprocessors from their systems of record.",
    requiredAssertions: ["critical-vendors-reviewed", "subprocessor-changes-reconciled"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.4",
    key: "REGULATORY_MAPPING",
    label: "Regulatory Control Mapping",
    schemaVersion: "enterprise.regulatory-control-mapping.v1",
    sourceContracts: ["versioned obligation-to-control mapping", "material obligation coverage assertion", "jurisdiction-aware external review"],
    externalBlocker: "Qualified legal and compliance reviewers must approve the applicable obligations and deployed control mappings.",
    requiredAssertions: ["control-mappings-reviewed", "material-obligations-covered"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.5",
    key: "TRUST_TRANSPARENCY",
    label: "Customer Trust and Transparency",
    schemaVersion: "enterprise.customer-trust-transparency.v1",
    sourceContracts: ["current trust disclosure digest", "audience-scoped customer evidence access", "non-secret transparency review"],
    externalBlocker: "Customer trust, legal, and security owners must publish and approve current disclosures outside the Studio.",
    requiredAssertions: ["trust-disclosures-current", "customer-evidence-access-reviewed"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
  },
  {
    version: "v2.2.6",
    key: "RESPONSIBLE_UX",
    label: "Accessibility and Responsible UX",
    schemaVersion: "enterprise.accessibility-responsible-ux.v1",
    sourceContracts: ["accessibility sample and assistive-technology evidence", "human oversight and appeal-path rehearsal", "responsible UX review digest"],
    externalBlocker: "Accessibility specialists and product governance must independently test the deployed user journeys and oversight paths.",
    requiredAssertions: ["accessibility-sample-passed", "human-oversight-path-tested"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 90,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.7",
    key: "RESOURCE_EFFICIENCY",
    label: "Resource Efficiency Review",
    schemaVersion: "enterprise.resource-efficiency-review.v1",
    sourceContracts: ["capacity-efficiency and workload digest", "declared energy or carbon accounting source", "cost-quality-performance tradeoff review"],
    externalBlocker: "Infrastructure and sustainability owners must supply measured workload and energy/accounting evidence; local estimates are insufficient.",
    requiredAssertions: ["capacity-efficiency-reviewed", "accounting-source-declared"],
    minObservationWindowHours: 168,
    minimumCoveragePct: 90,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.8",
    key: "REMEDIATION",
    label: "Compliance Remediation Closure",
    schemaVersion: "enterprise.compliance-remediation-closure.v1",
    sourceContracts: ["finding and remediation ledger digest", "critical closure and waiver-expiry assertions", "evidence-preserving remediation projection"],
    externalBlocker: "Authoritative audit and issue-management systems must prove closure, ownership, expiry, and retained evidence for every material finding.",
    requiredAssertions: ["critical-findings-closed", "waivers-current"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
  },
  {
    version: "v2.2.9",
    key: "INDEPENDENT_COMPLIANCE_REVIEW",
    label: "Independent Compliance Review",
    schemaVersion: "enterprise.independent-compliance-review.v1",
    sourceContracts: ["ordered v2.2.0-v2.2.8 digest review", "distinct independent reviewer and review digest", "terminal read-only compliance projection"],
    externalBlocker: "A distinct external compliance-review authority must sign the complete chain and retain its review record.",
    requiredAssertions: ["full-chain-reviewed", "reviewer-independent"],
    minObservationWindowHours: 24,
    minimumCoveragePct: 100,
    requireSecondaryDigest: true,
    finalReview: true,
  },
];

export function buildContinuousAssuranceTrainState(input: {
  anchor: Parameters<typeof buildExternalAssuranceChainState>[0]["anchor"];
  artifacts: ExternalAssuranceArtifact[];
  now: number;
}) {
  return buildExternalAssuranceChainState({
    definitions: CONTINUOUS_ASSURANCE_DEFINITIONS,
    ...input,
  });
}

export function readContinuousAssuranceTrain() {
  const postGa = readPostGaOperationsTrain();
  const anchorVersion = postGa.versions.find((version) => version.version === "v2.1.9");
  const artifacts = CONTINUOUS_ASSURANCE_DEFINITIONS.map((definition) =>
    readExternalAssuranceArtifact(`FIRST_LLM_CONTINUOUS_ASSURANCE_${definition.key}`),
  );
  const state = buildContinuousAssuranceTrainState({
    anchor: {
      version: "v2.1.9",
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
    schemaVersion: CONTINUOUS_ASSURANCE_TRAIN_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...state,
    configuredVersions: CONTINUOUS_ASSURANCE_DEFINITIONS.filter(
      (_, index) => artifacts[index]?.present,
    ).map((definition) => definition.version),
  };
}
