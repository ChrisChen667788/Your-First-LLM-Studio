import { randomUUID } from "node:crypto";
import { createActivationIntakeService } from "@/features/evidence/activation-intake/service";

import {
  EXTERNAL_EVIDENCE_ACTIVATION_PLANS,
  EXTERNAL_EVIDENCE_ACTIVATION_STAGES,
  buildExternalEvidenceActivationReconciliation,
  createExternalEvidenceActivationDecisionReceipt,
  createExternalEvidenceActivationDecisionRequest,
  createExternalEvidenceActivationManifest,
  createExternalEvidenceActivationObservation,
  createExternalEvidenceActivationQuarantine,
  createUnconfiguredExternalEvidenceActivationPort,
  validateExternalEvidenceActivationDecisionReceipt,
  validateExternalEvidenceActivationDecisionRequest,
  validateExternalEvidenceActivationManifest,
  validateExternalEvidenceActivationObservation,
  validateExternalEvidenceActivationQuarantine,
  validateExternalEvidenceActivationReconciliation,
} from "@/features/evidence/external-activation";
import {
  createEvidenceAuthorityCampaign,
  createEvidenceAuthorityCredentialReference,
  createEvidenceAuthorityProfile,
} from "@/features/evidence/authority-campaign";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { createExternalEvidenceHandoff } from "@/features/evidence/external-handoff";
import { readExternalEvidenceHandoffStore } from "@/features/evidence/external-handoff-store";
import {
  createExternalEvidenceRelayConfiguration,
  externalEvidenceRelayDigest,
} from "@/features/evidence/external-relay";
import { readExternalEvidenceRelayStore } from "@/features/evidence/external-relay-store";
import {
  externalEvidenceActivationStorePath,
  readExternalEvidenceActivationStore,
} from "@/features/evidence/external-activation-store";
import { evidenceAcceptanceDigest } from "@/features/evidence/acceptance-lifecycle";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_SCHEMA_VERSION = "experiments.evidence-external-activation-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("experiments", "v5.4.0-v5.5.4-external-evidence-activation-train.json");
const RELAY_URL = "https://relay.example.com/v1/handoffs";
const RECEIPT_URL = "https://relay.example.com/v1/receipts";
const digest = (seed: string) => operationalEvidenceDigest({ seed });

