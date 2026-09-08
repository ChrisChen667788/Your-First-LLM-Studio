import { randomUUID } from "node:crypto";

import {
  EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS,
  buildPortableEvidenceAcceptanceManifest,
  createEvidenceAcceptanceAuthorityConfig,
  createEvidenceAcceptancePackage,
  createUnconfiguredEvidenceAcceptancePort,
  evidenceAcceptanceDigest,
  rejectEvidenceAcceptancePackage,
  submitEvidenceAcceptancePackage,
  validateEvidenceAcceptanceAuthorityConfig,
  validateEvidenceAcceptancePackage,
  validateEvidenceReobservation,
} from "@/features/evidence/acceptance-lifecycle";
import { readEvidenceAcceptanceStore } from "@/features/evidence/acceptance-store";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-acceptance-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v4.6.0-v4.7.4-evidence-acceptance-train.json");
const DAY = 24 * 60 * 60 * 1_000;

const digest = (seed: string) => operationalEvidenceDigest({ seed });

function runAcceptanceConformance() {
  const now = new Date();
  const authority = createEvidenceAcceptanceAuthorityConfig({
    issuerId: "studio-review-authority",
    organizationId: "studio-org",
    jwksUrl: "https://identity.example.com/.well-known/jwks.json",
    archiveReadbackUrl: "https://archive.example.com/evidence/readback",
    keyFingerprint: digest("authority-key"),
  });
  const packageDraft = createEvidenceAcceptancePackage({
    organizationId: authority.organizationId,
    sourceMilestone: "v4.0.0",
    idempotencyKey: "source-conformance-package",
    adjudicationDigest: digest("adjudication"),
    receiptDigest: digest("receipt"),
    attestationDigest: digest("attestation"),
    artifactDigest: digest("artifact"),
    policyDigest: digest("policy"),
    reobservationDigest: digest("reobservation"),
    now,
  });
  const submitted = submitEvidenceAcceptancePackage({
    pkg: packageDraft,
    authority,
    actorId: "operator-001",
    expectedRevision: packageDraft.revision,
    now,
  });
  const observationCore = {
    schemaVersion: "evidence.reobservation.v1" as const,
    observerId: "observer-002",
    organizationId: authority.organizationId,
    workloadDigest: digest("workload"),
    artifactDigest: packageDraft.artifactDigest,
    policyDigest: packageDraft.policyDigest,
    observedAt: now.toISOString(),
  };
  const observation = {
    ...observationCore,
    observationDigest: evidenceAcceptanceDigest(observationCore),
  };
  const rejected = rejectEvidenceAcceptancePackage({
    pkg: submitted,
    actorId: "reviewer-003",
    expectedRevision: submitted.revision,
    reason: "Controlled source conformance rejection.",
    now,
  });
  const manifest = buildPortableEvidenceAcceptanceManifest({ packages: [rejected], authority });
  return {
    checks: {
      authority: validateEvidenceAcceptanceAuthorityConfig(authority).ok,
      package: validateEvidenceAcceptancePackage(packageDraft).ok,
      submission: submitted.state === "submitted" && submitted.revision === 2,
      reobservation: validateEvidenceReobservation(observation, "operator-001").ok,
      terminalState: rejected.state === "rejected" && rejected.events[0]?.type === "rejected",
      portableManifest: typeof manifest.manifestDigest === "string" && manifest.packages.length === 1,
      unconfiguredPortConstructed: Boolean(createUnconfiguredEvidenceAcceptancePort()),
    },
  };
}

function currentVerifiedPackages() {
  const cutoff = Date.now() - 7 * DAY;
  return readEvidenceAcceptanceStore().packages.filter((pkg) =>
    pkg.state === "externally-verified" &&
    pkg.externalVerificationDigest &&
    Date.parse(pkg.updatedAt) >= cutoff,
  );
}

export function buildEvidenceAcceptanceTrainState() {
  const conformance = runAcceptanceConformance();
  const verifiedPackages = currentVerifiedPackages();
  const coveredMilestones = new Set(verifiedPackages.map((pkg) => pkg.sourceMilestone));
  const deterministic = new Set([
    "v4.6.0", "v4.6.3", "v4.6.4", "v4.6.5",
    "v4.6.6", "v4.6.8", "v4.7.1", "v4.7.2",
  ]);
  const checksPass = Object.values(conformance.checks).every(Boolean);
  const versions = EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS.map((plan) => {
    const localPass = deterministic.has(plan.version) && checksPass;
    return {
      ...plan,
      sourceStatus: "pass" as const,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      verifiedCoverage: coveredMilestones.size,
      blockers: localPass
        ? []
        : plan.requiresVerifiedPackage
          ? [`Current externally verified package coverage is ${coveredMilestones.size}/14.`]
          : ["An externally configured organization authority is required for this capability."],
    };
  });
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const core = versions.map((version) => ({
    version: version.version,
    localStatus: version.localStatus,
    verifiedCoverage: version.verifiedCoverage,
    blockers: version.blockers,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: localPassed === versions.length ? "pass" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    totals: {
      versions: EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS.length,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      verifiedPackages: verifiedPackages.length,
      verifiedMilestones: coveredMilestones.size,
    },
    conformance,
    versions,
    disclosure: "All v4.6-v4.7 source contracts are implemented. A locally constructed port, stored package, or digest-only export does not prove an external authority, immutable archive, distribution approval, or production authority.",
    stateDigest: evidenceAcceptanceDigest({ core, acceptanceStoreRevision: readEvidenceAcceptanceStore().revision }),
  };
}

export function buildEvidenceAcceptancePromotionBundle() {
  const state = buildEvidenceAcceptanceTrainState();
  const core = {
    schemaVersion: "experiments.evidence-acceptance-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.totals.verifiedMilestones === 14 ? "ready" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    verifiedMilestones: state.totals.verifiedMilestones,
    remainingDomains: 14 - state.totals.verifiedMilestones,
    handoffBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAcceptanceDigest(core) };
}

export function runEvidenceAcceptanceTrainAcceptance() {
  const state = buildEvidenceAcceptanceTrainState();
  const withoutDigest = { id: `evidence-acceptance-train-${randomUUID()}`, ...state };
  const receipt = { ...withoutDigest, evidenceDigest: evidenceAcceptanceDigest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readEvidenceAcceptanceTrainEvidence() {
  const state = buildEvidenceAcceptanceTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runEvidenceAcceptanceTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-acceptance-train.v1" as const,
    ...state,
    promotionBundle: buildEvidenceAcceptancePromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      acceptancePackages: getLocalAgentDataPath("experiments", "v4.6.0-v4.7.4-evidence-acceptance-packages.json"),
    },
  };
}
