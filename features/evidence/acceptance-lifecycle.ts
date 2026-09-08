import { createHash, randomUUID } from "node:crypto";

import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";

export const EVIDENCE_ACCEPTANCE_LIFECYCLE_SCHEMA_VERSION =
  "evidence.acceptance-lifecycle.v1" as const;

export type EvidenceAcceptanceLifecyclePlan = {
  version: string;
  label: string;
  track: "authority" | "intake" | "verification" | "decision" | "release";
  localGate: string;
  externalGate: string;
  requiresVerifiedPackage: boolean;
};

export type EvidenceAcceptanceAuthorityConfig = {
  schemaVersion: "evidence.acceptance-authority-config.v1";
  issuerId: string;
  organizationId: string;
  jwksUrl: string;
  archiveReadbackUrl: string;
  keyFingerprint: string;
  configDigest: string;
};

export type EvidenceReobservation = {
  schemaVersion: "evidence.reobservation.v1";
  observerId: string;
  organizationId: string;
  workloadDigest: string;
  artifactDigest: string;
  policyDigest: string;
  observedAt: string;
  observationDigest: string;
};

export type EvidenceAcceptanceState =
  | "draft"
  | "submitted"
  | "externally-verified"
  | "rejected"
  | "revoked";

export type EvidenceAcceptanceEvent = {
  id: string;
  type:
    | "created"
    | "submitted"
    | "externally-verified"
    | "rejected"
    | "revoked"
    | "re-adjudication-linked"
    | "portable-import-verified"
    | "distribution-handoff-recorded";
  actorId: string;
  at: string;
  revision: number;
  detail: string;
  digest: string;
};

export type EvidenceAcceptancePackage = {
  schemaVersion: "evidence.acceptance-package.v1";
  id: string;
  idempotencyKey: string;
  organizationId: string;
  sourceMilestone: string;
  adjudicationDigest: string;
  receiptDigest: string;
  attestationDigest: string;
  artifactDigest: string;
  policyDigest: string;
  reobservationDigest: string;
  state: EvidenceAcceptanceState;
  revision: number;
  createdAt: string;
  updatedAt: string;
  externalVerificationDigest: string | null;
  rejectionReason: string | null;
  revocationReason: string | null;
  predecessorPackageId: string | null;
  events: EvidenceAcceptanceEvent[];
};

export type EvidenceAcceptanceStore = {
  schemaVersion: "evidence.acceptance-package-store.v1";
  revision: number;
  packages: EvidenceAcceptancePackage[];
  idempotency: Record<string, string>;
};

export type EvidenceAcceptanceExternalPort = {
  verifyAuthorityConfig(input: EvidenceAcceptanceAuthorityConfig): Promise<{
    verified: boolean;
    issuerId: string;
    configurationDigest: string;
    verificationDigest: string;
  }>;
  verifyPackage(input: {
    package: EvidenceAcceptancePackage;
    authority: EvidenceAcceptanceAuthorityConfig;
  }): Promise<{
    verified: boolean;
    packageId: string;
    packageDigest: string;
    artifactDigest: string;
    decisionDigest: string;
    verifiedAt: string;
  }>;
};

export class EvidenceAcceptanceLifecycleError extends Error {
  constructor(
    readonly code:
      | "invalid-input"
      | "invalid-transition"
      | "revision-conflict"
      | "capacity-exceeded"
      | "external-unavailable"
      | "verification-failed",
    message: string,
  ) {
    super(message);
    this.name = "EvidenceAcceptanceLifecycleError";
  }
}

const MAX_PACKAGES = 300;
const MAX_EVENTS = 100;
const DAY = 24 * 60 * 60 * 1_000;
const HEX = /^[a-f0-9]{64}$/u;
const IDENTITY = /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu;
const PACKAGE_STATES = new Set<EvidenceAcceptanceState>([
  "draft",
  "submitted",
  "externally-verified",
  "rejected",
  "revoked",
]);
const EVENT_TYPES = new Set<EvidenceAcceptanceEvent["type"]>([
  "created",
  "submitted",
  "externally-verified",
  "rejected",
  "revoked",
  "re-adjudication-linked",
  "portable-import-verified",
  "distribution-handoff-recorded",
]);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function evidenceAcceptanceDigest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

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

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function onlyKeys(value: unknown, keys: readonly string[]) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).every((key) => keys.includes(key));
}

