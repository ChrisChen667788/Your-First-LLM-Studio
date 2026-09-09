import { createHash, createPublicKey, verify } from "node:crypto";
import type { ExternalEvidenceActivationManifest, ExternalEvidenceActivationDecisionRequest } from "@/features/evidence/external-activation";
import { validateExternalEvidenceActivationManifest } from "@/features/evidence/external-activation";
import { ActivationIntakeError, envelopeSchema, type ActivationTrust, type SignedActivationEnvelope } from "./contracts";

export type IntakeContext = {
  trust: ActivationTrust;
  manifests: ExternalEvidenceActivationManifest[];
  decisionRequests: ExternalEvidenceActivationDecisionRequest[];
};
export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

// Fixed field order and domain separation make the signing protocol reproducible.
export function activationSigningBytes(envelope: SignedActivationEnvelope): Buffer {
  let body: object;
  switch (envelope.kind) {
    case "observation": body = { stage: envelope.body.stage, sourceMilestone: envelope.body.sourceMilestone, evidenceDigest: envelope.body.evidenceDigest, supersedesDigest: envelope.body.supersedesDigest }; break;
    case "decision": body = { requestId: envelope.body.requestId, requestDigest: envelope.body.requestDigest, decision: envelope.body.decision, evidenceDigest: envelope.body.evidenceDigest }; break;
    case "revocation": body = { targetEnvelopeDigest: envelope.body.targetEnvelopeDigest, reasonDigest: envelope.body.reasonDigest }; break;
    case "resolution": body = { quarantineId: envelope.body.quarantineId, reasonDigest: envelope.body.reasonDigest }; break;
    case "rotation": body = { predecessorFingerprint: envelope.body.predecessorFingerprint, successorIssuerId: envelope.body.successorIssuerId, successorKeyId: envelope.body.successorKeyId, successorFingerprint: envelope.body.successorFingerprint, rotationDigest: envelope.body.rotationDigest }; break;
  }
  return Buffer.from(`first-llm-studio/activation-envelope/v1\n${JSON.stringify({
    schemaVersion: envelope.schemaVersion, kind: envelope.kind, id: envelope.id,
    issuerId: envelope.issuerId, keyId: envelope.keyId, audience: envelope.audience,
    manifestDigest: envelope.manifestDigest, issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt, nonce: envelope.nonce, body,
  })}`, "utf8");
}

export function activationEnvelopeDigest(envelope: SignedActivationEnvelope) {
  return sha256(Buffer.concat([activationSigningBytes(envelope), Buffer.from(envelope.signature, "base64")]));
}

export function verifyActivationEnvelope(input: unknown, context: IntakeContext, now = Date.now()) {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) throw new ActivationIntakeError("schema-invalid", 400);
  const envelope = parsed.data;
  const manifest = context.manifests.find((item) => item.manifestDigest === envelope.manifestDigest);
  if (!manifest || !validateExternalEvidenceActivationManifest(manifest).ok || envelope.audience !== context.trust.audience) {
    throw new ActivationIntakeError("binding-mismatch");
  }
  const key = context.trust.keys.find((entry) => entry.issuerId === envelope.issuerId && entry.keyId === envelope.keyId);
  if (!key || key.status !== "active") throw new ActivationIntakeError("key-denied");
  const start = Date.parse(envelope.issuedAt);
  const end = Date.parse(envelope.expiresAt);
  if (start > now || end <= now || end <= start || end - start > 31 * 86400000 ||
      start < Date.parse(manifest.requestedAt) || end > Date.parse(manifest.expiresAt) ||
      start < Date.parse(key.notBefore) || end > Date.parse(key.notAfter)) throw new ActivationIntakeError("stale");
  const isAuthority = key.role === "authority" && key.issuerId === manifest.authorityId && key.fingerprint === manifest.authorityKeyFingerprint;
  if (envelope.kind === "observation") {
    const { stage, sourceMilestone } = envelope.body;
    const expectedRole = stage === "observer-attestation" ? "observer" : stage === "receipt-verification" ? "verifier" : "authority";
    const scoped = expectedRole === "authority" ? sourceMilestone === null && isAuthority
      : sourceMilestone !== null && key.milestones.includes(sourceMilestone) && key.issuerId !== manifest.authorityId && key.fingerprint !== manifest.authorityKeyFingerprint;
    if (key.role !== expectedRole || !key.stages.includes(stage) || !scoped) throw new ActivationIntakeError("key-denied");
  } else if (envelope.kind === "decision") {
    const request = context.decisionRequests.find((entry) => entry.id === envelope.body.requestId && entry.requestDigest === envelope.body.requestDigest);
    if (key.role !== "decision" || !request || request.manifestDigest !== manifest.manifestDigest ||
        request.decisionAuthorityId !== key.issuerId || request.decisionAuthorityKeyFingerprint !== key.fingerprint ||
        key.issuerId === manifest.authorityId || key.fingerprint === manifest.authorityKeyFingerprint ||
        start < Date.parse(request.requestedAt) || end > Date.parse(request.expiresAt)) throw new ActivationIntakeError("binding-mismatch");
  } else if (envelope.kind === "resolution" && !isAuthority) {
    throw new ActivationIntakeError("key-denied");
  } else if (envelope.kind === "rotation") {
    const successor = context.trust.keys.find((entry) => entry.issuerId === envelope.body.successorIssuerId && entry.keyId === envelope.body.successorKeyId);
    if (!isAuthority || envelope.body.predecessorFingerprint !== manifest.authorityKeyFingerprint ||
        !successor || successor.role !== "authority" || successor.status !== "active" ||
        successor.fingerprint !== envelope.body.successorFingerprint || successor.fingerprint === key.fingerprint) {
      throw new ActivationIntakeError("binding-mismatch");
    }
  }
  const signature = Buffer.from(envelope.signature, "base64");
  if (signature.length !== 64 || signature.toString("base64") !== envelope.signature ||
      !verify(null, activationSigningBytes(envelope), createPublicKey(key.publicKeyPem), signature)) {
    throw new ActivationIntakeError("signature-invalid");
  }
  return { envelope, digest: activationEnvelopeDigest(envelope), receivedAt: new Date(now).toISOString() };
}
