import { randomUUID } from "node:crypto";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import type { ExternalEvidenceHandoff } from "@/features/evidence/external-handoff";
import {
  externalEvidenceRelayDigest,
  type ExternalEvidenceRelayConfiguration,
} from "@/features/evidence/external-relay";

export const EXTERNAL_EVIDENCE_ACTIVATION_SCHEMA_VERSION = "evidence.external-activation.v1" as const;

export type ExternalEvidenceActivationPlan = {
  version: string;
  label: string;
  track: "manifest" | "intake" | "reconciliation" | "decision";
  localGate: string;
  externalGate: string;
  requiresExternalEvidence: boolean;
};

export const EXTERNAL_EVIDENCE_ACTIVATION_PLANS: ExternalEvidenceActivationPlan[] = [
  { version: "v5.4.0", label: "Controlled Relay Activation Manifest", track: "manifest", localGate: "A bounded activation manifest pins one relay configuration, handoff, authority identity, trust fingerprint, policy digest, required stages, and expiry.", externalGate: "An organization-controlled authority must approve the active activation manifest.", requiresExternalEvidence: false },
  { version: "v5.4.1", label: "Workload Identity Attestation Intake", track: "intake", localGate: "Identity attestation imports bind to the active manifest and retain only signed evidence digests.", externalGate: "A workload identity issuer must provide a current independently verifiable attestation.", requiresExternalEvidence: true },
  { version: "v5.4.2", label: "Relay Authority Discovery Evidence", track: "intake", localGate: "Authority discovery observations bind the manifest, configured authority, signer fingerprint, and validity window.", externalGate: "The controlled relay authority must issue its current discovery evidence.", requiresExternalEvidence: true },
  { version: "v5.4.3", label: "Trust Anchor Continuity Verification", track: "intake", localGate: "Trust continuity is a separately signed activation stage and cannot silently replace the pinned fingerprint.", externalGate: "The authority must publish a current trust-anchor or rotation continuity record.", requiresExternalEvidence: true },
  { version: "v5.4.4", label: "Archive Policy Read-back Intake", track: "intake", localGate: "Archive policy read-back is imported as bounded digest-only evidence and is distinct from a local retention claim.", externalGate: "Immutable storage must issue its retention and legal-hold read-back evidence.", requiresExternalEvidence: true },
  { version: "v5.4.5", label: "Relay Request Admission Ledger", track: "intake", localGate: "An admission observation binds the exact manifest and proves only external request admission, not release authorization.", externalGate: "The authority relay must accept the controlled activation request.", requiresExternalEvidence: true },
  { version: "v5.4.6", label: "Idempotent Execution Receipt Binding", track: "intake", localGate: "Execution evidence is digest-bound to one admission lineage and rejects duplicate or mismatched imports.", externalGate: "The authority must return an execution witness for the accepted request.", requiresExternalEvidence: true },
  { version: "v5.4.7", label: "Independent Observer Attestation Intake", track: "intake", localGate: "Observer attestations require a source milestone and bind it to the active activation manifest.", externalGate: "Each independent observer must issue its current domain attestation.", requiresExternalEvidence: true },
  { version: "v5.4.8", label: "Verified Receipt Evidence Quarantine", track: "intake", localGate: "Malformed, stale, duplicate, policy-denied, signature-invalid, or mismatched evidence is retained only as bounded quarantine metadata.", externalGate: "An authority owner must investigate and resolve quarantined evidence with independent records.", requiresExternalEvidence: false },
  { version: "v5.4.9", label: "Fourteen-Domain Currentness Projection", track: "reconciliation", localGate: "Coverage requires current verified observer and receipt stages for every source milestone and no visible quarantine.", externalGate: "All fourteen independent domains must provide current externally issued evidence.", requiresExternalEvidence: true },
  { version: "v5.5.0", label: "External Discrepancy Case Import", track: "reconciliation", localGate: "A discrepancy is kept as an additive, digest-only quarantine case without overwriting accepted evidence lineage.", externalGate: "A qualified authority owner must provide a separately resolved discrepancy case.", requiresExternalEvidence: true },
  { version: "v5.5.1", label: "Renewal and Expiry Reconciliation", track: "reconciliation", localGate: "Expired activation material and replayed evidence cannot contribute to currentness or an independent decision request.", externalGate: "Issuers and observers must renew records inside their declared validity windows.", requiresExternalEvidence: true },
  { version: "v5.5.2", label: "Separate Distribution Decision Request", track: "decision", localGate: "A short-lived decision request binds an eligible reconciliation to a distinct decision authority identity and key fingerprint.", externalGate: "A separately controlled distribution authority must receive and evaluate the live request.", requiresExternalEvidence: true },
  { version: "v5.5.3", label: "Independent Decision Receipt Verification", track: "decision", localGate: "A decision receipt binds the exact request, distinct signer fingerprint, and validity window without authorizing production locally.", externalGate: "The distribution authority must issue an authentic independent decision receipt.", requiresExternalEvidence: true },
  { version: "v5.5.4", label: "Production Admission Firewall", track: "decision", localGate: "All activation projections remain non-authorizing for distribution and production, even after a syntactically accepted decision receipt.", externalGate: "Production needs a separately controlled transition, execution witness, and authorization outside this application.", requiresExternalEvidence: false },
];

export const EXTERNAL_EVIDENCE_ACTIVATION_STAGES = [
  "workload-identity-attestation",
  "authority-discovery",
  "trust-anchor-continuity",
  "archive-policy-readback",
  "relay-admission",
  "execution-receipt-binding",
  "observer-attestation",
  "receipt-verification",
] as const;

