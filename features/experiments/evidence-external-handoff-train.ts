import { randomUUID } from "node:crypto";

import {
  EVIDENCE_AUTHORITY_CAMPAIGN_PLANS,
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
} from "@/features/evidence/authority-campaign";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import {
  EXTERNAL_EVIDENCE_HANDOFF_PLANS,
  buildExternalEvidenceCoverage,
  createExternalEvidenceAuthorityWitness,
  createExternalEvidenceDecisionEnvelope,
  createExternalEvidenceDecisionRequest,
  createExternalEvidenceDispatchReceipt,
  createExternalEvidenceHandoff,
  createExternalEvidenceObserverReceipt,
  createExternalEvidenceVerification,
  createUnconfiguredExternalEvidenceHandoffPort,
  externalEvidenceHandoffDigest,
  validateExternalEvidenceAuthorityWitness,
  validateExternalEvidenceDecisionEnvelope,
  validateExternalEvidenceDecisionRequest,
  validateExternalEvidenceDispatchReceipt,
  validateExternalEvidenceHandoff,
  validateExternalEvidenceObserverReceipt,
  validateExternalEvidenceVerification,
} from "@/features/evidence/external-handoff";
import { readExternalEvidenceHandoffStore } from "@/features/evidence/external-handoff-store";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-external-handoff-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v5.0.0-v5.1.4-external-evidence-handoff-train.json");
const digest = (seed: string) => operationalEvidenceDigest({ seed });

