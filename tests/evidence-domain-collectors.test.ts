import assert from "node:assert/strict";
import test from "node:test";

import { collectAgentEvidence } from "@/features/agent/evidence-collection-executor";
import { collectBenchmarkEvidence } from "@/features/benchmark/evidence-collection-executor";
import { collectFineTuneEvidence } from "@/features/finetune/evidence-collection-executor";
import { evidenceCollectorExecutionStatus, readEvidenceCollectorPlans } from "@/features/evidence/collection-catalog";
import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import {
  collectDomainEvidenceFromObservation,
  type DomainCollectionObservation,
} from "@/features/evidence/domain-collection";
import { EvidenceCollectionPolicyError } from "@/features/evidence/collection-policy";
import { validateOperationalEvidenceReceipt } from "@/features/evidence/operational-receipts";
import { readEvidenceOperationSpecs } from "@/features/experiments/evidence-operations-train";
import { collectGovernanceEvidence } from "@/features/governance/evidence-collection-executor";
import { collectModelEvidence } from "@/features/models/evidence-collection-executor";
import { collectRetrievalEvidence } from "@/features/retrieval/evidence-collection-executor";

const now = new Date().toISOString();

function jobFor(planVersion: string, sourceMilestone: string) {
  return {
    id: `job-${sourceMilestone}`,
    planVersion,
    sourceMilestone,
    subjectId: "observed-workload-001",
    organizationId: "studio-org",
    operatorId: "operator-001",
    attempt: 1,
  } as EvidenceCollectionJob;
}

function liveObservation(job: EvidenceCollectionJob): DomainCollectionObservation {
  const spec = readEvidenceOperationSpecs().find(
    (entry) => entry.version === job.sourceMilestone,
  );
  assert.ok(spec, `Missing spec for ${job.sourceMilestone}`);
  return {
    schemaVersion: "test.live-observation.v1",
    sourceKind: "live",
    sourceStatus: "pass",
    localStatus: "pass",
    environment: "local",
    observedAt: now,
    evidenceDigest: "a".repeat(64),
    metrics: Object.fromEntries(spec.requiredMetrics.map((metric) => [metric, 1])),
    summary: "Sanitized live observation used only for collector contract validation.",
    blockers: [],
    artifact: { source: "test-only-live-observation" },
  };
}

test("all ten domain collector executors are registered", () => {
  for (const plan of readEvidenceCollectorPlans()) {
    assert.equal(evidenceCollectorExecutionStatus(plan.version), "implemented");
  }
});

test("domain collector builders produce strict receipts from a live observation", () => {
  const collectors: Array<{
    planVersion: string;
    milestones: string[];
    collect: (job: EvidenceCollectionJob, observation: DomainCollectionObservation) => unknown;
  }> = [
    {
      planVersion: "v4.2.6",
      milestones: ["v4.0.3", "v4.0.5"],
      collect: (job, observation) => collectAgentEvidence(job, () => observation),
    },
    {
      planVersion: "v4.2.7",
      milestones: ["v4.0.4"],
      collect: (job, observation) => collectAgentEvidence(job, () => observation),
    },
    {
      planVersion: "v4.2.8",
      milestones: ["v4.0.7"],
      collect: (job, observation) => collectBenchmarkEvidence(job, () => observation),
    },
    {
      planVersion: "v4.2.9",
      milestones: ["v4.0.8", "v4.0.9"],
      collect: (job, observation) => collectModelEvidence(job, () => observation),
    },
    {
      planVersion: "v4.3.0",
      milestones: ["v4.1.0"],
      collect: (job, observation) => collectRetrievalEvidence(job, () => observation),
    },
    {
      planVersion: "v4.3.1",
      milestones: ["v4.1.1"],
      collect: (job, observation) => collectRetrievalEvidence(job, () => observation),
    },
    {
      planVersion: "v4.3.2",
      milestones: ["v4.1.2"],
      collect: (job, observation) => collectFineTuneEvidence(job, () => observation),
    },
    {
      planVersion: "v4.3.3",
      milestones: ["v4.0.6", "v4.1.3"],
      collect: (job, observation) => collectGovernanceEvidence(job, () => observation),
    },
  ];
  for (const collector of collectors) {
    for (const milestone of collector.milestones) {
      const job = jobFor(collector.planVersion, milestone);
      const collected = collector.collect(job, liveObservation(job)) as ReturnType<typeof collectDomainEvidenceFromObservation>;
      const spec = readEvidenceOperationSpecs().find((entry) => entry.version === milestone)!;
      const validation = validateOperationalEvidenceReceipt({ receipt: collected.receipt, spec });
      assert.equal(validation.ok, true, `${collector.planVersion}/${milestone}: ${validation.blockers.join(" ")}`);
      assert.equal(collected.receipt.milestone, milestone);
      assert.equal(collected.artifactDigest.length, 64);
    }
  }
});

test("reference and derived read models remain ineligible for receipt submission", () => {
  const job = jobFor("v4.2.6", "v4.0.3");
  assert.throws(
    () => collectDomainEvidenceFromObservation(job, { ...liveObservation(job), sourceKind: "reference" }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.status === 409,
  );
});

test("stale observations cannot be repackaged as a current receipt", () => {
  const job = jobFor("v4.2.6", "v4.0.3");
  assert.throws(
    () => collectDomainEvidenceFromObservation(job, {
      ...liveObservation(job),
      observedAt: "2026-08-01T00:00:00.000Z",
    }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.status === 409,
  );
});
