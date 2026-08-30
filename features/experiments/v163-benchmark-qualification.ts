import { createHash, randomUUID } from "node:crypto";

import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import type {
  BenchmarkQualificationCheckId,
  BenchmarkQualificationReceipt,
  Math500SnapshotManifest,
} from "@/features/benchmark/qualification-contracts";
import {
  qualifyMath500Snapshot,
  readBenchmarkQualification,
  reverifyMath500Snapshot,
} from "@/features/benchmark/qualification-service";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const V163_BENCHMARK_QUALIFICATION_SCHEMA_VERSION =
  "experiments.v163-benchmark-qualification.v1" as const;

export type V163BenchmarkQualificationSlice = {
  id: BenchmarkQualificationCheckId;
  version: "v1.6.3";
  label: string;
  status: "pass" | "hold";
  summary: string;
};

export type V163BenchmarkQualificationReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  slices: V163BenchmarkQualificationSlice[];
  totals: { slices: 15; passed: number; held: number };
  manifest: Math500SnapshotManifest;
  benchmarkQualificationReceiptId: string;
  evidenceDigest: string;
  productionBlockers: string[];
};

const STORE_FILE = getLocalAgentDataPath(
  "v1.6.3-benchmark-qualification.json",
);

export async function runV163BenchmarkQualificationAcceptance() {
  const current = readBenchmarkQualification();
  const qualification = current.latest
    ? reverifyMath500Snapshot()
    : await qualifyMath500Snapshot();
  const receipt = buildV163BenchmarkQualificationReceipt(qualification);
  prependDurableReceipt(
    STORE_FILE,
    V163_BENCHMARK_QUALIFICATION_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function buildV163BenchmarkQualificationReceipt(
  qualification: BenchmarkQualificationReceipt,
) {
  const slices = qualification.checks.map((entry) => ({
    ...entry,
    version: "v1.6.3" as const,
  }));
  const passed = slices.filter((entry) => entry.status === "pass").length;
  const evidenceDigest = createHash("sha256")
    .update(
      JSON.stringify({
        benchmarkQualificationReceiptId: qualification.id,
        manifestDigest: qualification.evidenceDigest,
        slices: slices.map(({ id, status }) => ({ id, status })),
      }),
    )
    .digest("hex");
  return {
    id: `v163-benchmark-qualification-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: passed === 15 ? "pass" : "hold",
    localStatus: passed === 15 ? "pass" : "hold",
    productionStatus: "hold",
    slices,
    totals: { slices: 15, passed, held: 15 - passed },
    manifest: qualification.manifest,
    benchmarkQualificationReceiptId: qualification.id,
    evidenceDigest,
    productionBlockers: qualification.productionBlockers,
  } satisfies V163BenchmarkQualificationReceipt;
}

export function readV163BenchmarkQualificationEvidence() {
  const receipts = readDurableReceipts<V163BenchmarkQualificationReceipt>(
    STORE_FILE,
    V163_BENCHMARK_QUALIFICATION_SCHEMA_VERSION,
  );
  const latest = receipts[0] || null;
  const qualification = readBenchmarkQualification();
  const integrityValid = qualification.snapshotIntegrity === "verified";
  return {
    ok: true as const,
    schemaVersion: V163_BENCHMARK_QUALIFICATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localStatus:
      latest?.localStatus === "pass" && integrityValid
        ? ("pass" as const)
        : latest
          ? ("hold" as const)
          : ("evidence-needed" as const),
    productionStatus: "hold" as const,
    snapshotIntegrity: qualification.snapshotIntegrity,
    latest,
    latestPassing:
      receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    totals: latest?.totals || { slices: 15 as const, passed: 0, held: 15 },
    qualifiedDataset: qualification.qualifiedDataset,
    productionBlockers: latest
      ? [
          "This historical v1.6.3 receipt excludes evaluator output; the v1.6.4 evidence read model now reports pinned Math-Verify scoring and the completed 500-item run.",
          ...latest.productionBlockers.filter(
            (blocker) => !blocker.toLowerCase().includes("evaluator"),
          ),
        ]
      : ["v1.6.3 benchmark qualification acceptance has not been run."],
    path: STORE_FILE,
  };
}
