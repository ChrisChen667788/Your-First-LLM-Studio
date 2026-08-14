import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-finetune-execution-truth-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("v1.6.8 passes the 15-slice local execution truth gate", async () => {
  const acceptance = await import(
    "@/features/finetune/execution-truth-acceptance"
  );
  const receipt = await acceptance.runFineTuneExecutionTruthAcceptance();

  assert.equal(receipt.localStatus, "pass");
  assert.equal(receipt.productionStatus, "hold");
  assert.deepEqual(receipt.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(new Set(receipt.slices.map((slice) => slice.id)).size, 15);
  assert.equal(
    receipt.slices.find((slice) => slice.id === "packing-fail-closed")?.status,
    "pass",
  );
  assert.equal(
    receipt.slices.find((slice) => slice.id === "checkpoint-boundary")?.status,
    "pass",
  );
  assert.equal(
    receipt.slices.find((slice) => slice.id === "metric-registry-truth")?.status,
    "pass",
  );
  assert.match(receipt.evidenceDigest, /^[a-f0-9]{64}$/u);
});
