import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-v15-acceptance-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;
delete process.env.FIRST_LLM_QUALITY_SOURCE_DATA_DIR;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("v1.5 acceptance covers fifteen trusted artifact and durable outbox slices", async () => {
  const quality = await import("@/features/evaluation/quality-artifact-binding");
  const outbox = await import("@/features/deployment/postgres-usage-outbox");
  const acceptance = await import("@/features/experiments/v15-acceptance-batch");
  const binding = quality.bindQualityCiToRealArtifacts();
  assert.equal(binding.status, "hold");
  outbox.savePostgresUsageOutboxReceipt({
    checks: {
      schemaCreated: true,
      idempotentEnqueue: true,
      exclusiveClaim: true,
      transientFailureRetained: true,
      retryClaimed: true,
      deliveryAcknowledged: true,
      tokenAccountingPreserved: true,
    },
    evidence: {
      eventId: "test-outbox-event",
      attempts: 2,
      totalTokens: 377,
      externalReceiptId: "test-billing-receipt",
      database: "postgresql",
    },
  });
  const receipt = acceptance.runV15AcceptanceBatch({
    releaseCandidate: {
      artifact: {
        id: "first-llm-studio.adapter.test",
        version: "1.5.1-test",
        registryRecordId: "artifact-registry-test",
        checkpointSha256: "a".repeat(64),
        packageSha256: "b".repeat(64),
      },
      workload: {
        baseTargetId: "local-base",
        adapterTargetId: "local-ft-test",
        benchmarkRunIds: ["run-1", "run-2", "run-3"],
        pairedSamples: 36,
        pairedBatches: 3,
      },
      evidence: {
        regressionReceiptId: "regression-test",
        bindingReceiptId: "binding-test",
        qualityClaimReceiptId: "quality-claim-test",
        usageReconciliationReceiptId: "usage-reconciliation-test",
        usageSettlementReceiptId: "usage-settlement-test",
        controlPlaneFailoverId: "failover-test",
        controlPlaneSigningReceiptId: "signing-test",
      },
      productionBlockers: ["Independent production evidence is required."],
    },
  });
  assert.equal(receipt.localStatus, "pass");
  assert.equal(receipt.productionStatus, "hold");
  assert.deepEqual(receipt.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(new Set(receipt.slices.map((slice) => slice.id)).size, 15);
  assert.equal(
    receipt.slices.find((slice) => slice.id === "release-candidate-quality")?.status,
    "pass",
  );
  assert.equal(
    receipt.productionBlockers.includes(
      "Cloud KMS/HSM, immutable archive, multi-region failover, and organization sign-off remain external gates.",
    ),
    false,
  );
  assert.match(receipt.evidenceDigest, /^[a-f0-9]{64}$/u);
});
