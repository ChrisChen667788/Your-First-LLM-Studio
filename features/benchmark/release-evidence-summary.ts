import {
  BENCHMARK_RELEASE_EVIDENCE_SUMMARY_VERSION,
  type BenchmarkReleaseEvidenceGroup,
  type BenchmarkReleaseEvidenceSummary,
  type BenchmarkReleaseEvidenceSummaryEntry,
  type BenchmarkReleaseEvidenceSummaryTotals,
} from "@/features/benchmark/contracts";
import { readBenchmarkReleaseEvidence } from "@/lib/agent/benchmark-release-evidence-store";
import { readBenchmarkLogs, type StoredBenchmarkLog } from "@/lib/agent/log-store";
import type { AgentBenchmarkResult } from "@/lib/agent/types";

type EvidenceRunStats = {
  resultCount: number;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRatePct: number;
  scoredResultCount: number;
  averagePassRatePct: number | null;
  averageScore: number | null;
  avgFirstTokenLatencyMs: number;
  avgLatencyMs: number;
  avgTokenThroughputTps: number;
};

type GroupAccumulator = {
  key: string;
  label: string;
  mode: string;
  evidenceIds: Set<string>;
  runIds: Set<string>;
  resultCount: number;
  totalRuns: number;
  okRuns: number;
  failedRuns: number;
  skippedRuns: number;
  scoredResultCount: number;
  passRates: number[];
  scores: number[];
  firstTokenLatencies: number[];
  totalLatencies: number[];
  throughputs: number[];
  latestRunId?: string;
  latestGeneratedAt?: string;
  targetLabels: Set<string>;
  notes: Set<string>;
};

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function nullableAverage(values: number[]) {
  if (!values.length) return null;
  return average(values);
}

function successRate(okRuns: number, totalRuns: number) {
  if (totalRuns <= 0) return 0;
  return round((okRuns / totalRuns) * 100);
}

function calculateResultStats(results: AgentBenchmarkResult[]): EvidenceRunStats {
  const totalRuns = results.reduce((sum, result) => sum + result.runs, 0);
  const okRuns = results.reduce((sum, result) => sum + result.okRuns, 0);
  const skippedRuns = results.reduce((sum, result) => sum + (result.skippedRuns || 0), 0);
  const failedRuns = results.reduce(
    (sum, result) => sum + Math.max(0, result.runs - result.okRuns - (result.skippedRuns || 0)),
    0,
  );
  const passRates = results
    .map((result) => result.passRate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const scores = results
    .map((result) => result.avgScore)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    resultCount: results.length,
    totalRuns,
    okRuns,
    failedRuns,
    skippedRuns,
    successRatePct: successRate(okRuns, totalRuns),
    scoredResultCount: scores.length,
    averagePassRatePct: nullableAverage(passRates),
    averageScore: nullableAverage(scores),
    avgFirstTokenLatencyMs: average(results.map((result) => result.avgFirstTokenLatencyMs)),
    avgLatencyMs: average(results.map((result) => result.avgLatencyMs)),
    avgTokenThroughputTps: average(results.map((result) => result.avgTokenThroughputTps)),
  };
}

function evidenceLabel(log: StoredBenchmarkLog | null, fallbackTitle?: string) {
  return (
    fallbackTitle ||
    log?.suiteLabel ||
    log?.datasetLabel ||
    log?.promptSetLabel ||
    log?.prompt ||
    log?.runId ||
    "Benchmark evidence"
  );
}

function groupKeyForLog(log: StoredBenchmarkLog) {
  const mode = log.benchmarkMode || "prompt";
  if (log.suiteId) return `${mode}:suite:${log.suiteId}:${log.profileBatchScope || "all"}`;
  if (log.datasetId) return `${mode}:dataset:${log.datasetId}:${log.datasetSampleCount || "all"}`;
  if (log.promptSetId) return `${mode}:prompt-set:${log.promptSetId}`;
  return `${mode}:prompt:${log.prompt.slice(0, 96)}`;
}

function groupLabelForLog(log: StoredBenchmarkLog) {
  return log.suiteLabel || log.datasetLabel || log.promptSetLabel || log.prompt || "Benchmark evidence";
}

