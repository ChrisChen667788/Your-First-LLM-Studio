import { randomUUID } from "node:crypto";

import { readAgentEvidenceOperationSpecs } from "@/features/agent/evidence-operations";
import { readMultimodalEvidenceOperationSpecs } from "@/features/benchmark/multimodal-execution-evidence";
import {
  type EvidenceOperationMilestoneSpec,
  operationalEvidenceCandidatePath,
  operationalEvidenceDigest,
  readOperationalEvidenceCandidates,
  recordOperationalEvidenceCandidate,
  validateOperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import { readFineTuneEvidenceOperationSpecs } from "@/features/finetune/federated-worker-evidence";
import { readGovernanceEvidenceOperationSpecs } from "@/features/governance/team-asset-evidence";
import { readModelEvidenceOperationSpecs } from "@/features/models/evidence-operations";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { readProviderEvidenceOperationSpecs } from "@/features/providers/evidence-operations";
import { readRetrievalEvidenceOperationSpecs } from "@/features/retrieval/evidence-operations";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const EVIDENCE_OPERATIONS_TRAIN_SCHEMA_VERSION =
  "experiments.evidence-operations-train.v1" as const;
const STORE_SCHEMA_VERSION = "experiments.evidence-operations-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.0.0-v4.1.4-evidence-operations-train.json",
);

type TrainStatus = "pass" | "hold";
type VersionState = EvidenceOperationMilestoneSpec & {
  sourceStatus: "pass";
  localStatus: TrainStatus;
  externalStatus: "hold";
  productionStatus: "blocked";
  candidateReceipts: number;
  latestCandidateDigest: string | null;
};

type TrainState = {
  generatedAt: string;
  sourceStatus: "pass";
  localStatus: TrainStatus;
  externalStatus: "hold";
  productionStatus: "blocked";
  versions: VersionState[];
  totals: {
    versions: 15;
    sourcePassed: 15;
    localPassed: number;
    localHeld: number;
    candidateReceipts: number;
    externalVerified: 0;
  };
  disclosure: string;
  stateDigest: string;
};

type TrainReceipt = TrainState & {
  id: string;
  evidenceDigest: string;
};

function baseSpecs() {
  return [
    ...readProviderEvidenceOperationSpecs(),
    ...readAgentEvidenceOperationSpecs(),
    ...readMultimodalEvidenceOperationSpecs(),
    ...readModelEvidenceOperationSpecs(),
    ...readRetrievalEvidenceOperationSpecs(),
    ...readFineTuneEvidenceOperationSpecs(),
    ...readGovernanceEvidenceOperationSpecs(),
  ];
}

function promotionSpec(localPassed: number, specs: EvidenceOperationMilestoneSpec[]): EvidenceOperationMilestoneSpec {
  return {
    version: "v4.1.4",
    label: "Evidence Operations Promotion Gate",
    owner: "features/experiments",
    track: "release",
    contract: EVIDENCE_OPERATIONS_TRAIN_SCHEMA_VERSION,
    requiredMetrics: ["milestones", "localPassed", "externalVerified"],
    currentSignal: {
      status: localPassed === specs.length ? "pass" : "hold",
      summary: `${localPassed}/${specs.length} domain evidence operation(s) currently satisfy the local gate.`,
      evidenceDigest: operationalEvidenceDigest(
        specs.map((spec) => ({
          version: spec.version,
          status: spec.currentSignal.status,
          digest: spec.currentSignal.evidenceDigest,
        })),
      ),
    },
    localGate: "Every preceding domain operation must have a current observed receipt; aggregate self-attestation cannot replace one.",
    externalGate: "Independent signatures, immutable archive read-back, distribution approval, and production authority remain external.",
  };
}

export function readEvidenceOperationSpecs() {
  const specs = baseSpecs();
  const currentLocalPassed = specs.filter((spec) => spec.currentSignal.status === "pass").length;
  return [...specs, promotionSpec(currentLocalPassed, specs)];
}

export function buildEvidenceOperationsTrainState(): TrainState {
  const candidates = readOperationalEvidenceCandidates();
  const specs = baseSpecs();
  const versions = specs.map((spec) => {
    const matching = candidates.filter((candidate) => candidate.receipt.milestone === spec.version);
    const valid = matching.filter((candidate) =>
      validateOperationalEvidenceReceipt({ receipt: candidate.receipt, spec }).ok,
    );
    const localStatus: TrainStatus =
      spec.currentSignal.status === "pass" || valid.length > 0 ? "pass" : "hold";
    return {
      ...spec,
      sourceStatus: "pass" as const,
      localStatus,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      candidateReceipts: valid.length,
      latestCandidateDigest: valid[0]?.evidenceDigest || null,
    };
  });
  const domainLocalPassed = versions.filter((version) => version.localStatus === "pass").length;
  const gate = promotionSpec(domainLocalPassed, specs);
  const gateVersion: VersionState = {
    ...gate,
    sourceStatus: "pass",
    localStatus: domainLocalPassed === specs.length ? "pass" : "hold",
    externalStatus: "hold",
    productionStatus: "blocked",
    candidateReceipts: candidates.filter((candidate) => candidate.receipt.milestone === gate.version).length,
    latestCandidateDigest: null,
  };
  const allVersions = [...versions, gateVersion];
  const localPassed = allVersions.filter((version) => version.localStatus === "pass").length;
  const digestCore = allVersions.map((version) => ({
    version: version.version,
    sourceStatus: version.sourceStatus,
    localStatus: version.localStatus,
    signalDigest: version.currentSignal.evidenceDigest,
    latestCandidateDigest: version.latestCandidateDigest,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass",
    localStatus: localPassed === allVersions.length ? "pass" : "hold",
    externalStatus: "hold",
    productionStatus: "blocked",
    versions: allVersions,
    totals: {
      versions: 15,
      sourcePassed: 15,
      localPassed,
      localHeld: 15 - localPassed,
      candidateReceipts: candidates.length,
      externalVerified: 0,
    },
    disclosure:
      "All 15 repository-owned evidence-operation contracts are implemented. Candidate receipts can satisfy only local evidence; external assurance, distribution, and production remain fail-closed.",
    stateDigest: operationalEvidenceDigest(digestCore),
  };
}

export function recordEvidenceOperationsCandidate(receipt: unknown) {
  const milestone =
    receipt && typeof receipt === "object" && !Array.isArray(receipt)
      ? (receipt as { milestone?: unknown }).milestone
      : null;
  const spec = readEvidenceOperationSpecs().find((entry) => entry.version === milestone);
  if (!spec) throw new Error("The candidate receipt does not name a supported v4.0.0-v4.1.4 milestone.");
  return recordOperationalEvidenceCandidate({ receipt, spec });
}

export function runEvidenceOperationsTrainAcceptance() {
  const state = buildEvidenceOperationsTrainState();
  const withoutDigest = {
    id: `evidence-operations-train-${randomUUID()}`,
    ...state,
  };
  const receipt: TrainReceipt = {
    ...withoutDigest,
    evidenceDigest: operationalEvidenceDigest(withoutDigest),
  };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readEvidenceOperationsTrainEvidence() {
  const receipts = readDurableReceipts<TrainReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = buildEvidenceOperationsTrainState();
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: EVIDENCE_OPERATIONS_TRAIN_SCHEMA_VERSION,
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    paths: {
      trainReceipts: RECEIPT_PATH,
      candidateReceipts: operationalEvidenceCandidatePath(),
    },
  };
}