function buildConformanceFixture() {
  const now = new Date();
  const credential = createEvidenceAuthorityCredentialReference({
    kind: "workload-identity",
    reference: "workload-identity://studio-org/external-activation",
  });
  const profile = createEvidenceAuthorityProfile({
    id: "activation-authority-profile",
    organizationId: "studio-org",
    authorityConfigDigest: digest("activation-authority-config"),
    discoveryUrl: "https://authority.example.com/activation/discovery",
    challengeUrl: "https://authority.example.com/activation/challenges",
    receiptUrl: "https://authority.example.com/activation/receipts",
    credentialReference: credential,
    maxReceiptAgeHours: 72,
  });
  const campaign = createEvidenceAuthorityCampaign({
    idempotencyKey: "activation-authority-campaign",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const handoff = createExternalEvidenceHandoff({
    idempotencyKey: "activation-source-handoff",
    profileId: profile.id,
    profileDigest: profile.profileDigest,
    campaignId: campaign.id,
    campaignDigest: campaign.campaignDigest,
    escrowDigest: digest("activation-escrow"),
    requesterId: "operator-001",
    sourceMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const configuration = createExternalEvidenceRelayConfiguration({
    id: "activation-relay-001",
    profileDigest: profile.profileDigest,
    authorityId: "activation-authority-001",
    relayUrl: RELAY_URL,
    receiptUrl: RECEIPT_URL,
    credentialReferenceDigest: digest("activation-credential-reference"),
    trustAnchorFingerprint: digest("activation-trust-anchor"),
    maxRequestAgeMinutes: 60,
    createdAt: now.toISOString(),
  });
  const manifest = createExternalEvidenceActivationManifest({
    id: "activation-manifest-001",
    relayConfigurationId: configuration.id,
    relayConfigurationDigest: configuration.configurationDigest,
    handoffId: handoff.id,
    handoffDigest: handoff.handoffDigest,
    authorityId: configuration.authorityId,
    authorityKeyFingerprint: configuration.trustAnchorFingerprint,
    activationPolicyDigest: digest("activation-policy"),
    requiredStages: [...EXTERNAL_EVIDENCE_ACTIVATION_STAGES],
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
  });
  const globalObservations = EXTERNAL_EVIDENCE_ACTIVATION_STAGES
    .filter((stage) => stage !== "observer-attestation" && stage !== "receipt-verification")
    .map((stage, index) => createExternalEvidenceActivationObservation({
      id: `activation-global-observation-${String(index + 1).padStart(2, "0")}`,
      manifestId: manifest.id,
      manifestDigest: manifest.manifestDigest,
      stage,
      sourceMilestone: null,
      externalEvidenceDigest: digest(`activation-global-evidence-${stage}`),
      signerKeyFingerprint: manifest.authorityKeyFingerprint,
      signatureDigest: digest(`activation-global-signature-${stage}`),
      status: "verified",
      receivedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
    }));
  const milestoneObservations = EVIDENCE_COLLECTION_SOURCE_MILESTONES.flatMap((sourceMilestone, index) =>
    (["observer-attestation", "receipt-verification"] as const).map((stage) => createExternalEvidenceActivationObservation({
      id: `activation-${stage}-${String(index + 1).padStart(2, "0")}`,
      manifestId: manifest.id,
      manifestDigest: manifest.manifestDigest,
      stage,
      sourceMilestone,
      externalEvidenceDigest: digest(`activation-${stage}-evidence-${index}`),
      signerKeyFingerprint: manifest.authorityKeyFingerprint,
      signatureDigest: digest(`activation-${stage}-signature-${index}`),
      status: "verified",
      receivedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
    })),
  );
  const reconciliation = buildExternalEvidenceActivationReconciliation({
    manifest,
    handoff,
    observations: [...globalObservations, ...milestoneObservations],
    quarantines: [],
    now: now.getTime(),
  });
  const decisionRequest = createExternalEvidenceActivationDecisionRequest({
    id: "activation-decision-request-001",
    idempotencyKey: "activation-decision-key-001",
    manifestId: manifest.id,
    manifestDigest: manifest.manifestDigest,
    reconciliationDigest: reconciliation.reconciliationDigest,
    decisionAuthorityId: "distribution-authority-001",
    decisionAuthorityKeyFingerprint: digest("distribution-authority-key"),
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1_000).toISOString(),
  });
  const decisionReceipt = createExternalEvidenceActivationDecisionReceipt({
    id: "activation-decision-receipt-001",
    requestId: decisionRequest.id,
    requestDigest: decisionRequest.requestDigest,
    manifestId: manifest.id,
    manifestDigest: manifest.manifestDigest,
    externalDecisionDigest: digest("activation-decision-evidence"),
    signerKeyFingerprint: decisionRequest.decisionAuthorityKeyFingerprint,
    signatureDigest: digest("activation-decision-signature"),
    status: "accepted",
    receivedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  });
  const quarantine = createExternalEvidenceActivationQuarantine({
    id: "activation-quarantine-001",
    manifestId: manifest.id,
    manifestDigest: manifest.manifestDigest,
    observationId: globalObservations[0]?.id || null,
    observationDigest: globalObservations[0]?.observationDigest || null,
    code: "binding-mismatch",
    payloadDigest: digest("activation-rejected-payload"),
    detailDigest: digest("activation-rejected-detail"),
    observedAt: now.toISOString(),
  });
  return {
    now,
    configuration,
    handoff,
    manifest,
    globalObservations,
    milestoneObservations,
    reconciliation,
    decisionRequest,
    decisionReceipt,
    quarantine,
  };
}

function runExternalEvidenceActivationConformance() {
  const fixture = buildConformanceFixture();
  return {
    checks: {
      activationPlans: EXTERNAL_EVIDENCE_ACTIVATION_PLANS.length === 15,
      manifest: validateExternalEvidenceActivationManifest(fixture.manifest, fixture.configuration, fixture.handoff).ok,
      observations: [...fixture.globalObservations, ...fixture.milestoneObservations].every((observation) => validateExternalEvidenceActivationObservation(observation, fixture.manifest).ok),
      quarantine: validateExternalEvidenceActivationQuarantine(fixture.quarantine, fixture.manifest, fixture.globalObservations[0]).ok,
      reconciliation: validateExternalEvidenceActivationReconciliation(fixture.reconciliation, fixture.manifest, fixture.handoff).ok && fixture.reconciliation.status === "eligible-for-independent-decision",
      decisionRequest: validateExternalEvidenceActivationDecisionRequest(fixture.decisionRequest, fixture.manifest, fixture.reconciliation).ok,
      decisionReceipt: validateExternalEvidenceActivationDecisionReceipt(fixture.decisionReceipt, fixture.decisionRequest).ok,
      unconfiguredPortConstructed: Boolean(createUnconfiguredExternalEvidenceActivationPort()),
    },
  };
}

export function buildExternalEvidenceActivationTrainState() {
  const conformance = runExternalEvidenceActivationConformance();
  const store = readExternalEvidenceActivationStore();
  const relayStore = readExternalEvidenceRelayStore();
  const handoffStore = readExternalEvidenceHandoffStore();
  const reconciliations = store.manifests.flatMap((manifest) => {
    const configuration = relayStore.configurations.find((entry) => entry.id === manifest.relayConfigurationId && entry.configurationDigest === manifest.relayConfigurationDigest);
    const handoff = handoffStore.handoffs.find((entry) => entry.id === manifest.handoffId && entry.handoffDigest === manifest.handoffDigest);
    return configuration && handoff && validateExternalEvidenceActivationManifest(manifest, configuration, handoff).ok
      ? [buildExternalEvidenceActivationReconciliation({ manifest, handoff, observations: store.observations, quarantines: store.quarantines })]
      : [];
  });
  const coveredMilestones = new Set(reconciliations.flatMap((entry) => entry.coveredMilestones));
  const eligibleReconciliations = reconciliations.filter((entry) => entry.status === "eligible-for-independent-decision");
  const localVersions = new Set([
    "v5.4.0", "v5.4.4", "v5.4.6", "v5.4.8", "v5.4.9",
    "v5.5.0", "v5.5.1", "v5.5.2", "v5.5.4",
  ]);
  const checksPass = Object.values(conformance.checks).every(Boolean);
  const versions = EXTERNAL_EVIDENCE_ACTIVATION_PLANS.map((plan) => {
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
        : plan.requiresExternalEvidence
          ? [`Current independently issued activation evidence covers ${coveredMilestones.size}/14 domains.`]
          : ["A controlled external activation manifest and independently issued evidence are required."],
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
      versions: EXTERNAL_EVIDENCE_ACTIVATION_PLANS.length,
      sourcePassed: versions.length,
      localPassed,
      localHeld: versions.length - localPassed,
      manifests: store.manifests.length,
      observations: store.observations.length,
      quarantines: store.quarantines.length,
      reconciliations: reconciliations.length,
      eligibleReconciliations: eligibleReconciliations.length,
      decisionRequests: store.decisionRequests.length,
      decisionReceipts: store.decisionReceipts.length,
      coveredMilestones: coveredMilestones.size,
    },
    conformance,
    versions,
    disclosure: "All v5.4-v5.5 source contracts are implemented. An activation manifest, injected external observation, reconciliation projection, or syntactically accepted decision receipt is not evidence of a controlled identity, authority, immutable archive, independent observer, distribution approval, or production authorization.",
    stateDigest: evidenceAcceptanceDigest({
      core,
      activationStoreRevision: store.revision,
      relayStoreRevision: relayStore.revision,
      handoffStoreRevision: handoffStore.revision,
    }),
  };
}

export function buildExternalEvidenceActivationPromotionBundle() {
  const state = buildExternalEvidenceActivationTrainState();
  let verifiedManifestCount = 0;
  try {
    verifiedManifestCount = createActivationIntakeService().summary().manifests.filter((manifest) => manifest.eligibleForReview).length;
  } catch {
    // Unreadable trust or intake state cannot provide cryptographic eligibility.
  }
  const core = {
    schemaVersion: "experiments.evidence-external-activation-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: verifiedManifestCount > 0 && state.totals.quarantines === 0
      ? "eligible-for-independent-decision" as const
      : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    verifiedManifestCount,
    trainStateDigest: state.stateDigest,
    coveredMilestones: state.totals.coveredMilestones,
    remainingDomains: 14 - state.totals.coveredMilestones,
    activationBacklog: state.versions.filter((version) => version.externalStatus === "hold").map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: evidenceAcceptanceDigest(core) };
}

export function runExternalEvidenceActivationTrainAcceptance() {
  const state = buildExternalEvidenceActivationTrainState();
  const receiptCore = { id: `external-evidence-activation-train-${randomUUID()}`, ...state };
  const receipt = { ...receiptCore, evidenceDigest: externalEvidenceRelayDigest(receiptCore) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readExternalEvidenceActivationTrainEvidence() {
  const state = buildExternalEvidenceActivationTrainState();
  const receipts = readDurableReceipts<ReturnType<typeof runExternalEvidenceActivationTrainAcceptance>>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: "experiments.evidence-external-activation-train.v1" as const,
    ...state,
    promotionBundle: buildExternalEvidenceActivationPromotionBundle(),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      activations: externalEvidenceActivationStorePath(),
      relays: getLocalAgentDataPath("experiments", "v5.2.0-v5.3.4-external-evidence-relay.json"),
      handoffs: getLocalAgentDataPath("experiments", "v5.0.0-v5.1.4-external-evidence-handoffs.json"),
    },
  };
}
