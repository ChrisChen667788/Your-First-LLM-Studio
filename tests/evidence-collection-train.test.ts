import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { evidenceCollectionRequestSchema } from "@/features/evidence/collection-request";
import { collectionViewSchema } from "@/features/experiments/collection-view-contract";

import {
  EVIDENCE_COLLECTION_SOURCE_MILESTONES,
  readEvidenceCollectionPlans,
  readEvidenceCollectorPlans,
  validateEvidenceCollectionCatalog,
} from "@/features/evidence/collection-catalog";
import { runEvidenceCollectionControlConformance } from "@/features/evidence/collection-conformance";
import {
  assertEvidenceCollectionReceiptBinding,
  cancelEvidenceCollectionJob,
  heartbeatEvidenceCollectionJob,
  claimEvidenceCollectionJob,
  createEvidenceCollectionJob,
  EvidenceCollectionPolicyError,
  failEvidenceCollectionJob,
  linkEvidenceCollectionCandidateJob,
  retryEvidenceCollectionJob,
  reviewEvidenceCollectionJob,
} from "@/features/evidence/collection-policy";
import {
  emptyEvidenceCollectionStore,
  insertEvidenceCollectionJob,
  validateEvidenceCollectionStore,
} from "@/features/evidence/collection-store";
import {
  buildEvidenceCollectionPromotionBundle,
  buildEvidenceCollectionTrainState,
} from "@/features/experiments/evidence-collection-train";

const now = new Date("2026-09-05T01:00:00.000Z");

function queueInput(planVersion: string, sourceMilestone: string) {
  return {
    planVersion,
    sourceMilestone,
    subjectId: "provider-account-001",
    organizationId: "studio-org",
    operatorId: "operator-001",
    idempotencyKey: `${planVersion}:${sourceMilestone}:provider-account-001`,
  };
}

test("evidence collection train defines fifteen source milestones", () => {
  const plans = readEvidenceCollectionPlans();
  assert.equal(plans.length, 15);
  assert.equal(new Set(plans.map((plan) => plan.version)).size, 15);
  assert.deepEqual(plans.map((plan) => plan.version), [
    "v4.2.0", "v4.2.1", "v4.2.2", "v4.2.3", "v4.2.4",
    "v4.2.5", "v4.2.6", "v4.2.7", "v4.2.8", "v4.2.9",
    "v4.3.0", "v4.3.1", "v4.3.2", "v4.3.3", "v4.3.4",
  ]);
});

test("collector catalog covers every prior domain milestone exactly once", () => {
  const catalog = validateEvidenceCollectionCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(catalog.totals.collectors, 10);
  assert.equal(catalog.totals.coveredSourceMilestones, 14);
  assert.deepEqual(
    [...catalog.coveredSourceMilestones].sort(),
    [...EVIDENCE_COLLECTION_SOURCE_MILESTONES].sort(),
  );
});

test("collection control conformance proves queue, lease, fence and four-eyes policy", () => {
  const conformance = runEvidenceCollectionControlConformance();
  assert.equal(conformance.ok, true);
  assert.ok(Object.values(conformance.checks).every(Boolean));
});

test("queue contract rejects placeholder operator identities", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  assert.throws(
    () => createEvidenceCollectionJob({
      plan,
      now,
      queue: { ...queueInput(plan.version, plan.sourceMilestones[0]!), operatorId: "test-user" },
    }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.code === "invalid-input",
  );
});

test("queue contract rejects milestones outside collector ownership", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  assert.throws(
    () => createEvidenceCollectionJob({ plan, now, queue: queueInput(plan.version, "v4.1.2") }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.code === "invalid-input",
  );
});

test("receipt identity must match the queued subject and operator binding", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({
    plan,
    now,
    queue: queueInput(plan.version, plan.sourceMilestones[0]!),
  });
  assert.throws(
    () => assertEvidenceCollectionReceiptBinding({
      job,
      receipt: {
        subjectId: "provider-account-002",
        operator: { organizationId: job.organizationId, operatorId: job.operatorId },
      },
    }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.code === "invalid-input",
  );
});

test("durable-store reducer deduplicates an idempotency key", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({
    plan,
    now,
    id: "collection-job-idempotency",
    queue: queueInput(plan.version, plan.sourceMilestones[0]!),
  });
  const first = insertEvidenceCollectionJob(emptyEvidenceCollectionStore(), job);
  const second = insertEvidenceCollectionJob(first.store, { ...job, id: "collection-job-duplicate" });
  assert.equal(second.deduplicated, true);
  assert.equal(second.job.id, job.id);
  assert.equal(second.store.jobs.length, 1);
});

