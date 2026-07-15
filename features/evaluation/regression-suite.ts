import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { analyzePairedEvaluation } from "@/features/evaluation/statistics-gate";

export const EVALUATION_REGRESSION_SUITE_SCHEMA_VERSION = "evaluation.regression-suite.v1" as const;
export type RegressionMetricInput = { id: string; label?: string; direction?: "higher-is-better" | "lower-is-better"; baseline: number[]; candidate: number[]; minimumImprovement?: number; minimumSamples?: number };
type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; metrics: Array<{ id: string; label: string; direction: "higher-is-better" | "lower-is-better"; status: string; samples: number; improvement: number; confidence95: { lower: number; upper: number }; blockers: string[] }>; blockers: string[] };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "evaluation-regression-suites.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: EVALUATION_REGRESSION_SUITE_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }

export function runEvaluationRegressionSuite(input: { metrics: RegressionMetricInput[] }) {
  if (!input.metrics.length) throw new Error("At least one regression metric is required.");
  const metrics = input.metrics.map((metric) => {
    const direction = metric.direction === "lower-is-better" ? "lower-is-better" as const : "higher-is-better" as const;
    const factor = direction === "lower-is-better" ? -1 : 1;
    const report = analyzePairedEvaluation({ baseline: metric.baseline.map((value) => value * factor), candidate: metric.candidate.map((value) => value * factor), minimumDelta: metric.minimumImprovement || 0, minimumSamples: metric.minimumSamples || 30 });
    return { id: metric.id, label: metric.label?.trim() || metric.id, direction, status: report.status, samples: report.samples, improvement: report.pairedDelta, confidence95: report.confidence95, blockers: report.blockers };
  });
  const blockers = metrics.flatMap((metric) => metric.status === "pass" ? [] : metric.blockers.map((blocker) => `${metric.id}: ${blocker}`));
  const receipt: Receipt = { id: `regression-suite-${randomUUID()}`, generatedAt: new Date().toISOString(), status: blockers.length ? "hold" : "pass", metrics, blockers };
  persist(receipt); return receipt;
}

export function readEvaluationRegressionSuiteEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: EVALUATION_REGRESSION_SUITE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((receipt) => receipt.status === "pass") || null, path: STORE_FILE }; }
