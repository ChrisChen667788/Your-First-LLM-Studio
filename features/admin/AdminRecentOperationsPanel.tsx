import type { AgentMetricPercentiles } from "@/lib/agent/types";
import { formatCompactNumber, PercentileRow } from "./telemetry-components";

type MetricBreakdown = {
  requests: number;
  totalTokens: number;
  avgLatencyMs: number;
  avgFirstTokenLatencyMs: number;
  avgTokenThroughputTps: number;
  latencyPercentiles: AgentMetricPercentiles;
  firstTokenLatencyPercentiles: AgentMetricPercentiles;
  tokenThroughputPercentiles: AgentMetricPercentiles;
};

type RecentOperationsData = {
  recentChats: Array<{
    id: string;
    completedAt: string;
    resolvedModel: string;
    contextWindow?: number;
    latencyMs: number;
    ok: boolean;
    usage: { totalTokens: number };
  }>;
  recentChecks: Array<{
    id: string;
    checkedAt: string;
    targetLabel: string;
    ok: boolean;
  }>;
  summary: {
    avgLatencyMs: number;
    avgFirstTokenLatencyMs: number;
    avgTokenThroughputTps: number;
    latencyPercentiles: AgentMetricPercentiles;
    firstTokenLatencyPercentiles: AgentMetricPercentiles;
    tokenThroughputPercentiles: AgentMetricPercentiles;
  };
  modelBreakdown: Array<MetricBreakdown & { model: string }>;
  contextWindowBreakdown: Array<MetricBreakdown & { contextWindow: number | null }>;
  paths: {
    chatLogFile: string;
    connectionCheckFile: string;
    telemetryFile: string;
    benchmarkFile: string;
    benchmarkBaselineFile?: string;
  };
};

type RecentOperationsLabels = {
  recentHistory: string;
  latest: string;
  model: string;
  contextWindow: string;
  defaultContextWindow: string;
  latencyMs: string;
  tokens: string;
  status: string;
  ok: string;
  failed: string;
  noData: string;
  firstTokenLatency: string;
  totalLatency: string;
  tokenThroughput: string;
  tokensPerSecond: string;
  percentiles: string;
  modelBreakdown: string;
  contextWindowBreakdown: string;
  recentChecks: string;
  savedFiles: string;
};

const EMPTY_PERCENTILES = { p50: 0, p95: 0, p99: 0 };