function event(input: Omit<EvidenceAcceptanceEvent, "id" | "digest">): EvidenceAcceptanceEvent {
  const core = { ...input, id: randomUUID() };
  return { ...core, digest: evidenceAcceptanceDigest(core) };
}

function packageCore(input: Omit<EvidenceAcceptancePackage, "events">) {
  return {
    schemaVersion: input.schemaVersion,
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    organizationId: input.organizationId,
    sourceMilestone: input.sourceMilestone,
    adjudicationDigest: input.adjudicationDigest,
    receiptDigest: input.receiptDigest,
    attestationDigest: input.attestationDigest,
    artifactDigest: input.artifactDigest,
    policyDigest: input.policyDigest,
    reobservationDigest: input.reobservationDigest,
    state: input.state,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    externalVerificationDigest: input.externalVerificationDigest,
    rejectionReason: input.rejectionReason,
    revocationReason: input.revocationReason,
    predecessorPackageId: input.predecessorPackageId,
  };
}

export const EVIDENCE_ACCEPTANCE_LIFECYCLE_PLANS: EvidenceAcceptanceLifecyclePlan[] = [
  { version: "v4.6.0", label: "Authority Configuration Contract", track: "authority", localGate: "Issuer, key fingerprint, JWKS URL, and archive read-back URL are strict HTTPS and digest-bound configuration.", externalGate: "A controlled organization authority must publish the current issuer/key configuration.", requiresVerifiedPackage: false },
  { version: "v4.6.1", label: "Issuer Pin Rotation Boundary", track: "authority", localGate: "A package is bound to one pinned issuer and key fingerprint; unpinned replacements are denied.", externalGate: "The organization key authority must attest rotation and retirement state.", requiresVerifiedPackage: true },
  { version: "v4.6.2", label: "Archive Authority Boundary", track: "authority", localGate: "Archive read-back authority is explicit and cannot be localhost or a local file path.", externalGate: "Immutable storage must prove retention, legal hold, and object read-back.", requiresVerifiedPackage: true },
  { version: "v4.6.3", label: "Acceptance Package Intake", track: "intake", localGate: "A package has strict digest links, idempotency, optimistic revision, and append-only event lineage.", externalGate: "The submitted package must originate from an authorized accepted workload.", requiresVerifiedPackage: false },
  { version: "v4.6.4", label: "Adjudication Binding Preflight", track: "intake", localGate: "Receipt, reviewer, artifact, policy, and re-observation digests are all required before submission.", externalGate: "External verification must bind those values to the authoritative source systems.", requiresVerifiedPackage: true },
  { version: "v4.6.5", label: "Acceptance Package State Machine", track: "intake", localGate: "Only draft packages can submit; terminal rejected or revoked packages cannot advance.", externalGate: "An independent authority must confirm the state transition.", requiresVerifiedPackage: false },
  { version: "v4.6.6", label: "Independent Re-observation Intake", track: "verification", localGate: "A re-observation has a distinct observer and matches workload, artifact, and policy digests.", externalGate: "A distinct host or organization must execute and attest the observation.", requiresVerifiedPackage: true },
  { version: "v4.6.7", label: "Domain Owner Approval Binding", track: "verification", localGate: "The decision digest is bound to the package and never replaces source metrics or policy evidence.", externalGate: "The qualified domain owner must approve thresholds and the workload cohort.", requiresVerifiedPackage: true },
  { version: "v4.6.8", label: "External Verification Challenge", track: "verification", localGate: "Authority and package responses must echo issuer, configuration, package, and artifact digests exactly.", externalGate: "The external verifier must answer the challenge using current organization credentials.", requiresVerifiedPackage: true },
  { version: "v4.6.9", label: "Immutable Read-back Challenge", track: "verification", localGate: "Read-back evidence cannot be attached without the matching immutable artifact digest.", externalGate: "The archive authority must return a current immutable read-back result.", requiresVerifiedPackage: true },
  { version: "v4.7.0", label: "Quorum Decision Ledger", track: "decision", localGate: "Verified packages retain a digest-only decision record and deterministic predecessor lineage.", externalGate: "Independent reviewer quorum and conflict-of-interest decisions require directory authority.", requiresVerifiedPackage: true },
  { version: "v4.7.1", label: "Revocation Feed Intake", track: "decision", localGate: "Revocation is append-only, preserves the predecessor, and blocks the package from all later handoffs.", externalGate: "Issuer and archive revocation feeds must be current and independently verified.", requiresVerifiedPackage: false },
  { version: "v4.7.2", label: "Portable Manifest Import", track: "decision", localGate: "Portable manifests contain bounded digest-only records and reject mismatched package identity.", externalGate: "An independent destination must import and read back the exact package manifest.", requiresVerifiedPackage: true },
  { version: "v4.7.3", label: "Coverage and Evidence Aging", track: "release", localGate: "Coverage is counted only from current verified packages and exposes missing domains and aging evidence.", externalGate: "External records must remain current across all required domains.", requiresVerifiedPackage: true },
  { version: "v4.7.4", label: "Distribution Handoff Gate", track: "release", localGate: "The handoff stays hold until fourteen current verified non-revoked packages exist.", externalGate: "Distribution approver and production authority remain separate external decisions.", requiresVerifiedPackage: true },
];

