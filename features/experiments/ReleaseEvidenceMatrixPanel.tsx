"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ReleaseEvidenceMatrixResponse,
  ReleaseEvidenceMatrixRound,
  ReleaseEvidenceMatrixStatus,
} from "@/features/experiments/contracts";

type ReleaseEvidenceMatrixPanelProps = {
  locale: string;
};

type ReleaseEvidenceMatrixPayload = Partial<ReleaseEvidenceMatrixResponse> & {
  error?: string;
};

function statusClass(status: ReleaseEvidenceMatrixStatus) {
  if (status === "complete") return "border-emerald-300/30 bg-emerald-400/15 text-emerald-50";
  if (status === "in-progress") return "border-cyan-300/30 bg-cyan-400/15 text-cyan-50";
  if (status === "evidence-needed") return "border-amber-300/30 bg-amber-300/15 text-amber-50";
  if (status === "blocked") return "border-rose-300/30 bg-rose-400/15 text-rose-50";
  return "border-white/10 bg-white/5 text-slate-300";
}

function barClass(status: ReleaseEvidenceMatrixStatus) {
  if (status === "complete") return "bg-emerald-300";
  if (status === "in-progress") return "bg-cyan-300";
  if (status === "evidence-needed") return "bg-amber-300";
  if (status === "blocked") return "bg-rose-300";
  return "bg-slate-500";
}

function compactLines(values: string[], fallback: string) {
  return values.length ? values.slice(0, 3) : [fallback];
}

export function ReleaseEvidenceMatrixPanel({ locale }: ReleaseEvidenceMatrixPanelProps) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<ReleaseEvidenceMatrixResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const text = useMemo(
    () => ({
      eyebrow: en ? "Evidence matrix" : "证据矩阵",
      title: en ? "10-round execution tracker" : "后续 10 轮执行追踪",
      subtitle: en
        ? "A live view of the next release train, scored from current contracts, artifacts, route evidence, and blockers."
        : "基于当前 contracts、产物、路由证据和阻塞项实时计算后续版本列车状态。",
      refresh: en ? "Refresh" : "刷新",
      loading: en ? "Loading..." : "加载中...",
      shipped: en ? "Shipped" : "已落地",
      evidence: en ? "Evidence" : "证据",
      blockers: en ? "Blockers" : "阻塞",
      next: en ? "Next" : "下一步",
      noBlockers: en ? "No blockers in this slice." : "该切片暂无阻塞项。",
      noEvidence: en ? "Evidence will be linked as this slice lands." : "证据会随该切片落地后挂接。",
      noShipped: en ? "Not started in code yet." : "代码侧尚未启动。",
      average: en ? "Average" : "平均",
    }),
    [en],
  );

  const statusLabel = useCallback(
    (status: ReleaseEvidenceMatrixStatus) => {
      if (en) return status.replace("-", " ");
      if (status === "complete") return "完成";
      if (status === "in-progress") return "推进中";
      if (status === "evidence-needed") return "待补证据";
      if (status === "blocked") return "阻塞";
      return "计划中";
    },
    [en],
  );

  const loadMatrix = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/release-evidence-matrix", {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as ReleaseEvidenceMatrixPayload;
      if (!response.ok || !nextPayload.ok || !nextPayload.rounds) {
        throw new Error(nextPayload.error || "Failed to load release evidence matrix.");
      }
      setPayload(nextPayload as ReleaseEvidenceMatrixResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load release evidence matrix.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  const rounds = payload?.rounds || [];
  const totals = payload?.totals;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">
            {text.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{text.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {text.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totals ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-emerald-100">
              {text.average} {totals.averageCompletionPct}%
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void loadMatrix()}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            {pending ? text.loading : text.refresh}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {totals ? (
        <div className="mt-4 grid gap-2 text-center text-xs text-slate-300 sm:grid-cols-5">
          <span className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2">
            {totals.completeCount} complete
          </span>
          <span className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2">
            {totals.inProgressCount} active
          </span>
          <span className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2">
            {totals.evidenceNeededCount} evidence
          </span>
          <span className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2">
            {totals.blockedCount} blocked
          </span>
          <span className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
            {totals.plannedCount} planned
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-5">
        {rounds.map((round: ReleaseEvidenceMatrixRound) => (
          <article key={round.version} className="rounded-[26px] border border-white/10 bg-black/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{round.version}</p>
                <p className="mt-1 text-xs text-slate-400">{round.label}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(round.status)}`}>
                {statusLabel(round.status)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${barClass(round.status)}`}
                style={{ width: `${round.completionPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {round.completionPct}% · {round.track} · {round.targetWindow}
            </p>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
              {round.summary}
            </p>

            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200">{text.shipped}</p>
              {compactLines(round.shipped, text.noShipped).map((line) => (
                <p key={`${round.version}-ship-${line}`} className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-50/85">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200">{text.evidence}</p>
              {compactLines(round.evidence, text.noEvidence).map((line) => (
                <p key={`${round.version}-evidence-${line}`} className="break-all rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-xs leading-5 text-cyan-50/85">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200">{text.next}</p>
              {compactLines(round.nextActions, "--").slice(0, 2).map((line) => (
                <p key={`${round.version}-next-${line}`} className="rounded-2xl border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50/85">
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-rose-200">{text.blockers}</p>
              {compactLines(round.blockers, text.noBlockers).slice(0, 2).map((line) => (
                <p key={`${round.version}-blocker-${line}`} className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${
                  round.blockers.length
                    ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                    : "border-white/10 bg-white/[0.035] text-slate-400"
                }`}>
                  {line}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
