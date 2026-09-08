import { createHash } from "node:crypto";

import {
  EVIDENCE_COLLECTION_SOURCE_MILESTONES,
} from "@/features/evidence/collection-catalog";
import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  operationalEvidenceDigest,
  type OperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import { readEvidenceOperationSpecs } from "@/features/experiments/evidence-operations-train";

export const EVIDENCE_ADJUDICATION_SCHEMA_VERSION =
  "evidence.adjudication.v1" as const;

export type EvidenceAdjudicationPlan = {
  version: string;
  label: string;
  track: "identity" | "artifacts" | "metrics" | "review" | "release";
  localGate: string;
  externalGate: string;
  requiresAcceptedReceipt: boolean;
};

export type EvidenceReviewerAttestation = {
  schemaVersion: "evidence.reviewer-attestation.v1";
  issuerId: string;
  subjectId: string;
  organizationId: string;
  assurance: "local" | "external";
  assertionDigest: string;
  keyFingerprint: string;
  issuedAt: string;
  expiresAt: string;
};

export type EvidenceArtifactReadback = {
  schemaVersion: "evidence.artifact-readback.v1";
  artifactDigest: string;
  locatorDigest: string;
  byteLength: number;
  storageClass: "local-durable" | "external-immutable";
  readAt: string;
  readerId: string;
};

export type EvidenceMetricPolicy = {
  schemaVersion: "evidence.metric-policy.v1";
  milestone: string;
  requiredMetrics: string[];
  minimums: Record<string, number>;
  maximums: Record<string, number>;
  policyDigest: string;
};

export type EvidenceAdjudicationExternalPort = {
  verifyReviewerAttestation(input: EvidenceReviewerAttestation): Promise<{
    verified: boolean;
    issuerId: string;
    subjectId: string;
    verificationDigest: string;
  }>;
  readArtifact(input: EvidenceArtifactReadback): Promise<{
    verified: boolean;
    artifactDigest: string;
    readbackDigest: string;
  }>;
};

export class EvidenceAdjudicationPolicyError extends Error {
  constructor(
    readonly code: "invalid-input" | "external-unavailable" | "verification-failed",
    message: string,
  ) {
    super(message);
    this.name = "EvidenceAdjudicationPolicyError";
  }
}

