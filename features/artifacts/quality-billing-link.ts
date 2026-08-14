import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { readArtifactLocalRegistry } from "@/features/artifacts/local-registry";
import { readUsageReconciliationEvidence } from "@/features/deployment/usage-reconciliation";
import { readQualityArtifactBindingEvidence } from "@/features/evaluation/quality-artifact-binding";
import { readEvaluationRegressionSuiteEvidence } from "@/features/evaluation/regression-suite";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const ARTIFACT_QUALITY_BILLING_SCHEMA_VERSION =
  "artifacts.quality-billing-link.v2" as const;

type Receipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  artifactId: string;
  version: string;
  registryRecordId?: string;
  regressionReceiptId?: string;
  realArtifactBindingReceiptId?: string;
  usageReceiptId?: string;
  claimDigest?: string;
  metrics: Array<{ id: string; improvement: number; samples: number }>;
  billing: { sourceRequests: number; totalTokens: number; differenceTokens: number };
  provenance: {
    realArtifactBindingStatus: "pass" | "hold" | "missing";
    benchmarkRuns: number;
    pairedScoredSamples: number;
    pairedSeeds: number;
  };
  blockers: string[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "artifact-quality-billing-links-v2.json");

function readReceipts() {
  return readDurableReceipts<Receipt>(
    STORE_FILE,
    ARTIFACT_QUALITY_BILLING_SCHEMA_VERSION,
  );
}

export function createArtifactQualityBillingLink(input: {
  artifactId: string;
  version: string;
}) {
  const registry = readArtifactLocalRegistry().records.find(
    (entry) =>
      entry.artifactId === input.artifactId &&
      entry.version === input.version &&
      entry.roundTripVerified,
  );
  const regression = readEvaluationRegressionSuiteEvidence().latestPassing;
  const usage = readUsageReconciliationEvidence().latestPassing;
  const binding = readQualityArtifactBindingEvidence().latest;
  const blockers = [
    !registry ? "A round-trip verified registry package is required." : "",
    !regression ? "A passing multi-metric regression suite is required." : "",
    !usage ? "A passing usage reconciliation receipt is required." : "",
    usage && usage.differences.totalTokens !== 0
      ? "Usage reconciliation must have zero token difference."
      : "",
    !binding
      ? "A real Benchmark/Fine-tune artifact binding receipt is required."
      : binding.status !== "pass"
        ? "The real Benchmark/Fine-tune artifact binding is still HOLD."
        : "",
  ].filter(Boolean);
  const metrics = regression?.metrics.map((entry) => ({
    id: entry.id,
    improvement: entry.improvement,
    samples: entry.samples,
  })) || [];
  const billing = {
    sourceRequests: usage?.sourceRequests || 0,
    totalTokens: usage?.recorded.totalTokens || 0,
    differenceTokens: usage?.differences.totalTokens || 0,
  };
  const provenance = {
    realArtifactBindingStatus: binding?.status || "missing" as const,
    benchmarkRuns: binding?.inventory.benchmarkRuns || 0,
    pairedScoredSamples: binding?.inventory.pairedScoredSamples || 0,
    pairedSeeds: binding?.inventory.pairedSeeds || 0,
  };
  const claimPayload = registry && regression && usage && binding?.status === "pass"
    ? {
        artifactId: input.artifactId,
        version: input.version,
        registryRecordId: registry.id,
        regressionReceiptId: regression.id,
        realArtifactBindingReceiptId: binding.id,
        usageReceiptId: usage.id,
        metrics,
        billing,
        provenance,
      }
    : null;
  const receipt: Receipt = {
    id: `quality-billing-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    artifactId: input.artifactId,
    version: input.version,
    registryRecordId: registry?.id,
    regressionReceiptId: regression?.id,
    realArtifactBindingReceiptId: binding?.id,
    usageReceiptId: usage?.id,
    claimDigest: claimPayload
      ? createHash("sha256").update(JSON.stringify(claimPayload)).digest("hex")
      : undefined,
    metrics,
    billing,
    provenance,
    blockers,
  };
  prependDurableReceipt(
    STORE_FILE,
    ARTIFACT_QUALITY_BILLING_SCHEMA_VERSION,
    receipt,
    200,
  );
  return receipt;
}

export function readArtifactQualityBillingEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: ARTIFACT_QUALITY_BILLING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing: receipts.find((entry) => entry.status === "pass") || null,
    productionStatus: "hold" as const,
    path: STORE_FILE,
  };
}
