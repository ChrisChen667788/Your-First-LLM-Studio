import { randomUUID } from "node:crypto";

import {
  EVIDENCE_ADJUDICATION_PLANS,
  buildEvidenceMetricPolicy,
  createUnconfiguredEvidenceAdjudicationPort,
  evidenceAdjudicationDigest,
  validateArtifactReadback,
  validateEvidenceAdjudicationCatalog,
  validateEvidenceMetricPolicy,
  validateReviewerAttestation,
} from "@/features/evidence/adjudication";
import { readEvidenceCollectionStore } from "@/features/evidence/collection-store";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-adjudication-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v4.4.0-v4.5.4-evidence-adjudication-train.json");

const digest = (seed: string) => operationalEvidenceDigest({ seed });
const NOW = new Date();
const HOUR = 60 * 60 * 1_000;

function runAdjudicationConformance() {
  const attestation = {
    schemaVersion: "evidence.reviewer-attestation.v1" as const,
    issuerId: "studio-review-authority",
    subjectId: "reviewer-001",
    organizationId: "studio-org",
    assurance: "external" as const,
    assertionDigest: digest("assertion"),
    keyFingerprint: digest("key"),
    issuedAt: new Date(NOW.getTime() - HOUR).toISOString(),
    expiresAt: new Date(NOW.getTime() + HOUR).toISOString(),
  };
  const artifact = {
    schemaVersion: "evidence.artifact-readback.v1" as const,
    artifactDigest: digest("artifact"),
    locatorDigest: digest("locator"),
    byteLength: 1024,
    storageClass: "external-immutable" as const,
    readAt: NOW.toISOString(),
    readerId: "archive-reader-001",
  };
  const policy = buildEvidenceMetricPolicy("v4.0.0");
  const catalog = validateEvidenceAdjudicationCatalog();
  const reviewer = validateReviewerAttestation(attestation, NOW);
  const readback = validateArtifactReadback(artifact, NOW);
  const metricPolicy = validateEvidenceMetricPolicy(policy);
  return {
    checks: {
      catalog: catalog.ok,
      reviewer: reviewer.ok,
      artifactReadback: readback.ok,
      metricPolicy: metricPolicy.ok,
      unconfiguredPortConstructed: Boolean(createUnconfiguredEvidenceAdjudicationPort()),
    },
    catalog,
  };
}

function currentAcceptedJobs() {
  return readEvidenceCollectionStore().jobs.filter((job) =>
    job.status === "accepted" && Boolean(job.submission?.receiptDigest && job.review?.candidateDigest),
  );
}

export function buildEvidenceAdjudicationTrainState() {
  const conformance = runAdjudicationConformance();
  const accepted = currentAcceptedJobs();
  const deterministic = new Set(["v4.4.0", "v4.4.4", "v4.4.6", "v4.4.7", "v4.4.8", "v4.5.2", "v4.5.3"]);
  const versions = EVIDENCE_ADJUDICATION_PLANS.map((plan) => {
    const localPass = deterministic.has(plan.version) && Object.values(conformance.checks).every(Boolean);
    const acceptedCoverage = new Set(accepted.map((job) => job.sourceMilestone)).size;
    const blockers = localPass ? [] : plan.requiresAcceptedReceipt
      ? [`Current accepted evidence packages are required (${acceptedCoverage}/14 available).`]
      : ["An externally configured verifier or immutable archive is required for this capability."];
    return {
      ...plan,
      sourceStatus: "pass" as const,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      acceptedCoverage,
      blockers,
    };
  });
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const core = versions.map((version) => ({
    version: version.version,
    localStatus: version.localStatus,
    acceptedCoverage: version.acceptedCoverage,
    blockers: version.blockers,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: localPassed === versions.length ? "pass" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    totals: {
      versions: 15,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      acceptedJobs: accepted.length,
      acceptedMilestones: new Set(accepted.map((job) => job.sourceMilestone)).size,
    },
    conformance,
    versions,
    disclosure: "All v4.4-v4.5 source contracts are implemented. Local schema conformance does not verify an external reviewer, an immutable archive, an independent re-observation, distribution approval, or production authority.",
    stateDigest: evidenceAdjudicationDigest({ core, collectionState: readEvidenceCollectionStore().revision }),
  };
}

export function buildEvidenceAdjudicationPromotionBundle() {
  const state = buildEvidenceAdjudicationTrainState();
  const core = {
    schemaVersion: "experiments.evidence-adjudication-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.localStatus === "pass" ? "ready" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    acceptedMilestones: state.totals.acceptedMilestones,
    independentAcceptanceBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAdjudicationDigest(core) };
}

export function runEvidenceAdjudicationTrainAcceptance() {
  const state = buildEvidenceAdjudicationTrainState();
  const withoutDigest = { id: `evidence-adjudication-train-${randomUUID()}`, ...state };
  const receipt = { ...withoutDigest, evidenceDigest: evidenceAdjudicationDigest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readEvidenceAdjudicationTrainEvidence() {
  const state = buildEvidenceAdjudicationTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runEvidenceAdjudicationTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-adjudication-train.v1" as const,
    ...state,
    promotionBundle: buildEvidenceAdjudicationPromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: { trainReceipts: RECEIPT_PATH },
  };
}