function isDigest(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isIdentity(value: unknown) {
  return typeof value === "string" &&
    /^[a-z0-9][a-z0-9._:@/-]{2,127}$/iu.test(value.trim()) &&
    !/^(?:demo|fixture|local|test|unknown)(?:[-_.:]|$)/iu.test(value.trim());
}

function onlyKeys(value: unknown, keys: string[]) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).every((key) => keys.includes(key));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function evidenceAdjudicationDigest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export const EVIDENCE_ADJUDICATION_PLANS: EvidenceAdjudicationPlan[] = [
  { version: "v4.4.0", label: "Reviewer Attestation Contract", track: "identity", localGate: "Strict reviewer-attestation schema rejects placeholder identities, stale assertions, and self-review bindings.", externalGate: "An external identity verifier must validate issuer, subject, organization, and signing key.", requiresAcceptedReceipt: false },
  { version: "v4.4.1", label: "Trusted Reviewer Issuer Registry", track: "identity", localGate: "Issuer configuration is explicit and excludes unpinned or non-HTTPS authority endpoints.", externalGate: "A real IdP, SCIM directory, or organization key registry must be configured and queried.", requiresAcceptedReceipt: false },
  { version: "v4.4.2", label: "Reviewer Separation Policy", track: "identity", localGate: "Operator, worker, and reviewer identities must be pairwise distinct before an acceptance package can form.", externalGate: "Organization role assignments and conflicts of interest require directory evidence.", requiresAcceptedReceipt: true },
  { version: "v4.4.3", label: "Independent Review Quorum", track: "identity", localGate: "A quorum package is order-bound and rejects duplicate reviewer subjects or duplicate assertions.", externalGate: "Independent principals must be established by an external identity authority.", requiresAcceptedReceipt: true },
  { version: "v4.4.4", label: "Artifact Manifest and Readback Contract", track: "artifacts", localGate: "Readback records bind digest, locator digest, byte length, reader identity, and bounded observation time.", externalGate: "Immutable object storage must return a real object read-back receipt.", requiresAcceptedReceipt: false },
  { version: "v4.4.5", label: "Immutable Archive Readback", track: "artifacts", localGate: "A local artifact cannot be labeled external immutable storage.", externalGate: "Object Lock or an equivalent retention authority must verify immutable read-back.", requiresAcceptedReceipt: true },
  { version: "v4.4.6", label: "Evidence Retention and Legal Hold", track: "artifacts", localGate: "Retention policy has a bounded duration, a nonempty hold reason, and a digest-bound manifest.", externalGate: "The configured archive must enforce retention and legal hold independently.", requiresAcceptedReceipt: false },
  { version: "v4.4.7", label: "Domain Metric Policy Registry", track: "metrics", localGate: "Every v4.0-v4.1 receipt metric is governed by a versioned required-metric policy.", externalGate: "Domain owners must approve real thresholds and evaluation cohorts.", requiresAcceptedReceipt: false },
  { version: "v4.4.8", label: "Metric Threshold and Baseline Binding", track: "metrics", localGate: "Minimums and maximums cannot reference unknown metrics or non-finite values.", externalGate: "Baseline provenance and threshold ownership require independent review.", requiresAcceptedReceipt: false },
  { version: "v4.4.9", label: "Receipt Metric Adjudication", track: "metrics", localGate: "A current accepted receipt must satisfy its complete metric policy before it can be adjudicated.", externalGate: "Measured metric values require an authorized workload and qualified domain owner.", requiresAcceptedReceipt: true },
  { version: "v4.5.0", label: "Independent Re-observation Correlation", track: "review", localGate: "Re-observation records bind a different observer and matching workload, artifact, and metric policy digests.", externalGate: "A distinct host or organization must execute the confirming workload.", requiresAcceptedReceipt: true },
  { version: "v4.5.1", label: "Acceptance Package Ledger", track: "review", localGate: "An acceptance package is digest-bound to job, receipt, attestation, artifacts, policy, and re-observation references.", externalGate: "External identity and archive verification must succeed before an acceptance package is authoritative.", requiresAcceptedReceipt: true },
  { version: "v4.5.2", label: "Portable Evidence Export", track: "artifacts", localGate: "Exports contain only digests and bounded metadata, with a stable manifest digest.", externalGate: "An independent destination must import and read back the exact export.", requiresAcceptedReceipt: false },
  { version: "v4.5.3", label: "Revocation and Re-adjudication", track: "review", localGate: "Revocation preserves the predecessor package and blocks it from aggregate promotion.", externalGate: "Issuer revocation and archive retention state must be independently current.", requiresAcceptedReceipt: true },
  { version: "v4.5.4", label: "Evidence Adjudication Promotion Gate", track: "release", localGate: "All fourteen domain milestones require current, non-revoked adjudication packages before local readiness.", externalGate: "Independent identity, immutable archive, distribution approval, and production authority remain separate.", requiresAcceptedReceipt: true },
];

export function validateEvidenceAdjudicationCatalog(plans = EVIDENCE_ADJUDICATION_PLANS) {
  const expected = Array.from({ length: 15 }, (_, index) =>
    index < 10 ? `v4.4.${index}` : `v4.5.${index - 10}`,
  );
  const checks = {
    fifteenPlans: plans.length === 15,
    exactVersions: plans.map((plan) => plan.version).join(",") === expected.join(","),
    uniqueVersions: new Set(plans.map((plan) => plan.version)).size === plans.length,
    actionableGates: plans.every((plan) => plan.localGate.length > 20 && plan.externalGate.length > 20),
  };
  return { ok: Object.values(checks).every(Boolean), checks, plans: plans.length };
}