export function createEvidenceAcceptanceAuthorityConfig(input: Omit<EvidenceAcceptanceAuthorityConfig, "schemaVersion" | "configDigest">) {
  const core = {
    schemaVersion: "evidence.acceptance-authority-config.v1" as const,
    issuerId: input.issuerId.trim(),
    organizationId: input.organizationId.trim(),
    jwksUrl: input.jwksUrl.trim(),
    archiveReadbackUrl: input.archiveReadbackUrl.trim(),
    keyFingerprint: input.keyFingerprint,
  };
  return { ...core, configDigest: evidenceAcceptanceDigest(core) };
}

export function validateEvidenceAcceptanceAuthorityConfig(input: unknown) {
  const config = input as Partial<EvidenceAcceptanceAuthorityConfig>;
  const core = config.schemaVersion === "evidence.acceptance-authority-config.v1" ? {
    schemaVersion: config.schemaVersion,
    issuerId: config.issuerId,
    organizationId: config.organizationId,
    jwksUrl: config.jwksUrl,
    archiveReadbackUrl: config.archiveReadbackUrl,
    keyFingerprint: config.keyFingerprint,
  } : null;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "issuerId", "organizationId", "jwksUrl", "archiveReadbackUrl", "keyFingerprint", "configDigest"]),
    schemaVersion: config.schemaVersion === "evidence.acceptance-authority-config.v1",
    issuer: isIdentity(config.issuerId),
    organization: isIdentity(config.organizationId),
    jwks: isHttpsUrl(config.jwksUrl),
    archive: isHttpsUrl(config.archiveReadbackUrl),
    keyFingerprint: isDigest(config.keyFingerprint),
    digest: Boolean(core) && config.configDigest === evidenceAcceptanceDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function createEvidenceAcceptancePackage(input: {
  organizationId: string;
  sourceMilestone: string;
  idempotencyKey: string;
  adjudicationDigest: string;
  receiptDigest: string;
  attestationDigest: string;
  artifactDigest: string;
  policyDigest: string;
  reobservationDigest: string;
  predecessorPackageId?: string | null;
  now?: Date;
}): EvidenceAcceptancePackage {
  const now = (input.now || new Date()).toISOString();
  const core = {
    schemaVersion: "evidence.acceptance-package.v1" as const,
    id: randomUUID(),
    idempotencyKey: input.idempotencyKey.trim(),
    organizationId: input.organizationId.trim(),
    sourceMilestone: input.sourceMilestone,
    adjudicationDigest: input.adjudicationDigest,
    receiptDigest: input.receiptDigest,
    attestationDigest: input.attestationDigest,
    artifactDigest: input.artifactDigest,
    policyDigest: input.policyDigest,
    reobservationDigest: input.reobservationDigest,
    state: "draft" as const,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    externalVerificationDigest: null,
    rejectionReason: null,
    revocationReason: null,
    predecessorPackageId: input.predecessorPackageId || null,
  };
  return {
    ...core,
    events: [event({ type: "created", actorId: "acceptance-intake", at: now, revision: 1, detail: "Package created as a local draft." })],
  };
}

