import {
  formatBenchmarkMetric,
  hasSuccessfulBenchmarkMetrics,
} from "./analysis-formatters";

type BenchmarkHistoryResult = {
  targetId: string;
  targetLabel: string;
  execution?: "local" | "remote";
  resolvedModel: string;
  providerProfile?: string;
  thinkingMode?: string;
  avgFirstTokenLatencyMs: number;
  avgLatencyMs: number;
  avgTokenThroughputTps: number;
  avgScore?: number | null;
  passRate?: number | null;
  okRuns: number;
  skippedRuns?: number;
  skipSummary?: string | null;
  runs: number;
  samples: Array<{ ok: boolean }>;
};

function buildExecutionGroups(
  results: BenchmarkHistoryResult[],
  labels: { local: string; remote: string },
) {
  const local = results.filter((result) => result.execution === "local");
  const remote = results.filter((result) => result.execution !== "local");
  return [
    ...(local.length
      ? [{ execution: "local" as const, label: labels.local, rows: local }]
      : []),
    ...(remote.length
      ? [{ execution: "remote" as const, label: labels.remote, rows: remote }]
      : []),
  ];
}

export function AdminBenchmarkResultGroups({
  entryId,
  results,
  fallbackProviderProfile,
  fallbackThinkingMode,
  labels,
}: {
  entryId: string;
  results: BenchmarkHistoryResult[];
  fallbackProviderProfile?: string;
  fallbackThinkingMode?: string;
  labels: {
    local: string;
    remote: string;
    model: string;
    firstTokenLatency: string;
    totalLatency: string;
    tokenThroughput: string;
    tokensPerSecond: string;
    score: string;
    passRate: string;
  };
}) {
  return buildExecutionGroups(results, labels).map((group) => (
    <section key={`${entryId}:${group.execution}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
          {group.label}
        </p>
        <span className="text-[11px] text-slate-500">
          {group.rows.length} results
        </span>
      </div>
      {group.rows.map((result) => {
        const hasMetrics = hasSuccessfulBenchmarkMetrics(result);
        return (
          <div
            key={`${entryId}:${result.targetId}:${result.providerProfile || fallbackProviderProfile || "default"}:${result.thinkingMode || fallbackThinkingMode || "standard"}`}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-100">
                  {result.targetLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {result.okRuns}/{result.runs}
                  </span>
                  {result.skippedRuns ? (
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">
                      skipped {result.skippedRuns}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {result.providerProfile || fallbackProviderProfile || "default"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    {result.thinkingMode || fallbackThinkingMode || "standard"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{labels.model}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-slate-200">
                    {result.resolvedModel}
                  </span>
                </div>
                {result.skipSummary ? (
                  <p className="mt-2 max-w-2xl rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    {result.skipSummary}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-2 xl:min-w-[420px] xl:grid-cols-5">
                <Metric label={labels.firstTokenLatency} value={formatBenchmarkMetric(result.avgFirstTokenLatencyMs, hasMetrics, 1, " ms")} />
                <Metric label={labels.totalLatency} value={formatBenchmarkMetric(result.avgLatencyMs, hasMetrics, 1, " ms")} />
                <Metric label={labels.tokenThroughput} value={formatBenchmarkMetric(result.avgTokenThroughputTps, hasMetrics, 2, ` ${labels.tokensPerSecond}`)} />
                <Metric label={labels.score} value={typeof result.avgScore === "number" ? result.avgScore.toFixed(2) : "--"} />
                <Metric label={labels.passRate} value={typeof result.passRate === "number" ? `${result.passRate.toFixed(2)}%` : "--"} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  ));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}
