import { z } from "zod";
import { EXTERNAL_EVIDENCE_ACTIVATION_STAGES } from "@/features/evidence/external-activation";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const identity = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,127}$/u);
const timestamp = z.iso.datetime();
export const stageSchema = z.enum(EXTERNAL_EVIDENCE_ACTIVATION_STAGES);
const milestone = z.enum(EVIDENCE_COLLECTION_SOURCE_MILESTONES);
export const roleSchema = z.enum(["authority", "observer", "verifier", "decision"]);
export const trustSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-trust.v1"),
  audience: identity,
  keys: z.array(z.strictObject({
    issuerId: identity,
    keyId: identity,
    role: roleSchema,
    publicKeyPem: z.string().max(4096),
    fingerprint: digestSchema,
    status: z.enum(["active", "revoked"]),
    notBefore: timestamp,
    notAfter: timestamp,
    stages: z.array(stageSchema).max(8),
    milestones: z.array(milestone).max(14),
  })).min(1).max(100),
});

const common = {
  schemaVersion: z.literal("evidence.activation-envelope.v1"),
  id: identity,
  issuerId: identity,
  keyId: identity,
  audience: identity,
  manifestDigest: digestSchema,
  issuedAt: timestamp,
  expiresAt: timestamp,
  nonce: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/u),
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/u),
};

export const envelopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...common, kind: z.literal("observation"), body: z.strictObject({
    stage: stageSchema, sourceMilestone: milestone.nullable(), evidenceDigest: digestSchema,
    supersedesDigest: digestSchema.nullable(),
  }) }),
  z.strictObject({ ...common, kind: z.literal("decision"), body: z.strictObject({
    requestId: identity, requestDigest: digestSchema, decision: z.enum(["accepted", "rejected"]), evidenceDigest: digestSchema,
  }) }),
  z.strictObject({ ...common, kind: z.literal("revocation"), body: z.strictObject({
    targetEnvelopeDigest: digestSchema, reasonDigest: digestSchema,
  }) }),
  z.strictObject({ ...common, kind: z.literal("resolution"), body: z.strictObject({
    quarantineId: digestSchema, reasonDigest: digestSchema,
  }) }),
  z.strictObject({ ...common, kind: z.literal("rotation"), body: z.strictObject({
    predecessorFingerprint: digestSchema, successorIssuerId: identity, successorKeyId: identity,
    successorFingerprint: digestSchema, rotationDigest: digestSchema,
  }) }),
]);

export const intakeCodes = ["schema-invalid", "unconfigured", "trust-invalid", "key-denied", "signature-invalid", "binding-mismatch", "stale", "replay", "revision-conflict", "capacity-exceeded", "ledger-invalid"] as const;
export class ActivationIntakeError extends Error {
  constructor(readonly code: typeof intakeCodes[number], readonly status = 422) {
    super(`Activation intake: ${code}.`);
    this.name = "ActivationIntakeError";
  }
}
export const recordSchema = z.strictObject({ envelope: envelopeSchema, digest: digestSchema, receivedAt: timestamp });
export const quarantineSchema = z.strictObject({ id: digestSchema, manifestDigest: digestSchema, payloadDigest: digestSchema, code: z.enum(intakeCodes), observedAt: timestamp });
export const ledgerSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-intake-ledger.v1"),
  revision: z.number().int().nonnegative(),
  records: z.array(recordSchema).max(8000),
  quarantines: z.array(quarantineSchema).max(2000),
});
export type SignedActivationEnvelope = z.infer<typeof envelopeSchema>;
export type ActivationTrust = z.infer<typeof trustSchema>;
export type ActivationLedger = z.infer<typeof ledgerSchema>;
export function emptyActivationLedger(): ActivationLedger {
  return { schemaVersion: "evidence.activation-intake-ledger.v1", revision: 0, records: [], quarantines: [] };
}
export const importSchema = z.strictObject({
  action: z.literal("import"), expectedRevision: z.number().int().nonnegative(),
  dryRun: z.boolean().default(false), envelopes: z.array(envelopeSchema).min(1).max(100),
});
export const backupSchema = z.strictObject({
  schemaVersion: z.literal("evidence.activation-intake-backup.v1"),
  ledger: ledgerSchema, ledgerDigest: digestSchema,
});