export function validateReviewerAttestation(input: unknown, now = new Date()) {
  const attestation = input as Partial<EvidenceReviewerAttestation>;
  const issuedAt = Date.parse(attestation.issuedAt || "");
  const expiresAt = Date.parse(attestation.expiresAt || "");
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "issuerId", "subjectId", "organizationId", "assurance", "assertionDigest", "keyFingerprint", "issuedAt", "expiresAt"]),
    schemaVersion: attestation.schemaVersion === "evidence.reviewer-attestation.v1",
    identities: isIdentity(attestation.issuerId) && isIdentity(attestation.subjectId) && isIdentity(attestation.organizationId),
    assurance: attestation.assurance === "local" || attestation.assurance === "external",
    digests: isDigest(attestation.assertionDigest) && isDigest(attestation.keyFingerprint),
    currentWindow: Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && issuedAt <= now.getTime() && expiresAt > now.getTime() && expiresAt - issuedAt <= 24 * 60 * 60 * 1000,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function validateArtifactReadback(input: unknown, now = new Date()) {
  const readback = input as Partial<EvidenceArtifactReadback>;
  const readAt = Date.parse(readback.readAt || "");
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "artifactDigest", "locatorDigest", "byteLength", "storageClass", "readAt", "readerId"]),
    schemaVersion: readback.schemaVersion === "evidence.artifact-readback.v1",
    digests: isDigest(readback.artifactDigest) && isDigest(readback.locatorDigest),
    byteLength: Number.isInteger(readback.byteLength) && Number(readback.byteLength) > 0,
    storageClass: readback.storageClass === "local-durable" || readback.storageClass === "external-immutable",
    currentReadback: Number.isFinite(readAt) && readAt <= now.getTime() + 5 * 60_000 && now.getTime() - readAt <= 7 * 24 * 60 * 60_000,
    reader: isIdentity(readback.readerId),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function buildEvidenceMetricPolicy(milestone: string): EvidenceMetricPolicy {
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === milestone);
  if (!spec || !EVIDENCE_COLLECTION_SOURCE_MILESTONES.includes(milestone as typeof EVIDENCE_COLLECTION_SOURCE_MILESTONES[number])) {
    throw new EvidenceAdjudicationPolicyError("invalid-input", "A v4.0-v4.1 domain milestone is required for a metric policy.");
  }
  const core = {
    schemaVersion: "evidence.metric-policy.v1" as const,
    milestone,
    requiredMetrics: [...spec.requiredMetrics].sort(),
    minimums: Object.fromEntries(spec.requiredMetrics.map((metric) => [metric, 0])),
    maximums: {},
  };
  return { ...core, policyDigest: evidenceAdjudicationDigest(core) };
}