function validEvent(value: unknown): value is EvidenceAcceptanceEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<EvidenceAcceptanceEvent>;
  const core = entry.id && entry.type && entry.actorId && entry.at && entry.revision && entry.detail;
  return Boolean(core) && typeof entry.id === "string" && EVENT_TYPES.has(entry.type as EvidenceAcceptanceEvent["type"]) &&
    isIdentity(entry.actorId) && isTimestamp(entry.at) && Number.isInteger(entry.revision) && Number(entry.revision) >= 1 &&
    typeof entry.detail === "string" && entry.detail.length >= 3 && isDigest(entry.digest);
}

export function validateEvidenceAcceptancePackage(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, checks: { record: false } };
  const item = input as Partial<EvidenceAcceptancePackage>;
  const timestamps = isTimestamp(item.createdAt) && isTimestamp(item.updatedAt) && Date.parse(item.createdAt) <= Date.parse(item.updatedAt);
  const digests = [item.adjudicationDigest, item.receiptDigest, item.attestationDigest, item.artifactDigest, item.policyDigest, item.reobservationDigest].every(isDigest);
  const events = Array.isArray(item.events) && item.events.length >= 1 && item.events.length <= MAX_EVENTS && item.events.every(validEvent) && item.events[0]?.revision === item.revision;
  const checks = {
    schemaVersion: item.schemaVersion === "evidence.acceptance-package.v1",
    identity: typeof item.id === "string" && item.id.length >= 12 && typeof item.idempotencyKey === "string" && item.idempotencyKey.length >= 8 && isIdentity(item.organizationId),
    milestone: EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(item.sourceMilestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number]),
    digests,
    state: typeof item.state === "string" && PACKAGE_STATES.has(item.state as EvidenceAcceptanceState),
    revision: Number.isInteger(item.revision) && Number(item.revision) >= 1,
    timestamps,
    externalVerification: item.externalVerificationDigest === null || isDigest(item.externalVerificationDigest),
    terminalFields: (item.state === "rejected") === Boolean(item.rejectionReason) && (item.state === "revoked") === Boolean(item.revocationReason),
    predecessor: item.predecessorPackageId === null || (typeof item.predecessorPackageId === "string" && item.predecessorPackageId.length >= 12),
    events,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validateEvidenceReobservation(input: unknown, originalObserverId: string) {
  const observation = input as Partial<EvidenceReobservation>;
  const core = observation.schemaVersion === "evidence.reobservation.v1" ? {
    schemaVersion: observation.schemaVersion,
    observerId: observation.observerId,
    organizationId: observation.organizationId,
    workloadDigest: observation.workloadDigest,
    artifactDigest: observation.artifactDigest,
    policyDigest: observation.policyDigest,
    observedAt: observation.observedAt,
  } : null;
  const observedAt = observation.observedAt ? Date.parse(observation.observedAt) : NaN;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "observerId", "organizationId", "workloadDigest", "artifactDigest", "policyDigest", "observedAt", "observationDigest"]),
    schemaVersion: observation.schemaVersion === "evidence.reobservation.v1",
    distinctObserver: isIdentity(observation.observerId) && observation.observerId !== originalObserverId,
    organization: isIdentity(observation.organizationId),
    digests: [observation.workloadDigest, observation.artifactDigest, observation.policyDigest].every(isDigest),
    current: Number.isFinite(observedAt) && Date.now() - observedAt <= 7 * DAY && observedAt <= Date.now() + 5 * 60_000,
    digest: Boolean(core) && observation.observationDigest === evidenceAcceptanceDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

