import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { EXTERNAL_EVIDENCE_ACTIVATION_STAGES } from "@/features/evidence/external-activation";
import type { ActivationLedger } from "./contracts";
import { verifyLedgerHistory } from "./ledger";
import { sha256, verifyActivationEnvelope, type IntakeContext } from "./verify";

export function projectActivationIntake(ledger: ActivationLedger, context: IntakeContext, now = Date.now()) {
  verifyLedgerHistory(ledger, context);
  const revoked = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "revocation" ? [envelope.body.targetEnvelopeDigest] : []));
  const superseded = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "observation" && envelope.body.supersedesDigest ? [envelope.body.supersedesDigest] : []));
  const resolved = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "resolution" ? [envelope.body.quarantineId] : []));
  const openQuarantines = ledger.quarantines.filter((entry) => !resolved.has(entry.id));
  const active = ledger.records.filter((record) => {
    if (revoked.has(record.digest) || superseded.has(record.digest)) return false;
    try { verifyActivationEnvelope(record.envelope, context, now); return true; } catch { return false; }
  });
  const manifests = context.manifests.map((manifest) => {
    const observations = active.filter((record) => record.envelope.manifestDigest === manifest.manifestDigest && record.envelope.kind === "observation");
    const globalStages = EXTERNAL_EVIDENCE_ACTIVATION_STAGES.filter((stage) => !["observer-attestation", "receipt-verification"].includes(stage));
    const missingStages = globalStages.filter((stage) => !observations.some(({ envelope }) => envelope.kind === "observation" && envelope.body.stage === stage));
    const coveredMilestones = EVIDENCE_COLLECTION_SOURCE_MILESTONES.filter((milestone) => {
      const observers = observations.filter(({ envelope }) => envelope.kind === "observation" && envelope.body.stage === "observer-attestation" && envelope.body.sourceMilestone === milestone);
      const verifiers = observations.filter(({ envelope }) => envelope.kind === "observation" && envelope.body.stage === "receipt-verification" && envelope.body.sourceMilestone === milestone);
      return observers.some((a) => verifiers.some((b) => a.envelope.issuerId !== b.envelope.issuerId &&
        a.envelope.kind === "observation" && b.envelope.kind === "observation" && a.envelope.body.evidenceDigest === b.envelope.body.evidenceDigest));
    });
    const current = Date.parse(manifest.requestedAt) <= now && now < Date.parse(manifest.expiresAt);
    return { id: manifest.id, digest: manifest.manifestDigest, current, missingStages, coveredMilestones,
      eligibleForReview: current && missingStages.length === 0 && coveredMilestones.length === 14 && !openQuarantines.some((entry) => entry.manifestDigest === manifest.manifestDigest),
    };
  });
  const core = { revision: ledger.revision, records: ledger.records.length, currentRecords: active.length,
    revoked: revoked.size, superseded: superseded.size, openQuarantines: openQuarantines.length,
    decisionReceipts: active.filter(({ envelope }) => envelope.kind === "decision").length,
    manifests, distributionStatus: "hold" as const, productionStatus: "blocked" as const,
  };
  return { ...core, stateDigest: sha256(JSON.stringify(core)) };
}
