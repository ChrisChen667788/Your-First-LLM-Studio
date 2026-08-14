import { createHash, randomUUID } from "node:crypto";

import { evaluateMathEquivalence } from "@/features/benchmark/math-evaluator-port";
import { findMath500Run } from "@/features/benchmark/math500-run-analysis";
import {
  MATH500_REPLAY_STORE_SCHEMA_VERSION,
  type Math500ReplayReceipt,
} from "@/features/benchmark/reproducibility-contracts";
import { readQualifiedMath500Rows } from "@/features/benchmark/qualification-service";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const RECEIPT_PATH = getLocalAgentDataPath(
  "benchmark-replays",
  "math500-evaluator-replays.json",
);

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function readMath500ReplayReceipts() {
  return readDurableReceipts<Math500ReplayReceipt>(
    RECEIPT_PATH,
    MATH500_REPLAY_STORE_SCHEMA_VERSION,
  );
}

export async function runMath500EvaluatorReplay(runId?: string) {
  const log = findMath500Run(runId);
  const rows = readQualifiedMath500Rows();
  const result = log?.results[0];
  if (!log || !rows || !result) {
    throw new Error("A qualified MATH-500 run and snapshot are required for replay.");
  }
  const samples = result.samples || [];
  const rowById = new Map(rows.map((row) => [row.unique_id, row]));
  const startedAt = Date.now();
  const decisions: Array<{
    itemId: string;
    original: boolean | null;
    replay: boolean | null;
    status: string;
  }> = [];
  const batchSize = 16;
  for (let offset = 0; offset < samples.length; offset += batchSize) {
    const batch = samples.slice(offset, offset + batchSize);
    const results = await Promise.all(
      batch.map(async (sample) => {
        const itemId = sample.itemId || "";
        const row = rowById.get(itemId);
        if (!row || !sample.outputText) {
          return {
            itemId,
            original: typeof sample.passed === "boolean" ? sample.passed : null,
            replay: null,
            status: "unavailable",
          };
        }
        const replay = await evaluateMathEquivalence(row.answer, sample.outputText);
        return {
          itemId,
          original: typeof sample.passed === "boolean" ? sample.passed : null,
          replay: typeof replay.passed === "boolean" ? replay.passed : null,
          status: replay.evaluation?.status || "unavailable",
        };
      }),
    );
    decisions.push(...results);
  }
  const replayed = decisions.filter((entry) => entry.replay !== null);
  const agreements = replayed.filter((entry) => entry.original === entry.replay);
  const disagreements = replayed.filter((entry) => entry.original !== entry.replay);
  const unavailable = decisions.filter((entry) => entry.replay === null);
  const localStatus =
    decisions.length === 500 &&
    replayed.length === 500 &&
    agreements.length === 500
      ? ("pass" as const)
      : ("hold" as const);
  const receipt: Math500ReplayReceipt = {
    id: `math500-replay-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    runId: log.runId || log.id,
    executionMode: "isolated-python-worker-replay",
    evaluatorId: "huggingface-math-verify",
    evaluatorVersion: "0.9.0",
    evaluatorConfigId: "math-500-v1",
    requestedSamples: decisions.length,
    replayedSamples: replayed.length,
    agreementSamples: agreements.length,
    disagreementSamples: disagreements.length,
    unavailableSamples: unavailable.length,
    agreementRate: replayed.length
      ? Number(((agreements.length / replayed.length) * 100).toFixed(2))
      : null,
    disagreementItemIds: disagreements.slice(0, 20).map((entry) => entry.itemId),
    decisionDigest: digest(decisions),
    durationMs: Date.now() - startedAt,
    localStatus,
    independentHost: false,
    disclosure:
      "Predictions were replayed through a fresh isolated Python evaluator worker on the same host. This detects scorer drift but is not an independent-machine reproduction.",
  };
  prependDurableReceipt(
    RECEIPT_PATH,
    MATH500_REPLAY_STORE_SCHEMA_VERSION,
    receipt,
    20,
  );
  return receipt;
}

export function readLatestMath500Replay(runId?: string) {
  return (
    readMath500ReplayReceipts().find(
      (receipt) => !runId || receipt.runId === runId,
    ) || null
  );
}