test("idempotency key cannot be reused for another organization or subject", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({
    plan,
    now,
    queue: queueInput(plan.version, plan.sourceMilestones[0]!),
  });
  const first = insertEvidenceCollectionJob(emptyEvidenceCollectionStore(), job);
  assert.throws(
    () => insertEvidenceCollectionJob(first.store, {
      ...job,
      id: "collection-job-cross-tenant",
      subjectId: "provider-account-002",
      organizationId: "other-org",
    }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.code === "revision-conflict",
  );
});

test("durable store rejects malformed job state and dangling idempotency entries", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({
    plan,
    now,
    queue: queueInput(plan.version, plan.sourceMilestones[0]!),
  });
  const valid = insertEvidenceCollectionJob(emptyEvidenceCollectionStore(), job).store;
  assert.equal(validateEvidenceCollectionStore(valid), true);
  assert.equal(validateEvidenceCollectionStore({
    ...valid,
    jobs: [{ ...job, status: "mystery" }],
  }), false);
  assert.equal(validateEvidenceCollectionStore({
    ...valid,
    idempotency: { ...valid.idempotency, dangling: "missing-job" },
  }), false);
});

test("worker failure uses bounded retry policy and preserves attempt count", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({ plan, now, queue: queueInput(plan.version, plan.sourceMilestones[0]!) });
  const claimed = claimEvidenceCollectionJob({ job, plan, workerId: "worker-alpha", expectedRevision: 1, now, ttlMs: 30_000 });
  const failed = failEvidenceCollectionJob({
    job: claimed,
    plan,
    workerId: "worker-alpha",
    fenceToken: claimed.lease!.fenceToken,
    expectedRevision: claimed.revision,
    reason: "Provider catalog probe timed out.",
    now: new Date(now.getTime() + 1_000),
  });
  assert.equal(failed.status, "retry-wait");
  assert.equal(failed.attempt, 1);
  assert.ok(Date.parse(failed.nextAttemptAt || "") > now.getTime());
  const retried = retryEvidenceCollectionJob({
    job: failed,
    actorId: "operator-001",
    expectedRevision: failed.revision,
    now: new Date(now.getTime() + 2_000),
  });
  assert.equal(retried.status, "queued");
  assert.equal(retried.attempt, 1);
  const reclaimed = claimEvidenceCollectionJob({ job: retried, plan, workerId: "worker-alpha", expectedRevision: retried.revision, now: new Date(now.getTime() + 3_000) });
  assert.equal(reclaimed.lease!.fenceToken, 2);
  assert.throws(() => heartbeatEvidenceCollectionJob({ job: reclaimed, workerId: "worker-alpha", fenceToken: 1, expectedRevision: reclaimed.revision, now: new Date(now.getTime() + 4_000) }),
    (error) => error instanceof EvidenceCollectionPolicyError && error.code === "lease-fenced");
});

test("accepted review links a candidate only after four-eyes approval", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const queued = createEvidenceCollectionJob({ plan, now, queue: queueInput(plan.version, plan.sourceMilestones[0]!) });
  const submission = {
    receipt: {},
    receiptDigest: "a".repeat(64),
    validationDigest: "b".repeat(64),
    submittedAt: now.toISOString(),
    workerId: "worker-alpha",
  };
  const reviewable = { ...queued, status: "review" as const, revision: 2, submission };
  const accepted = reviewEvidenceCollectionJob({
    job: reviewable,
    reviewerId: "reviewer-002",
    decision: "accepted",
    reason: "Receipt and artifacts verified.",
    expectedRevision: 2,
    now,
    candidateDigest: null,
  });
  assert.equal(accepted.review?.candidateDigest, null);
  const linked = linkEvidenceCollectionCandidateJob({
    job: accepted,
    reviewerId: "reviewer-002",
    candidateDigest: "c".repeat(64),
    expectedRevision: accepted.revision,
    now,
  });
  assert.equal(linked.review?.candidateDigest, "c".repeat(64));
  assert.equal(linked.events[0]?.type, "candidate-linked");
});

