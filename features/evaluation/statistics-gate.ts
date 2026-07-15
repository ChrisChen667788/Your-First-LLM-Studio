import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const EVALUATION_STATISTICS_SCHEMA_VERSION = "evaluation.statistics-gate.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REPORT_FILE = path.join(DATA_DIR, "evaluation-statistics-reports.json");

type StatisticsReport = {
  id: string; generatedAt: string; status: "pass" | "hold" | "invalid"; samples: number;
  baselineMean: number; candidateMean: number; pairedDelta: number; confidence95: { lower: number; upper: number };
  effectSize: number; threshold: number; blockers: string[];
};

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function sampleDeviation(values: number[]) { if (values.length < 2) return 0; const average = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)); }
function readReports(): StatisticsReport[] { if (!existsSync(REPORT_FILE)) return []; try { const parsed = JSON.parse(readFileSync(REPORT_FILE, "utf8")) as { reports?: StatisticsReport[] }; return Array.isArray(parsed.reports) ? parsed.reports : []; } catch { return []; } }
function persist(report: StatisticsReport) { mkdirSync(path.dirname(REPORT_FILE), { recursive: true }); writeFileSync(REPORT_FILE, `${JSON.stringify({ schemaVersion: EVALUATION_STATISTICS_SCHEMA_VERSION, reports: [report, ...readReports()].slice(0, 200) }, null, 2)}\n`, "utf8"); }

export function analyzePairedEvaluation(input: { baseline?: number[]; candidate?: number[]; minimumDelta?: number; minimumSamples?: number }) {
  const baseline = (input.baseline || []).filter(Number.isFinite); const candidate = (input.candidate || []).filter(Number.isFinite);
  const threshold = Number.isFinite(input.minimumDelta) ? input.minimumDelta as number : 0;
  const minimumSamples = Math.max(2, input.minimumSamples || 30);
  const blockers: string[] = [];
  if (baseline.length !== candidate.length) blockers.push("Baseline and candidate must contain the same number of paired samples.");
  if (baseline.length < minimumSamples) blockers.push(`At least ${minimumSamples} paired samples are required.`);
  const size = Math.min(baseline.length, candidate.length);
  const differences = Array.from({ length: size }, (_, index) => candidate[index] - baseline[index]);
  const pairedDelta = mean(differences); const deviation = sampleDeviation(differences); const standardError = size ? deviation / Math.sqrt(size) : 0;
  const lower = pairedDelta - 1.96 * standardError; const upper = pairedDelta + 1.96 * standardError;
  if (size && lower < threshold) blockers.push(`The 95% lower confidence bound ${lower.toFixed(4)} is below the required delta ${threshold.toFixed(4)}.`);
  const report: StatisticsReport = {
    id: `evaluation-${randomUUID()}`, generatedAt: new Date().toISOString(),
    status: blockers.some((blocker) => blocker.includes("same number")) ? "invalid" : blockers.length ? "hold" : "pass",
    samples: size, baselineMean: mean(baseline.slice(0, size)), candidateMean: mean(candidate.slice(0, size)), pairedDelta,
    confidence95: { lower, upper }, effectSize: deviation > 0 ? pairedDelta / deviation : pairedDelta === 0 ? 0 : Math.sign(pairedDelta) * 999,
    threshold, blockers,
  };
  persist(report); return report;
}

export function readEvaluationStatisticsEvidence() {
  const reports = readReports();
  return { ok: true as const, schemaVersion: EVALUATION_STATISTICS_SCHEMA_VERSION, generatedAt: new Date().toISOString(), methods: ["paired-delta", "normal-approximation-95ci", "standardized-effect-size", "minimum-sample-gate"], reports, latestPassing: reports.find((report) => report.status === "pass") || null, path: REPORT_FILE };
}
