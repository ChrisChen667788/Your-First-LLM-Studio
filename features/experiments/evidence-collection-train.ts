import { randomUUID } from "node:crypto";

import {
  readEvidenceCollectionPlans,
  evidenceCollectorExecutionStatus,
  validateEvidenceCollectionCatalog,
} from "@/features/evidence/collection-catalog";
import { runEvidenceCollectionControlConformance } from "@/features/evidence/collection-conformance";
import type { EvidenceCollectionJob, EvidenceCollectionPlan } from "@/features/evidence/collection-contracts";
import { evidenceCollectionStorePath, readEvidenceCollectionStore } from "@/features/evidence/collection-store";
import {
  operationalEvidenceCandidatePath,
  operationalEvidenceDigest,
  readOperationalEvidenceCandidates,
  validateOperationalEvidenceReceipt,
} from "@/features/evidence/operational-receipts";
import { readEvidenceOperationsTrainEvidence, readEvidenceOperationSpecs } from "@/features/experiments/evidence-operations-train";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const EVIDENCE_COLLECTION_TRAIN_SCHEMA_VERSION =
  "experiments.evidence-collection-train.v1" as const;
const STORE_SCHEMA_VERSION = "experiments.evidence-collection-train-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.2.0-v4.3.4-evidence-collection-train.json",
);

type CollectionVersionState = EvidenceCollectionPlan & {
  sourceStatus: "pass" | "hold";
  executionStatus: "implemented" | "planned";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "blocked";
  jobTotals: { total: number; accepted: number; review: number; active: number };
  acceptedSourceMilestones: string[];
  blockers: string[];
};

type CollectionTrainState = {
  generatedAt: string;
  sourceStatus: "pass" | "hold";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  productionStatus: "blocked";
  versions: CollectionVersionState[];
  totals: {
    versions: 15;
    sourcePassed: number;
    localPassed: number;
    localHeld: number;
    jobs: number;
    acceptedJobs: number;
    reviewJobs: number;
    externalVerified: 0;
  };
  upstream: { localPassed: number; localHeld: number; stateDigest: string };
  disclosure: string;
  stateDigest: string;
};

type CollectionTrainReceipt = CollectionTrainState & { id: string; evidenceDigest: string };

function reviewedJobIsCurrent(
  job: EvidenceCollectionJob,
  specs: ReturnType<typeof readEvidenceOperationSpecs>,
  candidates: ReturnType<typeof readOperationalEvidenceCandidates>,
) {
  const spec = specs.find((entry) => entry.version === job.sourceMilestone);
  const receipt = job.submission?.receipt;
  if (!spec || !receipt || job.status !== "accepted" || !job.review?.candidateDigest) return false;
  if (receipt.subjectId !== job.subjectId || receipt.operator?.organizationId !== job.organizationId ||
      receipt.operator?.operatorId !== job.operatorId || job.review.reviewerId === job.operatorId) return false;
  const digest = operationalEvidenceDigest(receipt);
  return job.submission?.receiptDigest === digest && candidates.some((candidate) => {
    const { evidenceDigest, ...content } = candidate;
    return evidenceDigest === job.review?.candidateDigest && operationalEvidenceDigest(content) === evidenceDigest &&
      operationalEvidenceDigest(candidate.receipt) === digest;
  }) && validateOperationalEvidenceReceipt({ receipt, spec }).ok;
}

function acceptedMilestones(
  plan: EvidenceCollectionPlan, jobs: EvidenceCollectionJob[],
  specs: ReturnType<typeof readEvidenceOperationSpecs>,
  candidates: ReturnType<typeof readOperationalEvidenceCandidates>,
) {
  return plan.sourceMilestones.filter((milestone) => {
    return jobs.some((job) =>
      job.planVersion === plan.version &&
      job.sourceMilestone === milestone &&
      reviewedJobIsCurrent(job, specs, candidates)
    );
  });
}

function controlStatus(version: string, conformance: ReturnType<typeof runEvidenceCollectionControlConformance>) {
  if (version === "v4.2.0") return conformance.checks.strictContract && conformance.checks.fourEyes;
  if (version === "v4.2.1") return conformance.checks.idempotentQueue;
  if (version === "v4.2.2") return conformance.checks.exclusiveLease && conformance.checks.expiredLeaseRecovered && conformance.checks.staleWorkerFenced;
  if (version === "v4.2.3") return conformance.checks.completeCollectorCatalog;
  return false;
}

