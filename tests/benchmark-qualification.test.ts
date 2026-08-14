import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const temporaryRoot = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-benchmark-qualification-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = temporaryRoot;

function fixtureRows() {
  const subjects = [
    "Algebra",
    "Counting & Probability",
    "Geometry",
    "Intermediate Algebra",
    "Number Theory",
    "Prealgebra",
    "Precalculus",
  ];
  return Array.from({ length: 500 }, (_, index) => ({
    problem: `Problem ${index + 1}`,
    solution: `Solution ${index + 1}`,
    answer: String(index + 1),
    subject: subjects[index % subjects.length],
    level: (index % 5) + 1,
    unique_id: `test/${subjects[index % subjects.length].toLowerCase()}/${index + 1}.json`,
  }));
}

test("MATH-500 qualification produces fifteen passing provenance checks", async () => {
  const service = await import("@/features/benchmark/qualification-service");
  const snapshotPath = path.join(temporaryRoot, "test.jsonl");
  const bytes = Buffer.from(
    `${fixtureRows().map((row) => JSON.stringify(row)).join("\n")}\n`,
  );
  writeFileSync(snapshotPath, bytes);
  const receipt = service.buildMath500QualificationReceipt({
    bytes,
    metadata: {
      sha: "6e4ed1a2a79af7d8630a6b768ec859cb5af4d3be",
      lastModified: "2025-12-15T11:01:40.000Z",
    },
    snapshotPath,
    downloadedAt: "2026-08-10T00:00:00.000Z",
    snapshotPersisted: true,
  });

  assert.equal(receipt.localStatus, "pass");
  assert.deepEqual(receipt.totals, { checks: 15, passed: 15, held: 0 });
  assert.equal(receipt.manifest.rowCount, 500);
  assert.equal(receipt.manifest.uniqueIdCount, 500);
  assert.equal(receipt.manifest.subjects.length, 7);
  assert.deepEqual(receipt.manifest.levels, [1, 2, 3, 4, 5]);
  assert.equal(receipt.manifest.officialScoreEligible, false);

  const acceptance = await import(
    "@/features/experiments/v163-benchmark-qualification"
  );
  const v163 = acceptance.buildV163BenchmarkQualificationReceipt(receipt);
  assert.equal(v163.localStatus, "pass");
  assert.deepEqual(v163.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(v163.productionStatus, "hold");
});

test("MATH-500 qualification holds malformed or incomplete snapshots", async () => {
  const service = await import("@/features/benchmark/qualification-service");
  const snapshotPath = path.join(temporaryRoot, "incomplete.jsonl");
  const bytes = Buffer.from(
    `${JSON.stringify({
      problem: "Incomplete",
      solution: "No answer field",
      subject: "Algebra",
      level: 1,
      unique_id: "test/algebra/1.json",
    })}\n`,
  );
  writeFileSync(snapshotPath, bytes);
  const receipt = service.buildMath500QualificationReceipt({
    bytes,
    metadata: { sha: "not-a-commit" },
    snapshotPath,
    snapshotPersisted: true,
  });

  assert.equal(receipt.localStatus, "hold");
  assert.ok(receipt.totals.held >= 5);
  assert.equal(
    receipt.checks.find((entry) => entry.id === "required-schema")?.status,
    "hold",
  );
  assert.equal(
    receipt.checks.find((entry) => entry.id === "immutable-revision")?.status,
    "hold",
  );
});