function transition(input: {
  pkg: EvidenceAcceptancePackage;
  state: EvidenceAcceptanceState;
  actorId: string;
  type: EvidenceAcceptanceEvent["type"];
  detail: string;
  externalVerificationDigest?: string | null;
  rejectionReason?: string | null;
  revocationReason?: string | null;
  predecessorPackageId?: string | null;
  now?: Date;
}) {
  const now = (input.now || new Date()).toISOString();
  const revision = input.pkg.revision + 1;
  return {
    ...input.pkg,
    state: input.state,
    revision,
    updatedAt: now,
    externalVerificationDigest: input.externalVerificationDigest ?? input.pkg.externalVerificationDigest,
    rejectionReason: input.rejectionReason ?? input.pkg.rejectionReason,
    revocationReason: input.revocationReason ?? input.pkg.revocationReason,
    predecessorPackageId: input.predecessorPackageId ?? input.pkg.predecessorPackageId,
    events: [event({ type: input.type, actorId: input.actorId, at: now, revision, detail: input.detail }), ...input.pkg.events].slice(0, MAX_EVENTS),
  } satisfies EvidenceAcceptancePackage;
}

export function submitEvidenceAcceptancePackage(input: {
  pkg: EvidenceAcceptancePackage;
  authority: EvidenceAcceptanceAuthorityConfig;
  actorId: string;
  expectedRevision: number;
  now?: Date;
}) {
  if (input.pkg.revision !== input.expectedRevision) throw new EvidenceAcceptanceLifecycleError("revision-conflict", "Acceptance package revision changed before submission.");
  if (input.pkg.state !== "draft") throw new EvidenceAcceptanceLifecycleError("invalid-transition", "Only a draft acceptance package can be submitted.");
  const authority = validateEvidenceAcceptanceAuthorityConfig(input.authority);
  const pkg = validateEvidenceAcceptancePackage(input.pkg);
  if (!authority.ok || !pkg.ok || input.authority.organizationId !== input.pkg.organizationId || !isIdentity(input.actorId)) {
    throw new EvidenceAcceptanceLifecycleError("invalid-input", "A strict authority configuration and complete package are required for submission.");
  }
  return transition({ pkg: input.pkg, state: "submitted", actorId: input.actorId, type: "submitted", detail: "Package submitted to the configured external authority boundary.", now: input.now });
}

export function rejectEvidenceAcceptancePackage(input: {
  pkg: EvidenceAcceptancePackage;
  actorId: string;
  expectedRevision: number;
  reason: string;
  now?: Date;
}) {
  if (input.pkg.revision !== input.expectedRevision) throw new EvidenceAcceptanceLifecycleError("revision-conflict", "Acceptance package revision changed before rejection.");
  if (!["draft", "submitted"].includes(input.pkg.state)) throw new EvidenceAcceptanceLifecycleError("invalid-transition", "Only a draft or submitted package may be rejected.");
  const reason = input.reason.trim();
  if (!isIdentity(input.actorId) || reason.length < 8) throw new EvidenceAcceptanceLifecycleError("invalid-input", "A trusted actor and meaningful rejection reason are required.");
  return transition({ pkg: input.pkg, state: "rejected", actorId: input.actorId, type: "rejected", detail: reason, rejectionReason: reason, now: input.now });
}