function ensureGroup(groups: Map<string, GroupAccumulator>, log: StoredBenchmarkLog) {
  const key = groupKeyForLog(log);
  const existing = groups.get(key);
  if (existing) return existing;
  const group: GroupAccumulator = {
    key,
    label: groupLabelForLog(log),
    mode: log.benchmarkMode || "prompt",
    evidenceIds: new Set(),
    runIds: new Set(),
    resultCount: 0,
    totalRuns: 0,
    okRuns: 0,
    failedRuns: 0,
    skippedRuns: 0,
    scoredResultCount: 0,
    passRates: [],
    scores: [],
    firstTokenLatencies: [],
    totalLatencies: [],
    throughputs: [],
    targetLabels: new Set(),
    notes: new Set(),
  };
  groups.set(key, group);
  return group;
}

function materializeGroup(group: GroupAccumulator): BenchmarkReleaseEvidenceGroup {
  return {
    key: group.key,
    label: group.label,
    mode: group.mode,
    evidenceCount: group.evidenceIds.size,
    runCount: group.runIds.size,
    resultCount: group.resultCount,
    totalRuns: group.totalRuns,
    okRuns: group.okRuns,
    failedRuns: group.failedRuns,
    skippedRuns: group.skippedRuns,
    successRatePct: successRate(group.okRuns, group.totalRuns),
    averagePassRatePct: nullableAverage(group.passRates),
    averageScore: nullableAverage(group.scores),
    avgFirstTokenLatencyMs: average(group.firstTokenLatencies),
    avgLatencyMs: average(group.totalLatencies),
    avgTokenThroughputTps: average(group.throughputs),
    latestRunId: group.latestRunId,
    latestGeneratedAt: group.latestGeneratedAt,
    targetLabels: Array.from(group.targetLabels).sort().slice(0, 8),
    notes: Array.from(group.notes).slice(0, 4),
  };
}

function buildReleaseNoteDraft(
  totals: BenchmarkReleaseEvidenceSummaryTotals,
  groups: BenchmarkReleaseEvidenceGroup[],
) {
  if (!totals.evidenceCount) {
    return ["No pinned benchmark release evidence yet."];
  }
  const lines = [
    `Pinned ${totals.evidenceCount} benchmark evidence item(s), ${totals.matchedRunCount} matched to stored runs.`,
    `Aggregated ${totals.resultCount} result group(s) across ${totals.targetCount} target(s): ${totals.okRuns}/${totals.totalRuns} successful samples (${totals.successRatePct}%).`,
  ];
  if (totals.skippedRuns > 0 || totals.failedRuns > 0) {
    lines.push(`Review required: ${totals.failedRuns} failed sample(s), ${totals.skippedRuns} skipped sample(s).`);
  }
  for (const group of groups.slice(0, 4)) {
    lines.push(
      `${group.label}: ${group.okRuns}/${group.totalRuns} successful, ${group.successRatePct}% success, ${group.avgLatencyMs} ms avg total latency.`,
    );
  }
  if (totals.missingRunCount > 0) {
    lines.push(`${totals.missingRunCount} pinned evidence item(s) reference runs that are no longer present in benchmark history.`);
  }
  return lines;
}