export function AdminRecentOperationsPanel({
  data,
  labels,
}: {
  data: RecentOperationsData | null;
  labels: RecentOperationsLabels;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-sm text-slate-300">{labels.recentHistory}</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                {[labels.latest, labels.model, labels.contextWindow, labels.latencyMs, labels.tokens, labels.status].map((label) => (
                  <th key={label} className="px-3 py-2">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.recentChats.length ? data.recentChats.map((row) => (
                <tr key={row.id} className="border-t border-white/10">
                  <td className="px-3 py-2 text-slate-300">{new Date(row.completedAt).toLocaleTimeString()}</td>
                  <td className="px-3 py-2 text-slate-100">{row.resolvedModel}</td>
                  <td className="px-3 py-2 text-slate-300">{formatContextWindow(row.contextWindow, labels.defaultContextWindow)}</td>
                  <td className="px-3 py-2 text-slate-300">{row.latencyMs}</td>
                  <td className="px-3 py-2 text-slate-300">{row.usage.totalTokens}</td>
                  <td className="px-3 py-2 text-slate-300">{row.ok ? labels.ok : labels.failed}</td>
                </tr>
              )) : (
                <tr><td className="px-3 py-4 text-slate-500" colSpan={6}>{labels.noData}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">{labels.firstTokenLatency}</p>
          <div className="mt-2 text-3xl font-semibold text-white">{data?.summary.avgFirstTokenLatencyMs?.toFixed(1) || "0.0"} ms</div>
          <p className="mt-2 text-xs text-slate-500">{labels.totalLatency}: {data?.summary.avgLatencyMs?.toFixed(1) || "0.0"} ms</p>
          <p className="mt-1 text-xs text-slate-500">{labels.tokenThroughput}: {data?.summary.avgTokenThroughputTps?.toFixed(2) || "0.00"} {labels.tokensPerSecond}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">{labels.percentiles}</p>
          <div className="mt-4 space-y-3">
            <PercentileRow label={labels.firstTokenLatency} metrics={data?.summary.firstTokenLatencyPercentiles || EMPTY_PERCENTILES} unit="ms" />
            <PercentileRow label={labels.totalLatency} metrics={data?.summary.latencyPercentiles || EMPTY_PERCENTILES} unit="ms" />
            <PercentileRow label={labels.tokenThroughput} metrics={data?.summary.tokenThroughputPercentiles || EMPTY_PERCENTILES} unit={labels.tokensPerSecond} />
          </div>
        </div>

        <BreakdownList
          title={labels.modelBreakdown}
          rows={(data?.modelBreakdown || []).slice(0, 6).map((row) => ({ ...row, key: row.model, label: row.model }))}
          labels={labels}
        />
        <BreakdownList
          title={labels.contextWindowBreakdown}
          rows={(data?.contextWindowBreakdown || []).map((row) => ({
            ...row,
            key: row.contextWindow === null ? "default" : String(row.contextWindow),
            label: formatContextWindow(row.contextWindow ?? undefined, labels.defaultContextWindow),
          }))}
          labels={labels}
        />

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">{labels.recentChecks}</p>
          <div className="mt-4 space-y-3">
            {data?.recentChecks.length ? data.recentChecks.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white">{row.targetLabel}</p>
                  <span className="text-xs text-slate-400">{row.ok ? labels.ok : labels.failed}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{new Date(row.checkedAt).toLocaleString()}</p>
              </div>
            )) : <p className="text-sm text-slate-500">{labels.noData}</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-sm text-slate-300">{labels.savedFiles}</p>
          <div className="mt-3 space-y-2 text-xs leading-6 text-slate-400">
            <p>{data?.paths.chatLogFile || "--"}</p>
            <p>{data?.paths.connectionCheckFile || "--"}</p>
            <p>{data?.paths.telemetryFile || "--"}</p>
            <p>{data?.paths.benchmarkFile || "--"}</p>
            <p>{data?.paths.benchmarkBaselineFile || "--"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatContextWindow(value: number | undefined, fallback: string) {
  if (typeof value !== "number") return fallback;
  return value >= 1024 ? `${Math.round(value / 1024)}K` : String(value);
}

function BreakdownList({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: Array<MetricBreakdown & { key: string; label: string }>;
  labels: RecentOperationsLabels;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-300">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white">{row.label}</p>
              <span className="text-xs text-slate-400">{row.requests}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Token: {formatCompactNumber(row.totalTokens)}</p>
            <p className="mt-1 text-xs text-slate-500">{labels.firstTokenLatency}: {row.avgFirstTokenLatencyMs.toFixed(1)} ms</p>
            <p className="mt-1 text-xs text-slate-500">{labels.totalLatency}: {row.avgLatencyMs.toFixed(1)} ms</p>
            <p className="mt-1 text-xs text-slate-500">{labels.tokenThroughput}: {row.avgTokenThroughputTps.toFixed(2)} {labels.tokensPerSecond}</p>
            <div className="mt-3 space-y-2">
              <PercentileRow label={labels.firstTokenLatency} metrics={row.firstTokenLatencyPercentiles} unit="ms" />
              <PercentileRow label={labels.totalLatency} metrics={row.latencyPercentiles} unit="ms" />
              <PercentileRow label={labels.tokenThroughput} metrics={row.tokenThroughputPercentiles} unit={labels.tokensPerSecond} />
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">{labels.noData}</p>}
      </div>
    </div>
  );
}