export type ExternalEvidenceActivationStage = typeof EXTERNAL_EVIDENCE_ACTIVATION_STAGES[number];

export type ExternalEvidenceActivationManifest = {
  schemaVersion: "evidence.external-activation-manifest.v1";
  id: string;
  relayConfigurationId: string;
  relayConfigurationDigest: string;
  handoffId: string;
  handoffDigest: string;
  authorityId: string;
  authorityKeyFingerprint: string;
  activationPolicyDigest: string;
  requiredStages: ExternalEvidenceActivationStage[];
  requestedAt: string;
  expiresAt: string;
  manifestDigest: string;
};

export type ExternalEvidenceActivationObservation = {
  schemaVersion: "evidence.external-activation-observation.v1";
  id: string;
  manifestId: string;
  manifestDigest: string;
  stage: ExternalEvidenceActivationStage;
  sourceMilestone: string | null;
  externalEvidenceDigest: string;
  signerKeyFingerprint: string;
  signatureDigest: string;
  status: "verified" | "rejected";
  receivedAt: string;
  validUntil: string;
  observationDigest: string;
};

export type ExternalEvidenceActivationQuarantine = {
  schemaVersion: "evidence.external-activation-quarantine.v1";
  id: string;
  manifestId: string;
  manifestDigest: string;
  observationId: string | null;
  observationDigest: string | null;
  code: "schema-invalid" | "binding-mismatch" | "stale" | "duplicate" | "policy-denied" | "signature-invalid";
  payloadDigest: string;
  detailDigest: string;
  observedAt: string;
  quarantineDigest: string;
};

export type ExternalEvidenceActivationReconciliation = {
  schemaVersion: "evidence.external-activation-reconciliation.v1";
  manifestId: string;
  manifestDigest: string;
  expectedMilestones: string[];
  coveredMilestones: string[];
  verifiedGlobalStages: ExternalEvidenceActivationStage[];
  staleObservationCount: number;
  quarantinedImportCount: number;
  observedAt: string;
  status: "hold" | "eligible-for-independent-decision";
  reconciliationDigest: string;
};

export type ExternalEvidenceActivationDecisionRequest = {
  schemaVersion: "evidence.external-activation-decision-request.v1";
  id: string;
  idempotencyKey: string;
  manifestId: string;
  manifestDigest: string;
  reconciliationDigest: string;
  decisionAuthorityId: string;
  decisionAuthorityKeyFingerprint: string;
  requestedAt: string;
  expiresAt: string;
  requestDigest: string;
};

export type ExternalEvidenceActivationDecisionReceipt = {
  schemaVersion: "evidence.external-activation-decision-receipt.v1";
  id: string;
  requestId: string;
  requestDigest: string;
  manifestId: string;
  manifestDigest: string;
  externalDecisionDigest: string;
  signerKeyFingerprint: string;
  signatureDigest: string;
  status: "accepted" | "rejected";
  receivedAt: string;
  validUntil: string;
  receiptDigest: string;
};

export type ExternalEvidenceActivationStore = {
  schemaVersion: "evidence.external-activation-store.v1";
  revision: number;
  manifests: ExternalEvidenceActivationManifest[];
  observations: ExternalEvidenceActivationObservation[];
  quarantines: ExternalEvidenceActivationQuarantine[];
  decisionRequests: ExternalEvidenceActivationDecisionRequest[];
  decisionReceipts: ExternalEvidenceActivationDecisionReceipt[];
  idempotency: Record<string, string>;
};

export type ExternalEvidenceActivationPort = {
  importObservation(input: {
    manifest: ExternalEvidenceActivationManifest;
    stage: ExternalEvidenceActivationStage;
    sourceMilestone: string | null;
  }): Promise<ExternalEvidenceActivationObservation>;
};

export class ExternalEvidenceActivationError extends Error {
  constructor(
    readonly code: "invalid-input" | "revision-conflict" | "capacity-exceeded" | "external-unavailable" | "external-binding-failed",
    message: string,
  ) {
    super(message);
    this.name = "ExternalEvidenceActivationError";
  }
}

const DAY = 24 * 60 * 60 * 1_000;
const HEX = /^[a-f0-9]{64}$/u;
const IDENTITY = /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu;
const MAX_MANIFESTS = 100;
const MAX_OBSERVATIONS = 8_000;
const MAX_QUARANTINES = 2_000;
const MAX_DECISION_REQUESTS = 1_000;
const MAX_DECISION_RECEIPTS = 1_000;
const GLOBAL_STAGES = EXTERNAL_EVIDENCE_ACTIVATION_STAGES.filter((stage) => stage !== "observer-attestation" && stage !== "receipt-verification");

function isDigest(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string" && IDENTITY.test(value.trim()) &&
    !/^(?:demo|fixture|local|test|unknown)(?:[-_.:]|$)/iu.test(value.trim());
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasOnlyKeys(value: unknown, keys: readonly string[]) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).every((key) => keys.includes(key));
}

function isShortWindow(start: string, end: string, maximumMs: number) {
  const started = Date.parse(start);
  const ended = Date.parse(end);
  return Number.isFinite(started) && Number.isFinite(ended) && ended > started && ended - started <= maximumMs;
}

function hasExactMilestones(values: string[]) {
  return values.length === EVIDENCE_COLLECTION_SOURCE_MILESTONES.length &&
    values.every((value, index) => value === EVIDENCE_COLLECTION_SOURCE_MILESTONES[index]);
}