export function buildBenchmarkReleaseEvidenceSummary(options?: {
  evidence?: ReturnType<typeof readBenchmarkReleaseEvidence>;
  logs?: StoredBenchmarkLog[];
}): BenchmarkReleaseEvidenceSummary {
  const generatedAt = new Date().toISOString();
  const evidence = options?.evidence || readBenchmarkReleaseEvidence();
  const logs = options?.logs || readBenchmarkLogs({ limit: 1000 });
  const logsByRunId = new Map(logs.flatMap((log) => (log.runId ? [[log.runId, log] as const] : [])));
  const groups = new Map<string, GroupAccumulator>();
  const entries: BenchmarkReleaseEvidenceSummaryEntry[] = [];

  for (const item of evidence) {
    const log = logsByRunId.get(item.runId) || null;
    if (!log) {
      entries.push({
        id: item.id,
        runId: item.runId,
        label: item.title || item.runId,
        pinnedAt: item.pinnedAt,
        status: "missing-run",
        note: item.note,
        matchSource: "missing-run",
        resultCount: 0,
        totalRuns: 0,
        okRuns: 0,
        failedRuns: 0,
        skippedRuns: 0,
        successRatePct: 0,
      });
      continue;
    }

    const stats = calculateResultStats(log.results);
    const group = ensureGroup(groups, log);
    group.evidenceIds.add(item.id);
    if (log.runId) group.runIds.add(log.runId);
    group.resultCount += stats.resultCount;
    group.totalRuns += stats.totalRuns;
    group.okRuns += stats.okRuns;
    group.failedRuns += stats.failedRuns;
    group.skippedRuns += stats.skippedRuns;
    group.scoredResultCount += stats.scoredResultCount;
    if (typeof stats.averagePassRatePct === "number") group.passRates.push(stats.averagePassRatePct);
    if (typeof stats.averageScore === "number") group.scores.push(stats.averageScore);
    group.firstTokenLatencies.push(stats.avgFirstTokenLatencyMs);
    group.totalLatencies.push(stats.avgLatencyMs);
    group.throughputs.push(stats.avgTokenThroughputTps);
    if (!group.latestGeneratedAt || log.generatedAt.localeCompare(group.latestGeneratedAt) > 0) {
      group.latestGeneratedAt = log.generatedAt;
      group.latestRunId = log.runId;
    }
    for (const result of log.results) {
      group.targetLabels.add(result.targetLabel);
      if (result.skipSummary) group.notes.add(result.skipSummary);
    }
    if (item.note) group.notes.add(item.note);

    entries.push({
      id: item.id,
      runId: item.runId,
      label: evidenceLabel(log, item.title),
      pinnedAt: item.pinnedAt,
      generatedAt: log.generatedAt,
      status: "matched",
      groupKey: group.key,
      note: item.note,
      matchSource: "exact-run-id",
      ...stats,
    });
  }

  const materializedGroups = Array.from(groups.values())
    .map(materializeGroup)
    .sort((left, right) => {
      const generatedCompare = (right.latestGeneratedAt || "").localeCompare(left.latestGeneratedAt || "");
      if (generatedCompare !== 0) return generatedCompare;
      return right.totalRuns - left.totalRuns;
    });

  const targetLabels = new Set(materializedGroups.flatMap((group) => group.targetLabels));
  const totalRuns = entries.reduce((sum, entry) => sum + entry.totalRuns, 0);
  const okRuns = entries.reduce((sum, entry) => sum + entry.okRuns, 0);
  const totals: BenchmarkReleaseEvidenceSummaryTotals = {
    evidenceCount: evidence.length,
    matchedRunCount: entries.filter((entry) => entry.status === "matched").length,
    missingRunCount: entries.filter((entry) => entry.status === "missing-run").length,
    groupCount: materializedGroups.length,
    targetCount: targetLabels.size,
    resultCount: entries.reduce((sum, entry) => sum + entry.resultCount, 0),
    totalRuns,
    okRuns,
    failedRuns: entries.reduce((sum, entry) => sum + entry.failedRuns, 0),
    skippedRuns: entries.reduce((sum, entry) => sum + entry.skippedRuns, 0),
    successRatePct: successRate(okRuns, totalRuns),
    scoredResultCount: materializedGroups.reduce((sum, group) => sum + (group.averageScore === null ? 0 : 1), 0),
    averagePassRatePct: nullableAverage(
      materializedGroups
        .map((group) => group.averagePassRatePct)
        .filter((value): value is number => typeof value === "number"),
    ),
    averageScore: nullableAverage(
      materializedGroups
        .map((group) => group.averageScore)
        .filter((value): value is number => typeof value === "number"),
    ),
  };

  return {
    schemaVersion: BENCHMARK_RELEASE_EVIDENCE_SUMMARY_VERSION,
    generatedAt,
    totals,
    groups: materializedGroups,
    entries,
    releaseNoteDraft: buildReleaseNoteDraft(totals, materializedGroups),
  };
}