export function validateEvidenceMetricPolicy(input: unknown) {
  const policy = input as Partial<EvidenceMetricPolicy>;
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === policy.milestone);
  const allowed = new Set(spec?.requiredMetrics || []);
  const numericRecord = (record: unknown) => Boolean(record && typeof record === "object" && !Array.isArray(record)) &&
    Object.entries(record as Record<string, unknown>).every(([key, value]) => allowed.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0);
  const core = policy.schemaVersion === "evidence.metric-policy.v1" ? {
    schemaVersion: policy.schemaVersion,
    milestone: policy.milestone,
    requiredMetrics: policy.requiredMetrics,
    minimums: policy.minimums,
    maximums: policy.maximums,
  } : null;
  const checks = {
    strictSchema: onlyKeys(input, ["schemaVersion", "milestone", "requiredMetrics", "minimums", "maximums", "policyDigest"]),
    schemaVersion: policy.schemaVersion === "evidence.metric-policy.v1",
    knownMilestone: Boolean(spec),
    requiredMetrics: Array.isArray(policy.requiredMetrics) && policy.requiredMetrics.length === allowed.size && policy.requiredMetrics.every((metric) => allowed.has(metric)) && new Set(policy.requiredMetrics).size === policy.requiredMetrics.length,
    bounds: numericRecord(policy.minimums) && numericRecord(policy.maximums),
    digest: Boolean(core) && policy.policyDigest === evidenceAdjudicationDigest(core),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function adjudicateReceiptMetrics(input: { receipt: OperationalEvidenceReceipt; policy: EvidenceMetricPolicy }) {
  const policy = validateEvidenceMetricPolicy(input.policy);
  const metrics = input.receipt.metrics || {};
  const completeness = input.policy.requiredMetrics.every((metric) => typeof metrics[metric] === "number" && Number.isFinite(metrics[metric]) && metrics[metric] >= 0);
  const minimums = Object.entries(input.policy.minimums).every(([metric, minimum]) => (metrics[metric] ?? -1) >= minimum);
  const maximums = Object.entries(input.policy.maximums).every(([metric, maximum]) => (metrics[metric] ?? Infinity) <= maximum);
  return { ok: policy.ok && completeness && minimums && maximums, checks: { policy: policy.ok, completeness, minimums, maximums } };
}

export function createUnconfiguredEvidenceAdjudicationPort(): EvidenceAdjudicationExternalPort {
  const unavailable = async () => {
    throw new EvidenceAdjudicationPolicyError("external-unavailable", "External identity and immutable archive adapters are not configured.");
  };
  return { verifyReviewerAttestation: unavailable, readArtifact: unavailable };
}

export async function verifyEvidenceAdjudicationPackage(input: {
  job: EvidenceCollectionJob;
  attestation: EvidenceReviewerAttestation;
  artifact: EvidenceArtifactReadback;
  policy: EvidenceMetricPolicy;
  port?: EvidenceAdjudicationExternalPort;
}) {
  if (input.job.status !== "accepted" || !input.job.submission || !input.job.review?.candidateDigest) {
    throw new EvidenceAdjudicationPolicyError("invalid-input", "Only a current accepted collection receipt can be adjudicated.");
  }
  if (input.attestation.subjectId === input.job.operatorId || input.attestation.subjectId !== input.job.review.reviewerId || input.attestation.organizationId !== input.job.organizationId) {
    throw new EvidenceAdjudicationPolicyError("invalid-input", "The attested reviewer must match the distinct recorded reviewer and organization.");
  }
  if (input.artifact.artifactDigest !== input.job.submission.receiptDigest || input.artifact.storageClass !== "external-immutable") {
    throw new EvidenceAdjudicationPolicyError("invalid-input", "An external immutable readback must bind the accepted receipt digest.");
  }
  const attestation = validateReviewerAttestation(input.attestation);
  const artifact = validateArtifactReadback(input.artifact);
  const metrics = adjudicateReceiptMetrics({ receipt: input.job.submission.receipt, policy: input.policy });
  if (!attestation.ok || !artifact.ok || !metrics.ok) {
    throw new EvidenceAdjudicationPolicyError("verification-failed", "The adjudication package failed local identity, artifact, or metric policy checks.");
  }
  const port = input.port || createUnconfiguredEvidenceAdjudicationPort();
  const [identity, readback] = await Promise.all([
    port.verifyReviewerAttestation(input.attestation),
    port.readArtifact(input.artifact),
  ]);
  if (!identity.verified || identity.issuerId !== input.attestation.issuerId || identity.subjectId !== input.attestation.subjectId || !readback.verified || readback.artifactDigest !== input.artifact.artifactDigest) {
    throw new EvidenceAdjudicationPolicyError("verification-failed", "The configured external verifier did not confirm the reviewer or immutable artifact.");
  }
  const core = {
    schemaVersion: EVIDENCE_ADJUDICATION_SCHEMA_VERSION,
    jobId: input.job.id,
    sourceMilestone: input.job.sourceMilestone,
    receiptDigest: input.job.submission.receiptDigest,
    candidateDigest: input.job.review.candidateDigest,
    attestationDigest: evidenceAdjudicationDigest(input.attestation),
    artifactDigest: input.artifact.artifactDigest,
    policyDigest: input.policy.policyDigest,
    identityVerificationDigest: identity.verificationDigest,
    readbackDigest: readback.readbackDigest,
  };
  return { ...core, evidenceDigest: evidenceAdjudicationDigest(core) };
}
