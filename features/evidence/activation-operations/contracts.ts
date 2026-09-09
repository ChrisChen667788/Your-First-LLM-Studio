import { z } from "zod";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { EXTERNAL_EVIDENCE_ACTIVATION_STAGES } from "@/features/evidence/external-activation";
import type { ActivationTrust } from "@/features/evidence/activation-intake/contracts";
import { ledgerSchema } from "@/features/evidence/activation-intake/contracts";

export const operationsDigestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const operationsIdentitySchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,127}$/u);
export const operationsTimestampSchema = z.iso.datetime();
export const operationsPolicySchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-operations-policy.v1"),
  id: operationsIdentitySchema,
  audience: operationsIdentitySchema,
  trustSnapshotDigest: operationsDigestSchema,
  requiredStages: z.array(z.enum(EXTERNAL_EVIDENCE_ACTIVATION_STAGES)),
  requiredMilestones: z.array(z.enum(EVIDENCE_COLLECTION_SOURCE_MILESTONES)),
  maxClockSkewSeconds: z.number().int().min(0).max(300),
  quarantineLeaseSeconds: z.number().int().min(60).max(86_400),
  decisionRetentionSeconds: z.number().int().min(60).max(31 * 86_400),
  rotationGraceSeconds: z.number().int().min(60).max(31 * 86_400),
  policyDigest: operationsDigestSchema,
});
export type ActivationOperationsPolicy = z.infer<typeof operationsPolicySchema>;

const keySnapshotSchema = z.strictObject({
  issuerId: operationsIdentitySchema, keyId: operationsIdentitySchema,
  role: z.enum(["authority", "observer", "verifier", "decision"]),
  fingerprint: operationsDigestSchema, status: z.enum(["active", "revoked"]),
  notBefore: operationsTimestampSchema, notAfter: operationsTimestampSchema,
  stageDigest: operationsDigestSchema, milestoneDigest: operationsDigestSchema,
});
export const trustSnapshotSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-trust-snapshot.v1"),
  audience: operationsIdentitySchema, keys: z.array(keySnapshotSchema).max(100),
  sourceDigest: operationsDigestSchema, capturedAt: operationsTimestampSchema,
  snapshotDigest: operationsDigestSchema,
});
export type ActivationTrustSnapshot = z.infer<typeof trustSnapshotSchema>;

const rotationRecordSchema = z.strictObject({
  id: operationsDigestSchema, manifestDigest: operationsDigestSchema, envelopeDigest: operationsDigestSchema,
  predecessorFingerprint: operationsDigestSchema, successorIssuerId: operationsIdentitySchema,
  successorKeyId: operationsIdentitySchema, successorFingerprint: operationsDigestSchema,
  admittedAt: operationsTimestampSchema,
});
const quarantineCaseSchema = z.strictObject({
  id: operationsDigestSchema, manifestDigest: operationsDigestSchema,
  status: z.enum(["open", "claimed", "resolved"]), claimedBy: operationsIdentitySchema.nullable(),
  leaseUntil: operationsTimestampSchema.nullable(), resolutionDigest: operationsDigestSchema.nullable(),
  updatedAt: operationsTimestampSchema,
});
const decisionAdmissionSchema = z.strictObject({
  id: operationsDigestSchema, manifestDigest: operationsDigestSchema, requestId: operationsIdentitySchema,
  requestDigest: operationsDigestSchema, envelopeDigest: operationsDigestSchema,
  decision: z.enum(["accepted", "rejected"]), admittedAt: operationsTimestampSchema,
});
const exportReceiptSchema = z.strictObject({
  id: operationsDigestSchema, ledgerRevision: z.number().int().nonnegative(), operationsRevision: z.number().int().nonnegative(),
  trustSnapshotDigest: operationsDigestSchema, policyDigest: operationsDigestSchema,
  exportDigest: operationsDigestSchema, createdAt: operationsTimestampSchema,
});
export const operationsStoreSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-operations-store.v1"), revision: z.number().int().nonnegative(),
  rotations: z.array(rotationRecordSchema).max(1000), quarantineCases: z.array(quarantineCaseSchema).max(2000),
  decisionAdmissions: z.array(decisionAdmissionSchema).max(1000), exportReceipts: z.array(exportReceiptSchema).max(100),
});
export type ActivationOperationsStore = z.infer<typeof operationsStoreSchema>;
export const operationsExportSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-operations-export.v1"),
  capturedAt: operationsTimestampSchema, trustSnapshot: trustSnapshotSchema,
  policy: operationsPolicySchema, ledger: ledgerSchema, operations: operationsStoreSchema,
  projection: z.unknown(), exportDigest: operationsDigestSchema,
});
export type ActivationOperationsExport = z.infer<typeof operationsExportSchema>;
export type ActivationTrustInput = ActivationTrust;

export const operationsCodeValues = ["unconfigured", "policy-invalid", "trust-rotation-invalid", "conflict", "case-not-found", "lease-held", "decision-used", "not-eligible", "revision-conflict", "ledger-invalid", "capacity-exceeded", "schema-invalid"] as const;
export class ActivationOperationsError extends Error {
  constructor(readonly code: typeof operationsCodeValues[number], readonly status = 422, message = `Activation operations: ${code}.`) {
    super(message); this.name = "ActivationOperationsError";
  }
}

export function emptyActivationOperationsStore(): ActivationOperationsStore {
  return { schemaVersion: "evidence.activation-operations-store.v1", revision: 0, rotations: [], quarantineCases: [], decisionAdmissions: [], exportReceipts: [] };
}
export function emptyOperationsPolicy(input: Pick<ActivationTrust, "audience"> & { trustSnapshotDigest: string; id?: string; policyDigest?: string }) {
  const policy = { schemaVersion: "evidence.activation-operations-policy.v1" as const, id: input.id || "activation-operations-default", audience: input.audience,
    trustSnapshotDigest: input.trustSnapshotDigest, requiredStages: [...EXTERNAL_EVIDENCE_ACTIVATION_STAGES], requiredMilestones: [...EVIDENCE_COLLECTION_SOURCE_MILESTONES],
    maxClockSkewSeconds: 60, quarantineLeaseSeconds: 900, decisionRetentionSeconds: 7 * 86_400, rotationGraceSeconds: 86_400, policyDigest: input.policyDigest || "" };
  return policy;
}