function hasExactStages(values: readonly string[]) {
  return values.length === EXTERNAL_EVIDENCE_ACTIVATION_STAGES.length &&
    values.every((value, index) => value === EXTERNAL_EVIDENCE_ACTIVATION_STAGES[index]);
}

function requiresMilestone(stage: ExternalEvidenceActivationStage) {
  return stage === "observer-attestation" || stage === "receipt-verification";
}

function manifestCore(input: Omit<ExternalEvidenceActivationManifest, "schemaVersion" | "id" | "manifestDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-activation-manifest.v1" as const,
    id: input.id?.trim() || `external-activation-${randomUUID()}`,
    relayConfigurationId: input.relayConfigurationId.trim(),
    relayConfigurationDigest: input.relayConfigurationDigest,
    handoffId: input.handoffId.trim(),
    handoffDigest: input.handoffDigest,
    authorityId: input.authorityId.trim(),
    authorityKeyFingerprint: input.authorityKeyFingerprint,
    activationPolicyDigest: input.activationPolicyDigest,
    requiredStages: [...input.requiredStages],
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createExternalEvidenceActivationManifest(input: Omit<ExternalEvidenceActivationManifest, "schemaVersion" | "id" | "manifestDigest"> & { id?: string }) {
  const core = manifestCore(input);
  return { ...core, manifestDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceActivationManifest(
  input: unknown,
  configuration?: Pick<ExternalEvidenceRelayConfiguration, "id" | "configurationDigest" | "authorityId" | "trustAnchorFingerprint">,
  handoff?: Pick<ExternalEvidenceHandoff, "id" | "handoffDigest">,
) {
  const manifest = input as Partial<ExternalEvidenceActivationManifest>;
  const core = manifest.schemaVersion === "evidence.external-activation-manifest.v1" && typeof manifest.id === "string" && typeof manifest.relayConfigurationId === "string" && typeof manifest.handoffId === "string" && typeof manifest.authorityId === "string" && Array.isArray(manifest.requiredStages)
    ? manifestCore({
      id: manifest.id,
      relayConfigurationId: manifest.relayConfigurationId,
      relayConfigurationDigest: manifest.relayConfigurationDigest || "",
      handoffId: manifest.handoffId,
      handoffDigest: manifest.handoffDigest || "",
      authorityId: manifest.authorityId,
      authorityKeyFingerprint: manifest.authorityKeyFingerprint || "",
      activationPolicyDigest: manifest.activationPolicyDigest || "",
      requiredStages: manifest.requiredStages as ExternalEvidenceActivationStage[],
      requestedAt: manifest.requestedAt || "",
      expiresAt: manifest.expiresAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "relayConfigurationId", "relayConfigurationDigest", "handoffId", "handoffDigest", "authorityId", "authorityKeyFingerprint", "activationPolicyDigest", "requiredStages", "requestedAt", "expiresAt", "manifestDigest"]),
    schemaVersion: manifest.schemaVersion === "evidence.external-activation-manifest.v1",
    identity: isIdentity(manifest.id) && isIdentity(manifest.relayConfigurationId) && isIdentity(manifest.handoffId) && isIdentity(manifest.authorityId),
    digests: isDigest(manifest.relayConfigurationDigest) && isDigest(manifest.handoffDigest) && isDigest(manifest.authorityKeyFingerprint) && isDigest(manifest.activationPolicyDigest),
    stages: Array.isArray(manifest.requiredStages) && manifest.requiredStages.every((stage) => typeof stage === "string") && hasExactStages(manifest.requiredStages as string[]),
    window: isTimestamp(manifest.requestedAt) && isTimestamp(manifest.expiresAt) && isShortWindow(manifest.requestedAt, manifest.expiresAt, 14 * DAY),
    configurationBinding: !configuration || (manifest.relayConfigurationId === configuration.id && manifest.relayConfigurationDigest === configuration.configurationDigest && manifest.authorityId === configuration.authorityId && manifest.authorityKeyFingerprint === configuration.trustAnchorFingerprint),
    handoffBinding: !handoff || (manifest.handoffId === handoff.id && manifest.handoffDigest === handoff.handoffDigest),
    digest: Boolean(core) && manifest.manifestDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function observationCore(input: Omit<ExternalEvidenceActivationObservation, "schemaVersion" | "id" | "observationDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-activation-observation.v1" as const,
    id: input.id?.trim() || `external-activation-observation-${randomUUID()}`,
    manifestId: input.manifestId.trim(),
    manifestDigest: input.manifestDigest,
    stage: input.stage,
    sourceMilestone: input.sourceMilestone,
    externalEvidenceDigest: input.externalEvidenceDigest,
    signerKeyFingerprint: input.signerKeyFingerprint,
    signatureDigest: input.signatureDigest,
    status: input.status,
    receivedAt: input.receivedAt,
    validUntil: input.validUntil,
  };
}

export function createExternalEvidenceActivationObservation(input: Omit<ExternalEvidenceActivationObservation, "schemaVersion" | "id" | "observationDigest"> & { id?: string }) {
  const core = observationCore(input);
  return { ...core, observationDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceActivationObservation(input: unknown, manifest?: ExternalEvidenceActivationManifest) {
  const observation = input as Partial<ExternalEvidenceActivationObservation>;
  const core = observation.schemaVersion === "evidence.external-activation-observation.v1" && typeof observation.id === "string" && typeof observation.manifestId === "string"
    ? observationCore({
      id: observation.id,
      manifestId: observation.manifestId,
      manifestDigest: observation.manifestDigest || "",
      stage: observation.stage as ExternalEvidenceActivationStage,
      sourceMilestone: observation.sourceMilestone === null ? null : observation.sourceMilestone || null,
      externalEvidenceDigest: observation.externalEvidenceDigest || "",
      signerKeyFingerprint: observation.signerKeyFingerprint || "",
      signatureDigest: observation.signatureDigest || "",
      status: observation.status as ExternalEvidenceActivationObservation["status"],
      receivedAt: observation.receivedAt || "",
      validUntil: observation.validUntil || "",
    })
    : null;
  const stage = observation.stage as ExternalEvidenceActivationStage;
  const milestone = requiresMilestone(stage)
    ? typeof observation.sourceMilestone === "string" && EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(observation.sourceMilestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number])
    : observation.sourceMilestone === null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "manifestId", "manifestDigest", "stage", "sourceMilestone", "externalEvidenceDigest", "signerKeyFingerprint", "signatureDigest", "status", "receivedAt", "validUntil", "observationDigest"]),
    schemaVersion: observation.schemaVersion === "evidence.external-activation-observation.v1",
    identity: isIdentity(observation.id) && isIdentity(observation.manifestId),
    manifestBinding: !manifest || (observation.manifestId === manifest.id && observation.manifestDigest === manifest.manifestDigest),
    stage: EXTERNAL_EVIDENCE_ACTIVATION_STAGES.includes(stage),
    milestone,
    digests: isDigest(observation.manifestDigest) && isDigest(observation.externalEvidenceDigest) && isDigest(observation.signerKeyFingerprint) && isDigest(observation.signatureDigest),
    signerBinding: !manifest || observation.signerKeyFingerprint === manifest.authorityKeyFingerprint,
    status: observation.status === "verified" || observation.status === "rejected",
    window: isTimestamp(observation.receivedAt) && isTimestamp(observation.validUntil) && isShortWindow(observation.receivedAt, observation.validUntil, 31 * DAY),
    digest: Boolean(core) && observation.observationDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function quarantineCore(input: Omit<ExternalEvidenceActivationQuarantine, "schemaVersion" | "id" | "quarantineDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-activation-quarantine.v1" as const,
    id: input.id?.trim() || `external-activation-quarantine-${randomUUID()}`,
    manifestId: input.manifestId.trim(),
    manifestDigest: input.manifestDigest,
    observationId: input.observationId,
    observationDigest: input.observationDigest,
    code: input.code,
    payloadDigest: input.payloadDigest,
    detailDigest: input.detailDigest,
    observedAt: input.observedAt,
  };
}

export function createExternalEvidenceActivationQuarantine(input: Omit<ExternalEvidenceActivationQuarantine, "schemaVersion" | "id" | "quarantineDigest"> & { id?: string }) {
  const core = quarantineCore(input);
  return { ...core, quarantineDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceActivationQuarantine(
  input: unknown,
  manifest?: ExternalEvidenceActivationManifest,
  observation?: ExternalEvidenceActivationObservation,
) {
  const quarantine = input as Partial<ExternalEvidenceActivationQuarantine>;
  const core = quarantine.schemaVersion === "evidence.external-activation-quarantine.v1" && typeof quarantine.id === "string" && typeof quarantine.manifestId === "string"
    ? quarantineCore({
      id: quarantine.id,
      manifestId: quarantine.manifestId,
      manifestDigest: quarantine.manifestDigest || "",
      observationId: quarantine.observationId === null ? null : quarantine.observationId || null,
      observationDigest: quarantine.observationDigest === null ? null : quarantine.observationDigest || null,
      code: quarantine.code as ExternalEvidenceActivationQuarantine["code"],
      payloadDigest: quarantine.payloadDigest || "",
      detailDigest: quarantine.detailDigest || "",
      observedAt: quarantine.observedAt || "",
    })
    : null;
  const observationShape = quarantine.observationId === null && quarantine.observationDigest === null ||
    typeof quarantine.observationId === "string" && isIdentity(quarantine.observationId) && isDigest(quarantine.observationDigest);
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "manifestId", "manifestDigest", "observationId", "observationDigest", "code", "payloadDigest", "detailDigest", "observedAt", "quarantineDigest"]),
    schemaVersion: quarantine.schemaVersion === "evidence.external-activation-quarantine.v1",
    identity: isIdentity(quarantine.id) && isIdentity(quarantine.manifestId),
    manifestBinding: !manifest || (quarantine.manifestId === manifest.id && quarantine.manifestDigest === manifest.manifestDigest),
    observationBinding: !observation ? quarantine.observationId === null && quarantine.observationDigest === null : quarantine.observationId === observation.id && quarantine.observationDigest === observation.observationDigest,
    observationShape,
    code: ["schema-invalid", "binding-mismatch", "stale", "duplicate", "policy-denied", "signature-invalid"].includes(quarantine.code || ""),
    digests: isDigest(quarantine.manifestDigest) && isDigest(quarantine.payloadDigest) && isDigest(quarantine.detailDigest),
    observedAt: isTimestamp(quarantine.observedAt),
    digest: Boolean(core) && quarantine.quarantineDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function buildExternalEvidenceActivationReconciliation(input: {
  manifest: ExternalEvidenceActivationManifest;
  handoff: Pick<ExternalEvidenceHandoff, "sourceMilestones">;
  observations: ExternalEvidenceActivationObservation[];
  quarantines: ExternalEvidenceActivationQuarantine[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const matching = input.observations.filter((observation) => observation.manifestId === input.manifest.id && observation.manifestDigest === input.manifest.manifestDigest);
  const current = matching.filter((observation) => observation.status === "verified" && Date.parse(observation.validUntil) >= now);
  const verifiedGlobalStages = GLOBAL_STAGES.filter((stage) => current.some((observation) => observation.stage === stage));
  const coveredMilestones = input.handoff.sourceMilestones.filter((sourceMilestone) =>
    ["observer-attestation", "receipt-verification"].every((stage) => current.some((observation) => observation.stage === stage && observation.sourceMilestone === sourceMilestone)),
  );
  const staleObservationCount = matching.filter((observation) => Date.parse(observation.validUntil) < now).length;
  const quarantinedImportCount = input.quarantines.filter((quarantine) => quarantine.manifestId === input.manifest.id && quarantine.manifestDigest === input.manifest.manifestDigest).length;
  const status = hasExactMilestones(coveredMilestones) && verifiedGlobalStages.length === GLOBAL_STAGES.length && staleObservationCount === 0 && quarantinedImportCount === 0
    ? "eligible-for-independent-decision" as const
    : "hold" as const;
  const core = {
    schemaVersion: "evidence.external-activation-reconciliation.v1" as const,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.manifestDigest,
    expectedMilestones: [...input.handoff.sourceMilestones],
    coveredMilestones,
    verifiedGlobalStages,
    staleObservationCount,
    quarantinedImportCount,
    observedAt: new Date(now).toISOString(),
    status,
  };
  return { ...core, reconciliationDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceActivationReconciliation(
  input: unknown,
  manifest: ExternalEvidenceActivationManifest,
  handoff: Pick<ExternalEvidenceHandoff, "sourceMilestones">,
) {
  const reconciliation = input as Partial<ExternalEvidenceActivationReconciliation>;
  const core = reconciliation.schemaVersion === "evidence.external-activation-reconciliation.v1" && typeof reconciliation.manifestId === "string" && Array.isArray(reconciliation.expectedMilestones) && Array.isArray(reconciliation.coveredMilestones) && Array.isArray(reconciliation.verifiedGlobalStages)
    ? {
      schemaVersion: "evidence.external-activation-reconciliation.v1" as const,
      manifestId: reconciliation.manifestId,
      manifestDigest: reconciliation.manifestDigest || "",
      expectedMilestones: reconciliation.expectedMilestones,
      coveredMilestones: reconciliation.coveredMilestones,
      verifiedGlobalStages: reconciliation.verifiedGlobalStages,
      staleObservationCount: Number(reconciliation.staleObservationCount),
      quarantinedImportCount: Number(reconciliation.quarantinedImportCount),
      observedAt: reconciliation.observedAt || "",
      status: reconciliation.status as ExternalEvidenceActivationReconciliation["status"],
    }
    : null;
  const expected = Array.isArray(reconciliation.expectedMilestones) && reconciliation.expectedMilestones.every((value) => typeof value === "string") ? reconciliation.expectedMilestones as string[] : [];
  const covered = Array.isArray(reconciliation.coveredMilestones) && reconciliation.coveredMilestones.every((value) => typeof value === "string") ? reconciliation.coveredMilestones as string[] : [];
  const stages = Array.isArray(reconciliation.verifiedGlobalStages) && reconciliation.verifiedGlobalStages.every((value) => typeof value === "string") ? reconciliation.verifiedGlobalStages as string[] : [];
  const ready = hasExactMilestones(covered) && stages.length === GLOBAL_STAGES.length && GLOBAL_STAGES.every((stage) => stages.includes(stage)) && Number(reconciliation.staleObservationCount) === 0 && Number(reconciliation.quarantinedImportCount) === 0;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "manifestId", "manifestDigest", "expectedMilestones", "coveredMilestones", "verifiedGlobalStages", "staleObservationCount", "quarantinedImportCount", "observedAt", "status", "reconciliationDigest"]),
    schemaVersion: reconciliation.schemaVersion === "evidence.external-activation-reconciliation.v1",
    manifestBinding: reconciliation.manifestId === manifest.id && reconciliation.manifestDigest === manifest.manifestDigest,
    expectedMilestones: hasExactMilestones(expected) && expected.every((value, index) => value === handoff.sourceMilestones[index]),
    coveredMilestones: new Set(covered).size === covered.length && covered.every((value) => handoff.sourceMilestones.includes(value)),
    globalStages: new Set(stages).size === stages.length && stages.every((stage) => GLOBAL_STAGES.some((globalStage) => globalStage === stage)),
    counts: Number.isInteger(reconciliation.staleObservationCount) && Number(reconciliation.staleObservationCount) >= 0 && Number.isInteger(reconciliation.quarantinedImportCount) && Number(reconciliation.quarantinedImportCount) >= 0,
    observedAt: isTimestamp(reconciliation.observedAt),
    status: reconciliation.status === "hold" || reconciliation.status === "eligible-for-independent-decision",
    semanticStatus: reconciliation.status === (ready ? "eligible-for-independent-decision" : "hold"),
    digest: Boolean(core) && reconciliation.reconciliationDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function decisionRequestCore(input: Omit<ExternalEvidenceActivationDecisionRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-activation-decision-request.v1" as const,
    id: input.id?.trim() || `external-activation-decision-request-${randomUUID()}`,
    idempotencyKey: input.idempotencyKey.trim(),
    manifestId: input.manifestId.trim(),
    manifestDigest: input.manifestDigest,
    reconciliationDigest: input.reconciliationDigest,
    decisionAuthorityId: input.decisionAuthorityId.trim(),
    decisionAuthorityKeyFingerprint: input.decisionAuthorityKeyFingerprint,
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

export function createExternalEvidenceActivationDecisionRequest(input: Omit<ExternalEvidenceActivationDecisionRequest, "schemaVersion" | "id" | "requestDigest"> & { id?: string }) {
  const core = decisionRequestCore(input);
  return { ...core, requestDigest: externalEvidenceRelayDigest(core) };
}

function validateExternalEvidenceActivationDecisionRequestShape(input: unknown) {
  const request = input as Partial<ExternalEvidenceActivationDecisionRequest>;
  const core = request.schemaVersion === "evidence.external-activation-decision-request.v1" && typeof request.id === "string" && typeof request.idempotencyKey === "string" && typeof request.manifestId === "string" && typeof request.decisionAuthorityId === "string"
    ? decisionRequestCore({
      id: request.id,
      idempotencyKey: request.idempotencyKey,
      manifestId: request.manifestId,
      manifestDigest: request.manifestDigest || "",
      reconciliationDigest: request.reconciliationDigest || "",
      decisionAuthorityId: request.decisionAuthorityId,
      decisionAuthorityKeyFingerprint: request.decisionAuthorityKeyFingerprint || "",
      requestedAt: request.requestedAt || "",
      expiresAt: request.expiresAt || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "idempotencyKey", "manifestId", "manifestDigest", "reconciliationDigest", "decisionAuthorityId", "decisionAuthorityKeyFingerprint", "requestedAt", "expiresAt", "requestDigest"]),
    schemaVersion: request.schemaVersion === "evidence.external-activation-decision-request.v1",
    identity: isIdentity(request.id) && isIdentity(request.idempotencyKey) && isIdentity(request.manifestId) && isIdentity(request.decisionAuthorityId),
    digests: isDigest(request.manifestDigest) && isDigest(request.reconciliationDigest) && isDigest(request.decisionAuthorityKeyFingerprint),
    window: isTimestamp(request.requestedAt) && isTimestamp(request.expiresAt) && isShortWindow(request.requestedAt, request.expiresAt, 72 * 60 * 60 * 1_000),
    digest: Boolean(core) && request.requestDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validateExternalEvidenceActivationDecisionRequest(
  input: unknown,
  manifest: ExternalEvidenceActivationManifest,
  reconciliation: ExternalEvidenceActivationReconciliation,
) {
  const basic = validateExternalEvidenceActivationDecisionRequestShape(input);
  const request = input as Partial<ExternalEvidenceActivationDecisionRequest>;
  const checks = {
    ...basic.checks,
    manifestBinding: request.manifestId === manifest.id && request.manifestDigest === manifest.manifestDigest,
    reconciliationBinding: request.reconciliationDigest === reconciliation.reconciliationDigest && reconciliation.status === "eligible-for-independent-decision",
    separateAuthority: request.decisionAuthorityId !== manifest.authorityId && request.decisionAuthorityKeyFingerprint !== manifest.authorityKeyFingerprint,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function decisionReceiptCore(input: Omit<ExternalEvidenceActivationDecisionReceipt, "schemaVersion" | "id" | "receiptDigest"> & { id?: string }) {
  return {
    schemaVersion: "evidence.external-activation-decision-receipt.v1" as const,
    id: input.id?.trim() || `external-activation-decision-receipt-${randomUUID()}`,
    requestId: input.requestId.trim(),
    requestDigest: input.requestDigest,
    manifestId: input.manifestId.trim(),
    manifestDigest: input.manifestDigest,
    externalDecisionDigest: input.externalDecisionDigest,
    signerKeyFingerprint: input.signerKeyFingerprint,
    signatureDigest: input.signatureDigest,
    status: input.status,
    receivedAt: input.receivedAt,
    validUntil: input.validUntil,
  };
}

export function createExternalEvidenceActivationDecisionReceipt(input: Omit<ExternalEvidenceActivationDecisionReceipt, "schemaVersion" | "id" | "receiptDigest"> & { id?: string }) {
  const core = decisionReceiptCore(input);
  return { ...core, receiptDigest: externalEvidenceRelayDigest(core) };
}

export function validateExternalEvidenceActivationDecisionReceipt(
  input: unknown,
  request: ExternalEvidenceActivationDecisionRequest,
) {
  const receipt = input as Partial<ExternalEvidenceActivationDecisionReceipt>;
  const core = receipt.schemaVersion === "evidence.external-activation-decision-receipt.v1" && typeof receipt.id === "string" && typeof receipt.requestId === "string" && typeof receipt.manifestId === "string"
    ? decisionReceiptCore({
      id: receipt.id,
      requestId: receipt.requestId,
      requestDigest: receipt.requestDigest || "",
      manifestId: receipt.manifestId,
      manifestDigest: receipt.manifestDigest || "",
      externalDecisionDigest: receipt.externalDecisionDigest || "",
      signerKeyFingerprint: receipt.signerKeyFingerprint || "",
      signatureDigest: receipt.signatureDigest || "",
      status: receipt.status as ExternalEvidenceActivationDecisionReceipt["status"],
      receivedAt: receipt.receivedAt || "",
      validUntil: receipt.validUntil || "",
    })
    : null;
  const checks = {
    strictSchema: hasOnlyKeys(input, ["schemaVersion", "id", "requestId", "requestDigest", "manifestId", "manifestDigest", "externalDecisionDigest", "signerKeyFingerprint", "signatureDigest", "status", "receivedAt", "validUntil", "receiptDigest"]),
    schemaVersion: receipt.schemaVersion === "evidence.external-activation-decision-receipt.v1",
    identity: isIdentity(receipt.id) && isIdentity(receipt.requestId) && isIdentity(receipt.manifestId),
    requestBinding: receipt.requestId === request.id && receipt.requestDigest === request.requestDigest && receipt.manifestId === request.manifestId && receipt.manifestDigest === request.manifestDigest,
    signerBinding: receipt.signerKeyFingerprint === request.decisionAuthorityKeyFingerprint && isDigest(receipt.signatureDigest),
    digests: isDigest(receipt.externalDecisionDigest) && isDigest(receipt.manifestDigest) && isDigest(receipt.requestDigest),
    status: receipt.status === "accepted" || receipt.status === "rejected",
    window: isTimestamp(receipt.receivedAt) && isTimestamp(receipt.validUntil) && isShortWindow(receipt.receivedAt, receipt.validUntil, 31 * DAY),
    digest: Boolean(core) && receipt.receiptDigest === externalEvidenceRelayDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function emptyExternalEvidenceActivationStore(): ExternalEvidenceActivationStore {
  return {
    schemaVersion: "evidence.external-activation-store.v1",
    revision: 0,
    manifests: [],
    observations: [],
    quarantines: [],
    decisionRequests: [],
    decisionReceipts: [],
    idempotency: {},
  };
}

export function validateExternalEvidenceActivationStore(input: unknown): input is ExternalEvidenceActivationStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const store = input as Partial<ExternalEvidenceActivationStore>;
  if (!hasOnlyKeys(input, ["schemaVersion", "revision", "manifests", "observations", "quarantines", "decisionRequests", "decisionReceipts", "idempotency"]) || store.schemaVersion !== "evidence.external-activation-store.v1" || !Number.isInteger(store.revision) || Number(store.revision) < 0 || !Array.isArray(store.manifests) || !Array.isArray(store.observations) || !Array.isArray(store.quarantines) || !Array.isArray(store.decisionRequests) || !Array.isArray(store.decisionReceipts) || !store.idempotency || typeof store.idempotency !== "object" || Array.isArray(store.idempotency)) return false;
  const manifests = store.manifests as ExternalEvidenceActivationManifest[];
  const observations = store.observations as ExternalEvidenceActivationObservation[];
  const quarantines = store.quarantines as ExternalEvidenceActivationQuarantine[];
  const requests = store.decisionRequests as ExternalEvidenceActivationDecisionRequest[];
  const receipts = store.decisionReceipts as ExternalEvidenceActivationDecisionReceipt[];
  if (manifests.length > MAX_MANIFESTS || observations.length > MAX_OBSERVATIONS || quarantines.length > MAX_QUARANTINES || requests.length > MAX_DECISION_REQUESTS || receipts.length > MAX_DECISION_RECEIPTS) return false;
  if (new Set(manifests.map((manifest) => manifest.id)).size !== manifests.length || !manifests.every((manifest) => validateExternalEvidenceActivationManifest(manifest).ok)) return false;
  if (new Set(observations.map((observation) => observation.id)).size !== observations.length || !observations.every((observation) => {
    const manifest = manifests.find((entry) => entry.id === observation.manifestId && entry.manifestDigest === observation.manifestDigest);
    return Boolean(manifest && validateExternalEvidenceActivationObservation(observation, manifest).ok);
  })) return false;
  if (new Set(quarantines.map((quarantine) => quarantine.id)).size !== quarantines.length || !quarantines.every((quarantine) => {
    const manifest = manifests.find((entry) => entry.id === quarantine.manifestId && entry.manifestDigest === quarantine.manifestDigest);
    const observation = quarantine.observationId ? observations.find((entry) => entry.id === quarantine.observationId && entry.observationDigest === quarantine.observationDigest) : undefined;
    return Boolean(manifest && validateExternalEvidenceActivationQuarantine(quarantine, manifest, observation).ok);
  })) return false;
  if (new Set(requests.map((request) => request.id)).size !== requests.length || new Set(requests.map((request) => request.idempotencyKey)).size !== requests.length || !requests.every((request) => {
    const manifest = manifests.find((entry) => entry.id === request.manifestId && entry.manifestDigest === request.manifestDigest);
    return Boolean(manifest && validateExternalEvidenceActivationDecisionRequestShape(request).ok && request.decisionAuthorityId !== manifest.authorityId && request.decisionAuthorityKeyFingerprint !== manifest.authorityKeyFingerprint);
  })) return false;
  if (new Set(receipts.map((receipt) => receipt.id)).size !== receipts.length || !receipts.every((receipt) => {
    const request = requests.find((entry) => entry.id === receipt.requestId && entry.requestDigest === receipt.requestDigest);
    return Boolean(request && validateExternalEvidenceActivationDecisionReceipt(receipt, request).ok);
  })) return false;
  return Object.entries(store.idempotency).every(([key, id]) => {
    const request = requests.find((entry) => entry.id === id);
    return Boolean(request && request.idempotencyKey === key);
  }) && Object.keys(store.idempotency).length === requests.length;
}

export function insertExternalEvidenceActivationManifest(store: ExternalEvidenceActivationStore, manifest: ExternalEvidenceActivationManifest) {
  if (!validateExternalEvidenceActivationManifest(manifest).ok) throw new ExternalEvidenceActivationError("invalid-input", "External activation manifest failed strict validation.");
  const existing = store.manifests.find((entry) => entry.id === manifest.id);
  if (existing) {
    if (existing.manifestDigest !== manifest.manifestDigest) throw new ExternalEvidenceActivationError("revision-conflict", "Activation manifest id is already bound to another digest.");
    return { store, manifest: existing, deduplicated: true };
  }
  if (store.manifests.length >= MAX_MANIFESTS) throw new ExternalEvidenceActivationError("capacity-exceeded", "Activation manifest capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, manifests: [manifest, ...store.manifests] }, manifest, deduplicated: false };
}

export function appendExternalEvidenceActivationObservation(store: ExternalEvidenceActivationStore, observation: ExternalEvidenceActivationObservation) {
  const manifest = store.manifests.find((entry) => entry.id === observation.manifestId && entry.manifestDigest === observation.manifestDigest);
  if (!manifest || !validateExternalEvidenceActivationObservation(observation, manifest).ok) throw new ExternalEvidenceActivationError("invalid-input", "Activation observation failed strict validation.");
  const existing = store.observations.find((entry) => entry.id === observation.id);
  if (existing) {
    if (existing.observationDigest !== observation.observationDigest) throw new ExternalEvidenceActivationError("revision-conflict", "Activation observation id is already bound to another digest.");
    return { store, observation: existing, deduplicated: true };
  }
  if (store.observations.length >= MAX_OBSERVATIONS) throw new ExternalEvidenceActivationError("capacity-exceeded", "Activation observation capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, observations: [observation, ...store.observations] }, observation, deduplicated: false };
}

export function appendExternalEvidenceActivationQuarantine(store: ExternalEvidenceActivationStore, quarantine: ExternalEvidenceActivationQuarantine) {
  const manifest = store.manifests.find((entry) => entry.id === quarantine.manifestId && entry.manifestDigest === quarantine.manifestDigest);
  const observation = quarantine.observationId ? store.observations.find((entry) => entry.id === quarantine.observationId && entry.observationDigest === quarantine.observationDigest) : undefined;
  if (!manifest || !validateExternalEvidenceActivationQuarantine(quarantine, manifest, observation).ok) throw new ExternalEvidenceActivationError("invalid-input", "Activation quarantine record failed strict validation.");
  const existing = store.quarantines.find((entry) => entry.id === quarantine.id);
  if (existing) {
    if (existing.quarantineDigest !== quarantine.quarantineDigest) throw new ExternalEvidenceActivationError("revision-conflict", "Activation quarantine id is already bound to another digest.");
    return { store, quarantine: existing, deduplicated: true };
  }
  if (store.quarantines.length >= MAX_QUARANTINES) throw new ExternalEvidenceActivationError("capacity-exceeded", "Activation quarantine capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, quarantines: [quarantine, ...store.quarantines] }, quarantine, deduplicated: false };
}

export function insertExternalEvidenceActivationDecisionRequest(store: ExternalEvidenceActivationStore, request: ExternalEvidenceActivationDecisionRequest) {
  const manifest = store.manifests.find((entry) => entry.id === request.manifestId && entry.manifestDigest === request.manifestDigest);
  if (!manifest || !validateExternalEvidenceActivationDecisionRequestShape(request).ok || request.decisionAuthorityId === manifest.authorityId || request.decisionAuthorityKeyFingerprint === manifest.authorityKeyFingerprint) throw new ExternalEvidenceActivationError("invalid-input", "Activation decision request failed strict validation.");
  const existingId = store.idempotency[request.idempotencyKey];
  const existing = existingId ? store.decisionRequests.find((entry) => entry.id === existingId) : undefined;
  if (existing) {
    if (existing.requestDigest !== request.requestDigest) throw new ExternalEvidenceActivationError("revision-conflict", "Activation decision request idempotency key is already bound to another digest.");
    return { store, request: existing, deduplicated: true };
  }
  if (store.decisionRequests.length >= MAX_DECISION_REQUESTS) throw new ExternalEvidenceActivationError("capacity-exceeded", "Activation decision request capacity reached without eviction.");
  return {
    store: { ...store, revision: store.revision + 1, decisionRequests: [request, ...store.decisionRequests], idempotency: { ...store.idempotency, [request.idempotencyKey]: request.id } },
    request,
    deduplicated: false,
  };
}

export function appendExternalEvidenceActivationDecisionReceipt(store: ExternalEvidenceActivationStore, receipt: ExternalEvidenceActivationDecisionReceipt) {
  const request = store.decisionRequests.find((entry) => entry.id === receipt.requestId && entry.requestDigest === receipt.requestDigest);
  if (!request || !validateExternalEvidenceActivationDecisionReceipt(receipt, request).ok) throw new ExternalEvidenceActivationError("invalid-input", "Activation decision receipt failed strict validation.");
  const existing = store.decisionReceipts.find((entry) => entry.id === receipt.id);
  if (existing) {
    if (existing.receiptDigest !== receipt.receiptDigest) throw new ExternalEvidenceActivationError("revision-conflict", "Activation decision receipt id is already bound to another digest.");
    return { store, receipt: existing, deduplicated: true };
  }
  if (store.decisionReceipts.length >= MAX_DECISION_RECEIPTS) throw new ExternalEvidenceActivationError("capacity-exceeded", "Activation decision receipt capacity reached without eviction.");
  return { store: { ...store, revision: store.revision + 1, decisionReceipts: [receipt, ...store.decisionReceipts] }, receipt, deduplicated: false };
}

export function createUnconfiguredExternalEvidenceActivationPort(): ExternalEvidenceActivationPort {
  return {
    async importObservation() {
      throw new ExternalEvidenceActivationError("external-unavailable", "A controlled authority activation intake is not configured.");
    },
  };
}