export function revokeEvidenceAcceptancePackage(input: {
  pkg: EvidenceAcceptancePackage;
  actorId: string;
  expectedRevision: number;
  reason: string;
  now?: Date;
}) {
  if (input.pkg.revision !== input.expectedRevision) throw new EvidenceAcceptanceLifecycleError("revision-conflict", "Acceptance package revision changed before revocation.");
  if (input.pkg.state === "revoked") throw new EvidenceAcceptanceLifecycleError("invalid-transition", "An acceptance package cannot be revoked twice.");
  const reason = input.reason.trim();
  if (!isIdentity(input.actorId) || reason.length < 8) throw new EvidenceAcceptanceLifecycleError("invalid-input", "A trusted actor and meaningful revocation reason are required.");
  return transition({ pkg: input.pkg, state: "revoked", actorId: input.actorId, type: "revoked", detail: reason, revocationReason: reason, now: input.now });
}

export function createUnconfiguredEvidenceAcceptancePort(): EvidenceAcceptanceExternalPort {
  const unavailable = async () => {
    throw new EvidenceAcceptanceLifecycleError("external-unavailable", "An external organization authority and immutable archive adapter are not configured.");
  };
  return { verifyAuthorityConfig: unavailable, verifyPackage: unavailable };
}

export async function verifyEvidenceAcceptancePackage(input: {
  pkg: EvidenceAcceptancePackage;
  authority: EvidenceAcceptanceAuthorityConfig;
  port?: EvidenceAcceptanceExternalPort;
  actorId: string;
  now?: Date;
}) {
  if (input.pkg.state !== "submitted") throw new EvidenceAcceptanceLifecycleError("invalid-transition", "Only a submitted package can be externally verified.");
  const authority = validateEvidenceAcceptanceAuthorityConfig(input.authority);
  const pkg = validateEvidenceAcceptancePackage(input.pkg);
  if (!authority.ok || !pkg.ok || input.authority.organizationId !== input.pkg.organizationId || !isIdentity(input.actorId)) {
    throw new EvidenceAcceptanceLifecycleError("invalid-input", "A configured authority and complete submitted package are required for verification.");
  }
  const port = input.port || createUnconfiguredEvidenceAcceptancePort();
  const [config, result] = await Promise.all([
    port.verifyAuthorityConfig(input.authority),
    port.verifyPackage({ package: input.pkg, authority: input.authority }),
  ]);
  const packageDigest = evidenceAcceptanceDigest(packageCore(input.pkg));
  if (!config.verified || config.issuerId !== input.authority.issuerId || config.configurationDigest !== input.authority.configDigest ||
      !result.verified || result.packageId !== input.pkg.id || result.packageDigest !== packageDigest || result.artifactDigest !== input.pkg.artifactDigest || !isDigest(result.decisionDigest) || !isTimestamp(result.verifiedAt)) {
    throw new EvidenceAcceptanceLifecycleError("verification-failed", "The external authority response did not bind the configured issuer, package, artifact, and decision.");
  }
  return transition({ pkg: input.pkg, state: "externally-verified", actorId: input.actorId, type: "externally-verified", detail: "External authority returned a digest-bound verification result.", externalVerificationDigest: result.decisionDigest, now: input.now });
}