function runExternalHandoffConformance() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({
    kind: "workload-identity",
    reference: "workload-identity://studio-org/evidence-handoff",
  });
  const profile = createEvidenceAuthorityProfile({
    id: "studio-handoff-authority",
    organizationId: "studio-org",
    authorityConfigDigest: digest("handoff-authority-config"),
    discoveryUrl: "https://authority.example.com/handoff/discovery",
    challengeUrl: "https://authority.example.com/handoff/challenges",
    receiptUrl: "https://authority.example.com/handoff/receipts",
    credentialReference: credential,
    maxReceiptAgeHours: 72,
  });
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "source-external-handoff-campaign",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "source-external-handoff",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    escrowDigest: digest("source-escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const witnesses = ([
    "credential-resolution",
    "trust-discovery",
    "rotation-continuity",
    "archive-readback",
  ] as const).map((kind) => createExternalEvidenceAuthorityWitness({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    profileDigest: handoff.profileDigest,
    kind,
    subjectDigest: digest(`subject-${kind}`),
    issuerId: "studio-handoff-witness",
    signerKeyFingerprint: digest(`signer-${kind}`),
    observedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  }));
  const observerReceipts = EVIDENCE_COLLECTION_SOURCE_MILESTONES.map((sourceMilestone, index) => createExternalEvidenceObserverReceipt({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    sourceMilestone,
    assignmentDigest: digest(`assignment-${index}`),
    observerId: `observer-${String(index + 1).padStart(2, "0")}`,
    status: "acknowledged",
    deliveredAt: now.toISOString(),
    acknowledgedAt: now.toISOString(),
  }));
  const dispatchReceipt = createExternalEvidenceDispatchReceipt({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    endpointDigest: digest("authority-dispatch-endpoint"),
    dispatchedAt: now.toISOString(),
    accepted: true,
  });
  const verifications = EVIDENCE_COLLECTION_SOURCE_MILESTONES.map((sourceMilestone, index) => createExternalEvidenceVerification({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    sourceMilestone,
    externalReceiptDigest: digest(`external-receipt-${index}`),
    signerKeyFingerprint: digest("authority-receipt-signer"),
    signatureDigest: digest(`signature-${index}`),
    outcome: "verified",
    verifiedAt: now.toISOString(),
  }));
  const coverage = buildExternalEvidenceCoverage({ handoff, observerReceipts, dispatchReceipts: [dispatchReceipt], verifications, discrepancies: [], now: now.getTime() });
  const request = createExternalEvidenceDecisionRequest({
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    coverageDigest: coverage.coverageDigest,
    requesterId: "operator-001",
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const envelope = createExternalEvidenceDecisionEnvelope({
    requestId: request.id,
    requestDigest: request.requestDigest,
    decision: "approved",
    signerId: "independent-distribution-authority",
    signerKeyFingerprint: digest("decision-signer"),
    issuedAt: now.toISOString(),
  });
  return {
    checks: {
      authorityPlans: EVIDENCE_AUTHORITY_CAMPAIGN_PLANS.length === 15,
      handoff: validateExternalEvidenceHandoff(handoff, profile, campaign).ok,
      witnesses: witnesses.length === 4 && witnesses.every((witness) => validateExternalEvidenceAuthorityWitness(witness, handoff).ok),
      observerReceipts: observerReceipts.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length && observerReceipts.every((receipt) => validateExternalEvidenceObserverReceipt(receipt, handoff).ok),
      dispatch: validateExternalEvidenceDispatchReceipt(dispatchReceipt, handoff).ok,
      verifications: verifications.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length && verifications.every((verification) => validateExternalEvidenceVerification(verification, handoff).ok),
      coverage: coverage.coveredMilestones.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length && coverage.status === "ready-for-independent-decision",
      decision: validateExternalEvidenceDecisionRequest(request, handoff).ok && validateExternalEvidenceDecisionEnvelope(envelope, request).ok,
      unconfiguredPortConstructed: Boolean(createUnconfiguredExternalEvidenceHandoffPort()),
    },
  };
}

export function buildExternalEvidenceHandoffTrainState() {
  const conformance = runExternalHandoffConformance();
  const store = readExternalEvidenceHandoffStore();
  const coverage = store.handoffs.map((handoff) => buildExternalEvidenceCoverage({
    handoff,
    observerReceipts: store.observerReceipts,
    dispatchReceipts: store.dispatchReceipts,
    verifications: store.verifications,
    discrepancies: store.discrepancies,
  }));
  const coveredMilestones = new Set(coverage.flatMap((entry) => entry.coveredMilestones));
  const localVersions = new Set([
    "v5.0.0", "v5.0.4", "v5.0.5", "v5.0.6", "v5.0.7",
    "v5.0.9", "v5.1.0", "v5.1.2", "v5.1.4",
  ]);
  const checksPass = Object.values(conformance.checks).every(Boolean);
  const versions = EXTERNAL_EVIDENCE_HANDOFF_PLANS.map((plan) => {
    const localPass = localVersions.has(plan.version) && checksPass;
    return {
      ...plan,
      sourceStatus: "pass" as const,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      coverage: coveredMilestones.size,
      blockers: localPass
        ? []
        : plan.requiresExternalWitness
          ? [`Current independently verified handoff coverage is ${coveredMilestones.size}/14.`]
          : ["A controlled external authority connection is required for this capability."],
    };
  });
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const core = versions.map((version) => ({
    version: version.version,
    localStatus: version.localStatus,
    coverage: version.coverage,
    blockers: version.blockers,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: localPassed === versions.length ? "pass" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    totals: {
      versions: EXTERNAL_EVIDENCE_HANDOFF_PLANS.length,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      handoffs: store.handoffs.length,
      witnesses: store.witnesses.length,
      observerReceipts: store.observerReceipts.length,
      dispatchReceipts: store.dispatchReceipts.length,
      verifiedReceipts: store.verifications.filter((verification) => verification.outcome === "verified").length,
      openDiscrepancies: store.discrepancies.filter((entry) => entry.status === "open").length,
      decisionRequests: store.decisionRequests.length,
      decisionEnvelopes: store.decisionEnvelopes.length,
      coveredMilestones: coveredMilestones.size,
    },
    conformance,
    versions,
    disclosure: "All v5.0-v5.1 source contracts are implemented. A handoff, authority witness, observer delivery, dispatch receipt, verification, decision envelope, local store, or injected port does not prove controlled credentials, external authority, immutable storage, independent observation, distribution approval, or production authorization.",
    stateDigest: evidenceAcceptanceDigest({ core, handoffStoreRevision: store.revision }),
  };
}

export function buildExternalEvidenceHandoffPromotionBundle() {
  const state = buildExternalEvidenceHandoffTrainState();
  const core = {
    schemaVersion: "experiments.evidence-external-handoff-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.totals.coveredMilestones === 14 ? "ready-for-independent-decision" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    coveredMilestones: state.totals.coveredMilestones,
    remainingDomains: 14 - state.totals.coveredMilestones,
    handoffBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAcceptanceDigest(core) };
}

export function runExternalEvidenceHandoffTrainAcceptance() {
  const state = buildExternalEvidenceHandoffTrainState();
  const receiptCore = { id: `external-evidence-handoff-train-${randomUUID()}`, ...state };
  const receipt = { ...receiptCore, evidenceDigest: externalEvidenceHandoffDigest(receiptCore) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readExternalEvidenceHandoffTrainEvidence() {
  const state = buildExternalEvidenceHandoffTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runExternalEvidenceHandoffTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-external-handoff-train.v1" as const,
    ...state,
    promotionBundle: buildExternalEvidenceHandoffPromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      handoffs: getLocalAgentDataPath("experiments", "v5.0.0-v5.1.4-external-evidence-handoffs.json"),
    },
  };
}
