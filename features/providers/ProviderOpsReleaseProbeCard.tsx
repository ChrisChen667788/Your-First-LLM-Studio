"use client";

import { useEffect, useState } from "react";
import type { ProviderOpsEvidenceSummary } from "./contracts";

type ProviderProbeTarget = {
  targetId: string;
  targetLabel: string;
  providerLabel: string;
};

type ProviderOpsReleaseProbeCardProps = {
  locale: string;
  summary: ProviderOpsEvidenceSummary;
  targets: ProviderProbeTarget[];
  pendingTargetId?: string;
  message?: string;
  messageTone?: "success" | "error";
  onRun: (targetId: string) => void | Promise<void>;
};

function formatTimestamp(value: string | null, locale: string) {
  if (!value) return locale.startsWith("en") ? "No probe yet" : "暂无探针";
  return new Date(value).toLocaleString(locale.startsWith("en") ? "en-US" : "zh-CN");
}

export function ProviderOpsReleaseProbeCard({
  locale,
  summary,
  targets,
  pendingTargetId,
  message,
  messageTone = "success",
  onRun,
}: ProviderOpsReleaseProbeCardProps) {
  const [targetId, setTargetId] = useState(targets[0]?.targetId || "");
  const en = locale.startsWith("en");

  useEffect(() => {
    if (targets.some((target) => target.targetId === targetId)) return;
    setTargetId(targets[0]?.targetId || "");
  }, [targetId, targets]);

  const isPending = Boolean(pendingTargetId);

  return (
    <section className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
            {en ? "Release probe" : "发布探针"}
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            {en
              ? "Runs the selected configured remote target through a minimal models plus chat check. Successful probes count as fresh release evidence, separately from user chat traffic."
              : "对所选已配置远端目标执行最小 models 加 chat 检查。成功探针会作为新鲜发布证据单独记录，不混入用户聊天流量。"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:min-w-[340px]">
          {[
            [en ? "Probe success" : "探针成功", `${summary.releaseProbe.successCount}/${summary.releaseProbe.totalCount}`],
            [en ? "Latest success" : "最近成功", formatTimestamp(summary.releaseProbe.latestSuccessfulAt, locale)],
            [en ? "Failures" : "失败", String(summary.releaseProbe.failureCount)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-2.5 py-2">
              <p className="truncate text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-1 truncate text-xs font-medium text-slate-100" title={value}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          aria-label={en ? "Release probe target" : "发布探针目标"}
          value={targetId}
          disabled={!targets.length || isPending}
          onChange={(event) => setTargetId(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {targets.length ? (
            targets.map((target) => (
              <option key={target.targetId} value={target.targetId}>
                {target.targetLabel} · {target.providerLabel}
              </option>
            ))
          ) : (
            <option value="">{en ? "No remote provider target" : "没有远端 Provider 目标"}</option>
          )}
        </select>
        <button
          type="button"
          disabled={!targetId || isPending}
          onClick={() => void onRun(targetId)}
          className="rounded-xl border border-cyan-200/30 bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? en
              ? "Running probe..."
              : "探针运行中..."
            : en
              ? "Run release probe"
              : "运行发布探针"}
        </button>
      </div>

      {message ? (
        <p
          className={`mt-2 text-xs leading-5 ${
            messageTone === "error" ? "text-rose-200" : "text-cyan-100"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
