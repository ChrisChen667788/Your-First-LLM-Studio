import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";

type ProviderHealthTargetGridProps = {
  locale: string;
  entries: AgentProviderHealthDeskItem[];
  labels: {
    model: string;
    firstTokenLatency: string;
    totalLatency: string;
    noData: string;
  };
};

function formatUsd(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function formatOptionalMs(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(0)} ms`
    : "--";
}

function statusClass(status: AgentProviderHealthDeskItem["status"]) {
  if (status === "healthy") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  if (status === "degraded") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "unhealthy") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-white/10 bg-white/5 text-slate-400";
}

function statusLabel(status: AgentProviderHealthDeskItem["status"], en: boolean) {
  if (status === "healthy") return en ? "Healthy" : "健康";
  if (status === "degraded") return en ? "Degraded" : "降级";
  if (status === "unhealthy") return en ? "Action needed" : "需处理";
  return en ? "No traffic" : "无流量";
}

function policyClass(
  severity: AgentProviderHealthDeskItem["policyRecommendation"]["severity"],
) {
  if (severity === "ok") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-50";
  if (severity === "watch") return "border-amber-300/20 bg-amber-300/10 text-amber-50";
  return "border-rose-300/20 bg-rose-400/10 text-rose-50";
}

export function ProviderHealthTargetGrid({
  locale,
  entries,
  labels,
}: ProviderHealthTargetGridProps) {
  const en = locale.startsWith("en");
  if (!entries.length) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        {en
          ? "No remote provider activity has been recorded in the current aggregation window yet."
          : "当前聚合窗口里还没有记录到远端 provider 活动。"}
      </p>
    );
  }
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      {entries.map((entry) => (
        <article key={`provider-health:${entry.targetId}`} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">{entry.targetLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className={`rounded-full border px-2.5 py-1 ${statusClass(entry.status)}`}>
                  {statusLabel(entry.status, en)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{entry.providerLabel}</span>
                <span className={`rounded-full border px-2.5 py-1 ${entry.lastConnectionOk === true ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : entry.lastConnectionOk === false ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {entry.lastConnectionOk === true
                    ? (en ? "Connection OK" : "连接正常")
                    : entry.lastConnectionOk === false
                      ? (en ? "Connection failed" : "连接失败")
                      : (en ? "Connection unknown" : "连接未知")}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <div>{labels.model}: <span className="font-mono text-slate-300">{entry.resolvedModel || "--"}</span></div>
                {entry.lastConnectionAt ? <div>{en ? "Last connection check" : "最近连接检查"}: {new Date(entry.lastConnectionAt).toLocaleString()}</div> : null}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 text-xs text-slate-400 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-3">
              {[
                [en ? "Requests" : "请求数", String(entry.totalRequests), ""],
                [en ? "Success rate" : "成功率", `${entry.successRatePct.toFixed(1)}%`, `${entry.successCount} / ${entry.failureCount}`],
                [en ? "Est. cost" : "估算成本", formatUsd(entry.estimatedCostUsd), ""],
                [labels.firstTokenLatency, typeof entry.avgFirstTokenLatencyMs === "number" ? `${entry.avgFirstTokenLatencyMs.toFixed(1)} ms` : "--", ""],
                [labels.totalLatency, typeof entry.avgLatencyMs === "number" ? `${entry.avgLatencyMs.toFixed(1)} ms` : "--", ""],
                [en ? "Token volume" : "Token 体量", entry.totalTokens.toLocaleString(), en ? "tokens total" : "总 token"],
              ].map(([label, value, detail]) => (
                <div key={label}>
                  <p className="uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-2 text-sm text-white">{value}</p>
                  {detail ? <p className="mt-1 text-[11px] text-slate-500">{detail}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-amber-100">timeout {entry.timeoutCount}</span>
            <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2.5 py-1 text-rose-100">429 {entry.rateLimitCount}</span>
            <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-violet-100">auth {entry.authFailureCount}</span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">network {entry.networkFailureCount}</span>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{en ? "4h trend buckets" : "4 小时趋势分桶"}</p>
              <span className="text-[11px] text-slate-500">{en ? "failures / first token / cost" : "失败 / 首字 / 成本"}</span>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {entry.trendBuckets.map((bucket) => {
                const failureRate = bucket.totalRequests ? Math.min(100, (bucket.failureCount / bucket.totalRequests) * 100) : 0;
                const height = Math.max(12, Math.min(48, bucket.totalRequests * 6 + failureRate / 3));
                return (
                  <div key={`${entry.targetId}:${bucket.bucketStart}`} className="min-w-0">
                    <div className="flex h-14 items-end rounded-xl border border-white/10 bg-white/[0.035] px-1.5 py-1">
                      <div className={`w-full rounded-lg ${bucket.failureCount ? "bg-gradient-to-t from-rose-500/80 to-amber-300/70" : bucket.totalRequests ? "bg-gradient-to-t from-emerald-500/80 to-cyan-300/70" : "bg-white/10"}`} style={{ height }} title={`${bucket.bucketLabel} · ${bucket.totalRequests} req · ${bucket.failureCount} fail · ${formatOptionalMs(bucket.avgFirstTokenLatencyMs)} · ${formatUsd(bucket.estimatedCostUsd)}`} />
                    </div>
                    <p className="mt-1 truncate text-center text-[10px] text-slate-500">{bucket.bucketLabel}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{en ? "Model cost / latency" : "模型成本 / 延迟"}</p>
              <div className="mt-2 grid gap-2">
                {entry.modelBreakdown.length ? entry.modelBreakdown.map((row) => (
                  <div key={`${entry.targetId}:${row.resolvedModel}`} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-xs">
                    <div className="truncate font-mono text-slate-200">{row.resolvedModel}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>{row.totalRequests} req</span><span>{row.failureCount} fail</span><span>{formatOptionalMs(row.avgFirstTokenLatencyMs)}</span><span>{formatUsd(row.estimatedCostUsd)}</span></div>
                  </div>
                )) : <p className="text-xs text-slate-500">{labels.noData}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{en ? "Profile policy view" : "Profile 策略视图"}</p>
              <div className="mt-2 grid gap-2">
                {entry.profileBreakdown.length ? entry.profileBreakdown.map((row) => (
                  <div key={`${entry.targetId}:${row.providerProfile}:${row.thinkingMode}`} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-xs">
                    <div className="text-slate-200">{row.providerProfile} · {row.thinkingMode}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>{row.totalRequests} req</span><span>{row.failureCount} fail</span><span>{formatOptionalMs(row.avgFirstTokenLatencyMs)}</span><span>{formatUsd(row.estimatedCostUsd)}</span></div>
                  </div>
                )) : <p className="text-xs text-slate-500">{labels.noData}</p>}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">{en ? "Retry / timeout policy" : "重试 / 超时策略"}</p>
              <span className="rounded-full border border-cyan-200/20 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">{entry.retryPolicy.providerKind}</span>
            </div>
            <div className="mt-3 grid gap-2 xl:grid-cols-3">
              {entry.retryPolicy.templates.map((template) => (
                <div key={`${entry.targetId}:${template.id}`} className={`rounded-2xl border px-3 py-2 text-xs ${template.id === entry.retryPolicy.recommendedTemplateId ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50" : "border-white/10 bg-black/20 text-slate-300"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">{template.label}</p>
                    {template.id === entry.retryPolicy.recommendedTemplateId ? <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-100">{en ? "Suggested" : "建议"}</span> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-400"><span>FT {Math.round(template.firstTokenTimeoutMs / 1000)}s</span><span>Total {Math.round(template.totalTimeoutMs / 1000)}s</span><span>Idle {Math.round(template.streamIdleTimeoutMs / 1000)}s</span><span>Retry {Math.round(template.retryBudgetMs / 1000)}s</span></div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{template.providerProfile} · {template.thinkingMode} · fallback {template.fallbackProfile}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-3 rounded-2xl border px-3 py-3 text-xs leading-6 ${policyClass(entry.policyRecommendation.severity)}`}>
            <span className="font-semibold">{en ? "Provider policy" : "Provider 策略"}: </span>
            {entry.policyRecommendation.summary}
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.policyRecommendation.actions.slice(0, 3).map((action) => <span key={action} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{action}</span>)}
            </div>
          </div>

          {entry.lastFailureSummary || entry.lastConnectionSummary ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-6 text-slate-400">
              {entry.lastFailureSummary ? <div><span className="text-slate-500">{en ? "Latest failure" : "最近失败"}:</span> {entry.lastFailureSummary}</div> : null}
              {entry.lastConnectionSummary ? <div className={entry.lastFailureSummary ? "mt-2" : ""}><span className="text-slate-500">{en ? "Connection summary" : "连接摘要"}:</span> {entry.lastConnectionSummary}</div> : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
