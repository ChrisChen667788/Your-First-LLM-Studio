import { createHash } from "node:crypto";
import type { ActivationTrust } from "@/features/evidence/activation-intake/contracts";
import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { EXTERNAL_EVIDENCE_ACTIVATION_STAGES } from "@/features/evidence/external-activation";
import { ActivationOperationsError, operationsPolicySchema, trustSnapshotSchema, type ActivationOperationsPolicy, type ActivationTrustSnapshot } from "./contracts";

export const operationsSha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const digestArray = (values: readonly string[]) => operationsSha256(JSON.stringify([...values]));

export function buildActivationTrustSnapshot(trust: ActivationTrust, capturedAt = new Date().toISOString()): ActivationTrustSnapshot {
  const keys = [...trust.keys].sort((a, b) => `${a.issuerId}:${a.keyId}`.localeCompare(`${b.issuerId}:${b.keyId}`)).map((key) => ({
    issuerId: key.issuerId, keyId: key.keyId, role: key.role, fingerprint: key.fingerprint, status: key.status,
    notBefore: key.notBefore, notAfter: key.notAfter, stageDigest: digestArray([...key.stages].sort()), milestoneDigest: digestArray([...key.milestones].sort()),
  }));
  const source = { schemaVersion: "evidence.activation-trust-snapshot.v1" as const, audience: trust.audience, keys };
  const sourceDigest = operationsSha256(JSON.stringify(source));
  return { ...source, capturedAt, sourceDigest, snapshotDigest: operationsSha256(JSON.stringify({ ...source, sourceDigest })) };
}

export function validateActivationTrustSnapshot(input: unknown) {
  const parsed = trustSnapshotSchema.safeParse(input);
  if (!parsed.success) return false;
  const snapshot = parsed.data;
  const source = { schemaVersion: snapshot.schemaVersion, audience: snapshot.audience, keys: snapshot.keys };
  return snapshot.sourceDigest === operationsSha256(JSON.stringify(source)) && snapshot.snapshotDigest === operationsSha256(JSON.stringify({ ...source, sourceDigest: snapshot.sourceDigest }));
}

export function createActivationOperationsPolicy(input: Omit<ActivationOperationsPolicy, "policyDigest"> & { policyDigest?: string }) {
  const core = { ...input, policyDigest: undefined };
  const policyDigest = input.policyDigest || operationsSha256(JSON.stringify(core));
  return { ...input, policyDigest };
}

export function validateActivationOperationsPolicy(input: unknown, snapshot: ActivationTrustSnapshot) {
  const parsed = operationsPolicySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "policy-invalid" as const };
  const policy = parsed.data;
  const core = { ...policy, policyDigest: undefined };
  const checks = {
    snapshot: policy.trustSnapshotDigest === snapshot.snapshotDigest && policy.audience === snapshot.audience,
    stages: JSON.stringify(policy.requiredStages) === JSON.stringify(EXTERNAL_EVIDENCE_ACTIVATION_STAGES),
    milestones: JSON.stringify(policy.requiredMilestones) === JSON.stringify(EVIDENCE_COLLECTION_SOURCE_MILESTONES),
    digest: policy.policyDigest === operationsSha256(JSON.stringify(core)),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

export function requireValidOperationsPolicy(input: unknown, snapshot: ActivationTrustSnapshot) {
  const result = validateActivationOperationsPolicy(input, snapshot);
  if (!result.ok) throw new ActivationOperationsError("policy-invalid", 503);
  return input as ActivationOperationsPolicy;
}
