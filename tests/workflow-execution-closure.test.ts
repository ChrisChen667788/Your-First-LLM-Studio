import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-workflow-execution-closure-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("v1.6.7 executes the mixed graph and preserves the protected-write boundary", async () => {
  const acceptance = await import(
    "@/features/workflows/execution-closure-acceptance"
  );
  const receipt = await acceptance.runWorkflowExecutionClosureAcceptance();

  assert.equal(receipt.localStatus, "pass");
  assert.equal(receipt.productionStatus, "hold");
  assert.deepEqual(receipt.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(new Set(receipt.slices.map((slice) => slice.id)).size, 15);
  assert.equal(
    receipt.slices.find((slice) => slice.id === "retrieval-executed")?.status,
    "pass",
  );
  assert.equal(
    receipt.slices.find((slice) => slice.id === "read-tool-executed")?.status,
    "pass",
  );
  assert.equal(
    receipt.slices.find((slice) => slice.id === "protected-write-blocked")
      ?.status,
    "pass",
  );
  assert.match(receipt.evidenceDigest, /^[a-f0-9]{64}$/u);
});

test("typed node outputs reject malformed payloads", async () => {
  const contract = await import(
    "@/features/workflows/node-execution-contract"
  );
  const encoded = contract.encodeWorkflowNodeOutput({
    nodeId: "retrieve",
    kind: "retrieval",
    ok: true,
    summary: "one hit",
    data: { hitCount: 1 },
  });

  assert.equal(contract.parseWorkflowNodeOutput(encoded)?.data.hitCount, 1);
  assert.equal(contract.parseWorkflowNodeOutput('{"schemaVersion":"wrong"}'), null);
  assert.equal(contract.parseWorkflowNodeOutput("plain text"), null);
});