test("collection read model keeps local, external and production truth separate", () => {
  const state = buildEvidenceCollectionTrainState();
  assert.equal(state.versions.length, 15);
  assert.equal(state.sourceStatus, "pass");
  assert.equal(state.totals.sourcePassed, 15);
  assert.equal(state.versions.filter((version) => version.executionStatus === "planned").length, 0);
  assert.ok(state.totals.localPassed >= 4);
  assert.equal(state.externalStatus, "hold");
  assert.equal(state.productionStatus, "blocked");
  const promotion = state.versions.find((version) => version.version === "v4.3.4");
  assert.ok(promotion);
  if (state.totals.localPassed < 15) assert.equal(promotion.localStatus, "hold");
});

test("cancelled rejection retains its review history and is persistable", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({ plan, now, queue: queueInput(plan.version, plan.sourceMilestones[0]!) });
  const rejected = reviewEvidenceCollectionJob({
    job: { ...job, status: "review", submission: { receipt: {}, receiptDigest: "a".repeat(64), validationDigest: "b".repeat(64), workerId: "worker-alpha", submittedAt: now.toISOString() } },
    reviewerId: "reviewer-002", decision: "rejected", reason: "Incorrect workload selection.", expectedRevision: 1, now,
  });
  const cancelled = cancelEvidenceCollectionJob({ job: rejected, actorId: job.operatorId, reason: "Withdraw the rejected collection.", expectedRevision: rejected.revision, now });
  assert.equal(cancelled.review?.decision, "rejected");
  assert.equal(validateEvidenceCollectionStore(insertEvidenceCollectionJob(emptyEvidenceCollectionStore(), cancelled).store), true);
});

test("full queue rejects new work without evicting active jobs or idempotency keys", () => {
  const plan = readEvidenceCollectorPlans()[0]!;
  const job = createEvidenceCollectionJob({ plan, now, queue: queueInput(plan.version, plan.sourceMilestones[0]!) });
  let store = emptyEvidenceCollectionStore();
  for (let i = 0; i < 500; i++) store = insertEvidenceCollectionJob(store, { ...job, id: `job-${i}`, idempotencyKey: `request-${i}` }).store;
  assert.throws(() => insertEvidenceCollectionJob(store, job), (error) => error instanceof EvidenceCollectionPolicyError && error.code === "capacity-exceeded");
  assert.equal(store.jobs.length, 500);
  assert.equal(store.idempotency["request-0"], "job-0");
  assert.equal(insertEvidenceCollectionJob(store, store.jobs[0]!).deduplicated, true);
});

test("API schema rejects coercion, arrays, unknown fields and invalid lease bounds", () => {
  const valid = { action: "claim", jobId: "job-001", workerId: "worker-alpha", expectedRevision: 1, ttlMs: 5_000 };
  assert.equal(evidenceCollectionRequestSchema.safeParse(valid).success, true);
  for (const invalid of [null, [], { ...valid, expectedRevision: "1" }, { ...valid, ttlMs: -1 }, { ...valid, organizationOverride: "other-org" }, { ...valid, workerId: {} }]) {
    assert.equal(evidenceCollectionRequestSchema.safeParse(invalid).success, false);
  }
});

test("durable collection executes HTTP discovery, recovers retries and persists review links in isolation", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "evidence-collection-integration-"));
  try {
    const child = spawnSync(path.join(process.cwd(), "node_modules/.bin/tsx"), ["tests/fixtures/evidence-collection-lifecycle.mts"], {
      cwd: process.cwd(), env: { ...process.env, LOCAL_AGENT_DATA_DIR: directory }, encoding: "utf8", timeout: 90_000,
    });
    assert.equal(child.status, 0, `${child.error || ""}\n${child.stdout}\n${child.stderr}`);
    assert.match(child.stdout, /durable collection integration passed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("promotion bundle never grants external or production authority", () => {
  const bundle = buildEvidenceCollectionPromotionBundle();
  assert.match(bundle.evidenceDigest, /^[a-f0-9]{64}$/u);
  assert.equal(bundle.externalStatus, "hold");
  assert.equal(bundle.productionStatus, "blocked");
});

test("UI accepts the live read model and rejects missing nested arrays before rendering", () => {
  const state = buildEvidenceCollectionTrainState([]);
  const payload = { ...state, queue: { jobs: [] }, promotionBundle: buildEvidenceCollectionPromotionBundle([], state) };
  assert.equal(collectionViewSchema.safeParse(payload).success, true);
  assert.equal(collectionViewSchema.safeParse({ ...payload, queue: {} }).success, false);
  assert.equal(collectionViewSchema.safeParse({ ...payload, versions: [{ ...state.versions[0], blockers: undefined }] }).success, false);
});