export function buildPortableEvidenceAcceptanceManifest(input: {
  packages: EvidenceAcceptancePackage[];
  authority: EvidenceAcceptanceAuthorityConfig;
}) {
  const authority = validateEvidenceAcceptanceAuthorityConfig(input.authority);
  if (!authority.ok) throw new EvidenceAcceptanceLifecycleError("invalid-input", "A strict authority configuration is required for a portable manifest.");
  const packages = input.packages.map((pkg) => {
    const validation = validateEvidenceAcceptancePackage(pkg);
    if (!validation.ok) throw new EvidenceAcceptanceLifecycleError("invalid-input", "A portable manifest cannot include malformed packages.");
    return {
      id: pkg.id,
      organizationId: pkg.organizationId,
      sourceMilestone: pkg.sourceMilestone,
      state: pkg.state,
      packageDigest: evidenceAcceptanceDigest(packageCore(pkg)),
      externalVerificationDigest: pkg.externalVerificationDigest,
      predecessorPackageId: pkg.predecessorPackageId,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const core = {
    schemaVersion: "evidence.acceptance-portable-manifest.v1" as const,
    authorityConfigDigest: input.authority.configDigest,
    packages,
  };
  return { ...core, manifestDigest: evidenceAcceptanceDigest(core) };
}

export function emptyEvidenceAcceptanceStore(): EvidenceAcceptanceStore {
  return { schemaVersion: "evidence.acceptance-package-store.v1", revision: 0, packages: [], idempotency: {} };
}

export function validateEvidenceAcceptanceStore(input: unknown): input is EvidenceAcceptanceStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const store = input as Partial<EvidenceAcceptanceStore>;
  if (store.schemaVersion !== "evidence.acceptance-package-store.v1" || !Number.isInteger(store.revision) || Number(store.revision) < 0 || !Array.isArray(store.packages) || store.packages.length > MAX_PACKAGES || !store.packages.every((pkg) => validateEvidenceAcceptancePackage(pkg).ok) || !store.idempotency || typeof store.idempotency !== "object" || Array.isArray(store.idempotency)) return false;
  const packages = store.packages as EvidenceAcceptancePackage[];
  const idempotency = store.idempotency as Record<string, unknown>;
  const ids = new Set(packages.map((pkg) => pkg.id));
  const keys = new Set(packages.map((pkg) => pkg.idempotencyKey));
  if (ids.size !== packages.length || keys.size !== packages.length) return false;
  return Object.entries(idempotency).length === packages.length && Object.entries(idempotency).every(([key, id]) => typeof id === "string" && packages.some((pkg) => pkg.idempotencyKey === key && pkg.id === id));
}

export function insertEvidenceAcceptancePackage(store: EvidenceAcceptanceStore, pkg: EvidenceAcceptancePackage) {
  const existingId = store.idempotency[pkg.idempotencyKey];
  const existing = existingId ? store.packages.find((entry) => entry.id === existingId) : undefined;
  if (existing) {
    if (existing.organizationId !== pkg.organizationId || existing.sourceMilestone !== pkg.sourceMilestone || existing.receiptDigest !== pkg.receiptDigest) {
      throw new EvidenceAcceptanceLifecycleError("revision-conflict", "The idempotency key is already bound to another acceptance package.");
    }
    return { store, pkg: existing, deduplicated: true };
  }
  if (store.packages.length >= MAX_PACKAGES) throw new EvidenceAcceptanceLifecycleError("capacity-exceeded", "Acceptance package capacity reached without evicting existing evidence.");
  const packages = [pkg, ...store.packages];
  return {
    store: { ...store, revision: store.revision + 1, packages, idempotency: Object.fromEntries(packages.map((entry) => [entry.idempotencyKey, entry.id])) },
    pkg,
    deduplicated: false,
  };
}

export function replaceEvidenceAcceptancePackage(input: {
  store: EvidenceAcceptanceStore;
  packageId: string;
  expectedRevision: number;
  mutate: (pkg: EvidenceAcceptancePackage) => EvidenceAcceptancePackage;
}) {
  const current = input.store.packages.find((pkg) => pkg.id === input.packageId);
  if (!current) throw new EvidenceAcceptanceLifecycleError("invalid-input", "Acceptance package was not found.");
  if (current.revision !== input.expectedRevision) throw new EvidenceAcceptanceLifecycleError("revision-conflict", "Acceptance package revision changed.");
  const pkg = input.mutate(current);
  if (!validateEvidenceAcceptancePackage(pkg).ok) throw new EvidenceAcceptanceLifecycleError("invalid-input", "Acceptance package mutation violated the durable contract.");
  return {
    store: { ...input.store, revision: input.store.revision + 1, packages: [pkg, ...input.store.packages.filter((entry) => entry.id !== pkg.id)] },
    pkg,
  };
}
