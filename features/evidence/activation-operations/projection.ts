import { EVIDENCE_COLLECTION_SOURCE_MILESTONES } from "@/features/evidence/collection-catalog";
import { EXTERNAL_EVIDENCE_ACTIVATION_STAGES } from "@/features/evidence/external-activation";
import { projectActivationIntake } from "@/features/evidence/activation-intake/read-model";
import { verifyActivationEnvelope, type IntakeContext } from "@/features/evidence/activation-intake/verify";
import type { ActivationLedger } from "@/features/evidence/activation-intake/contracts";
import { operationsSha256 } from "./canonical";
import type { ActivationOperationsPolicy, ActivationOperationsStore, ActivationTrustSnapshot } from "./contracts";

function liveRecords(ledger: ActivationLedger, context: IntakeContext, now: number) {
  const revoked = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "revocation" ? [envelope.body.targetEnvelopeDigest] : []));
  const superseded = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "observation" && envelope.body.supersedesDigest ? [envelope.body.supersedesDigest] : []));
  return ledger.records.filter((record) => !revoked.has(record.digest) && !superseded.has(record.digest))
    .filter((record) => { try { verifyActivationEnvelope(record.envelope, context, now); return true; } catch { return false; } });
}

function quarantineCases(ledger: ActivationLedger, operations: ActivationOperationsStore, now: number) {
  const resolutions = new Set(ledger.records.flatMap(({ envelope }) => envelope.kind === "resolution" ? [envelope.body.quarantineId] : []));
  return ledger.quarantines.map((quarantine) => {
    const stored = operations.quarantineCases.find((entry) => entry.id === quarantine.id);
    const resolved = resolutions.has(quarantine.id) || stored?.status === "resolved";
    const claimed = !resolved && stored?.status === "claimed" && stored.leaseUntil && Date.parse(stored.leaseUntil) > now;
    return { id: quarantine.id, manifestDigest: quarantine.manifestDigest, code: quarantine.code,
      status: resolved ? "resolved" as const : claimed ? "claimed" as const : "open" as const,
      claimedBy: claimed ? stored?.claimedBy || null : null, leaseUntil: claimed ? stored?.leaseUntil || null : null,
    };
  });
}

export function projectActivationOperations(input: {
  ledger: ActivationLedger; operations: ActivationOperationsStore; context: IntakeContext;
  policy: ActivationOperationsPolicy; snapshot: ActivationTrustSnapshot; now?: number;
}) {
  const now = input.now ?? Date.now();
  const base = projectActivationIntake(input.ledger, input.context, now);
  const active = liveRecords(input.ledger, input.context, now);
  const rotations = active.filter(({ envelope }) => envelope.kind === "rotation");
  const latestRotationByManifest = new Map<string, (typeof rotations)[number]>();
  for (const record of rotations) {
    if (record.envelope.kind !== "rotation") continue;
    const existing = latestRotationByManifest.get(record.envelope.manifestDigest);
    if (!existing || Date.parse(record.envelope.issuedAt) > Date.parse(existing.envelope.issuedAt)) latestRotationByManifest.set(record.envelope.manifestDigest, record);
  }
  const staleManifests = input.context.manifests.filter((manifest) => {
    const rotation = latestRotationByManifest.get(manifest.manifestDigest);
    return Boolean(rotation && rotation.envelope.kind === "rotation" && rotation.envelope.body.successorFingerprint !== manifest.authorityKeyFingerprint);
  }).map((manifest) => manifest.manifestDigest);
  const scopes = new Map<string, Set<string>>();
  for (const { envelope } of active) {
    if (envelope.kind !== "observation") continue;
    const key = `${envelope.manifestDigest}:${envelope.body.stage}:${envelope.body.sourceMilestone || "global"}`;
    const values = scopes.get(key) || new Set<string>(); values.add(envelope.body.evidenceDigest); scopes.set(key, values);
  }
  const conflicts = [...scopes.entries()].filter(([, values]) => values.size > 1).map(([scope, values]) => ({ scope, evidenceDigests: [...values], conflictDigest: operationsSha256(JSON.stringify({ scope, evidenceDigests: [...values].sort() })) }));
  const cases = quarantineCases(input.ledger, input.operations, now);
  const eligibleManifests = base.manifests.map((manifest) => {
    const manifestConflicts = conflicts.filter((conflict) => conflict.scope.startsWith(`${manifest.digest}:`));
    const openCases = cases.filter((entry) => entry.manifestDigest === manifest.digest && entry.status !== "resolved");
    const eligible = manifest.eligibleForReview && input.policy.trustSnapshotDigest === input.snapshot.snapshotDigest &&
      !staleManifests.includes(manifest.digest) && manifestConflicts.length === 0 && openCases.length === 0;
    return { ...manifest, eligibleForReview: eligible, conflictCount: manifestConflicts.length, openCaseCount: openCases.length };
  });
  const admissions = input.operations.decisionAdmissions.map((admission) => ({ ...admission, consumed: true as const }));
  const core = { revision: input.operations.revision, ledgerRevision: input.ledger.revision, trustSnapshotDigest: input.snapshot.snapshotDigest,
    policyDigest: input.policy.policyDigest, rotationCount: input.operations.rotations.length, staleManifests,
    conflicts, quarantineCases: cases, decisionAdmissions: admissions, manifests: eligibleManifests,
    stageCount: EXTERNAL_EVIDENCE_ACTIVATION_STAGES.length, milestoneCount: EVIDENCE_COLLECTION_SOURCE_MILESTONES.length,
    requiredStageCount: input.policy.requiredStages.length, requiredMilestoneCount: input.policy.requiredMilestones.length,
    distributionStatus: "hold" as const, productionStatus: "blocked" as const,
  };
  return { ...core, stateDigest: operationsSha256(JSON.stringify(core)) };
}
