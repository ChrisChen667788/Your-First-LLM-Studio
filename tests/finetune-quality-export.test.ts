import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { evaluateFineTunePairedQuality } from "@/features/finetune/paired-quality-contract";
import { buildFineTuneAdapterPackage } from "@/lib/finetune/export-package-service";

const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-v169-test-"));

after(() => {
  rmSync(root, { recursive: true, force: true });
});

test("paired quality freezes identity and reports a multi-seed confidence decision", () => {
  const observations = [101, 202, 303].flatMap((seed) =>
    ["a", "b", "c", "d"].map((sampleId, index) => ({
      sampleId,
      seed,
      baselineScore: 40 + index,
      adapterScore: 50 + index,
    })),
  );
  const result = evaluateFineTunePairedQuality({
    datasetId: "ifeval-fixture",
    datasetRevision: "revision-1",
    promptSetSha256: "a".repeat(64),
    baseModelId: "base-model",
    baseModelRevision: "base-revision",
    adapterId: "adapter-1",
    checkpointSha256: "b".repeat(64),
    evaluatorId: "ifeval-deterministic",
    evaluatorVersion: "1",
    seeds: [101, 202, 303],
    observations,
  });

  assert.equal(result.coverage.observations, 12);
  assert.equal(result.coverage.seeds, 3);
  assert.equal(result.decision, "promote");
  assert.ok(result.statistics.confidenceInterval95.lower > 0);
  assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/u);
});

test("adapter package copies selected bytes and verifies install read-back and rollback", () => {
  const outputDir = path.join(root, "adapter-output");
  const destinationDir = path.join(root, "exports");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(destinationDir, { recursive: true });
  const finalWeights = path.join(outputDir, "adapters.safetensors");
  const bestWeights = path.join(outputDir, "0000100_adapters.safetensors");
  writeFileSync(finalWeights, Buffer.alloc(4096, 1));
  writeFileSync(bestWeights, Buffer.alloc(4096, 7));
  writeFileSync(
    path.join(outputDir, "adapter_config.json"),
    `${JSON.stringify({ lora_rank: 16 })}\n`,
    "utf8",
  );

  const receipt = buildFineTuneAdapterPackage({
    adapterName: "v1.6.9 fixture",
    baseTargetId: "base-model",
    outputDir,
    bestCheckpointPath: bestWeights,
    destinationDir,
  });
  const weights = receipt.files.find((file) => file.role === "weights");

  assert.equal(receipt.source.selection, "best");
  assert.equal(receipt.source.selectedCheckpointFile, realpathSync(bestWeights));
  assert.equal(weights?.bytes, 4096);
  assert.deepEqual(
    readFileSync(path.join(receipt.packageDir, "adapter/adapters.safetensors")),
    readFileSync(bestWeights),
  );
  assert.equal(receipt.readBack.verified, true);
  assert.equal(receipt.readBack.rollbackVerified, true);
  assert.equal(receipt.secretScan.status, "passed");
  assert.match(receipt.archiveSha256, /^[a-f0-9]{64}$/u);
});
