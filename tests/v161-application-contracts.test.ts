import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-v161-application-contracts-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("v1.6.1 acceptance guards fifteen canonical application boundaries", async () => {
  const acceptance = await import(
    "@/features/experiments/v161-application-contracts"
  );
  const receipt = acceptance.runV161ApplicationContractsAcceptance();
  assert.equal(receipt.localStatus, "pass");
  assert.equal(receipt.productionStatus, "hold");
  assert.deepEqual(receipt.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(new Set(receipt.slices.map((slice) => slice.id)).size, 15);
  assert.match(receipt.evidenceDigest, /^[a-f0-9]{64}$/u);
});