export function buildEvidenceCollectionTrainState(jobs = readEvidenceCollectionStore().jobs): CollectionTrainState {
  const plans = readEvidenceCollectionPlans();
  const catalog = validateEvidenceCollectionCatalog(plans);
  const conformance = runEvidenceCollectionControlConformance();
  const upstream = readEvidenceOperationsTrainEvidence();
  const specs = readEvidenceOperationSpecs();
  const candidates = readOperationalEvidenceCandidates();
  const versions = plans.map((plan) => {
    const planJobs = jobs.filter((job) => job.planVersion === plan.version);
    const executionStatus = plan.kind === "collector" ? evidenceCollectorExecutionStatus(plan.version) : "implemented";
    const acceptedSourceMilestones = acceptedMilestones(plan, planJobs, specs, candidates);
    const collectorPass = plan.kind === "collector" &&
      plan.sourceMilestones.length > 0 &&
      acceptedSourceMilestones.length === plan.sourceMilestones.length;
    const priorPlansPass = plan.version === "v4.3.4"
      ? plans.filter((entry) => entry.version !== "v4.3.4").every((entry) => {
          if (entry.kind === "control") return controlStatus(entry.version, conformance);
          return evidenceCollectorExecutionStatus(entry.version) === "implemented" &&
            acceptedMilestones(entry, jobs, specs, candidates).length === entry.sourceMilestones.length;
        })
      : false;
    const releasePass = plan.version === "v4.3.4" && priorPlansPass && upstream.localStatus === "pass";
    const localPass = plan.kind === "control"
      ? catalog.ok && controlStatus(plan.version, conformance)
      : plan.kind === "collector"
        ? executionStatus === "implemented" && collectorPass
        : releasePass;
    const blockers = localPass ? [] : plan.kind === "collector"
      ? [...(executionStatus === "planned" ? ["Executable collector is not implemented; this is a plan and receipt-import contract only."] : []), ...plan.sourceMilestones
          .filter((milestone) => !acceptedSourceMilestones.includes(milestone))
          .map((milestone) => `Accepted reviewed collection job missing for ${milestone}.`)]
      : plan.kind === "release"
        ? ["All fourteen source milestones and the upstream evidence-operations gate must pass."]
        : ["Collection control conformance is incomplete."];
    return {
      ...plan,
      sourceStatus: executionStatus === "implemented" ? "pass" as const : "hold" as const,
      executionStatus,
      localStatus: localPass ? "pass" as const : "hold" as const,
      externalStatus: "hold" as const,
      productionStatus: "blocked" as const,
      jobTotals: {
        total: planJobs.length,
        accepted: planJobs.filter((job) => job.status === "accepted").length,
        review: planJobs.filter((job) => job.status === "review").length,
        active: planJobs.filter((job) => ["queued", "running", "retry-wait"].includes(job.status)).length,
      },
      acceptedSourceMilestones,
      blockers,
    };
  });
  const localPassed = versions.filter((version) => version.localStatus === "pass").length;
  const sourcePassed = versions.filter((version) => version.sourceStatus === "pass").length;
  const stateCore = versions.map((version) => ({
    version: version.version,
    sourceStatus: version.sourceStatus,
    localStatus: version.localStatus,
    acceptedSourceMilestones: version.acceptedSourceMilestones,
    jobTotals: version.jobTotals,
  }));
  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: sourcePassed === 15 ? "pass" : "hold",
    localStatus: localPassed === 15 ? "pass" : "hold",
    externalStatus: "hold",
    productionStatus: "blocked",
    versions,
    totals: {
      versions: 15,
      sourcePassed,
      localPassed,
      localHeld: 15 - localPassed,
      jobs: jobs.length,
      acceptedJobs: jobs.filter((job) => job.status === "accepted").length,
      reviewJobs: jobs.filter((job) => job.status === "review").length,
      externalVerified: 0,
    },
    upstream: {
      localPassed: upstream.totals.localPassed,
      localHeld: upstream.totals.localHeld,
      stateDigest: upstream.stateDigest,
    },
    disclosure: "Queue, review/export, Provider catalog execution, and routing quality/shadow execution are implemented; eight domain executors remain planned. Distinct reviewer IDs are recorded, not independently authenticated principals. Receipt import is not execution or production authority.",
    stateDigest: operationalEvidenceDigest({ stateCore, jobs, upstream: upstream.stateDigest }),
  };
}

export function buildEvidenceCollectionPromotionBundle(
  jobs = readEvidenceCollectionStore().jobs,
  state = buildEvidenceCollectionTrainState(jobs),
) {
  const specs = readEvidenceOperationSpecs();
  const candidates = readOperationalEvidenceCandidates();
  const core = {
    schemaVersion: "experiments.evidence-collection-promotion-bundle.v1" as const,
    generatedAt: new Date().toISOString(),
    status: state.localStatus === "pass" ? "ready" as const : "hold" as const,
    externalStatus: "hold" as const,
    productionStatus: "blocked" as const,
    trainStateDigest: state.stateDigest,
    upstreamStateDigest: state.upstream.stateDigest,
    acceptedJobs: jobs
      .filter((job) => reviewedJobIsCurrent(job, specs, candidates))
      .map((job) => ({
        id: job.id,
        planVersion: job.planVersion,
        sourceMilestone: job.sourceMilestone,
        receiptDigest: job.submission?.receiptDigest || null,
        candidateDigest: job.review?.candidateDigest || null,
        reviewerId: job.review?.reviewerId || null,
      })),
    independentAcceptanceBacklog: state.versions
      .filter((version) => version.externalStatus === "hold")
      .map((version) => ({ version: version.version, gate: version.externalGate })),
  };
  return { ...core, evidenceDigest: operationalEvidenceDigest(core) };
}

export function runEvidenceCollectionTrainAcceptance() {
  const state = buildEvidenceCollectionTrainState();
  const withoutDigest = { id: `evidence-collection-train-${randomUUID()}`, ...state };
  const receipt: CollectionTrainReceipt = { ...withoutDigest, evidenceDigest: operationalEvidenceDigest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 30);
  return receipt;
}

export function readEvidenceCollectionTrainEvidence() {
  const jobs = readEvidenceCollectionStore().jobs;
  const state = buildEvidenceCollectionTrainState(jobs);
  const receipts = readDurableReceipts<CollectionTrainReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  return {
    ok: true as const,
    schemaVersion: EVIDENCE_COLLECTION_TRAIN_SCHEMA_VERSION,
    ...state,
    promotionBundle: buildEvidenceCollectionPromotionBundle(jobs, state),
    latest: receipts[0]?.stateDigest === state.stateDigest ? receipts[0] : null,
    receipts,
    paths: {
      jobs: evidenceCollectionStorePath(),
      trainReceipts: RECEIPT_PATH,
      operationalCandidates: operationalEvidenceCandidatePath(),
    },
  };
}
