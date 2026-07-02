"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PromotionGateResponse,
  PromotionGateSourceStatus,
} from "@/features/experiments/contracts";

type PromotionGatePanelProps = {
  locale: string;
};

type PromotionGatePayload = Partial<PromotionGateResponse> & {
  error?: string;
};

function statusClass(status: PromotionGateSourceStatus) {
  if (status === "pass") return "border-emerald-300/30 bg-emerald-400/15 text-emerald-50";
  if (status === "watch") return "border-amber-300/30 bg-amber-300/15 text-amber-50";
  return "border-rose-300/30 bg-rose-400/15 text-rose-50";
}

export function PromotionGatePanel({ locale }: PromotionGatePanelProps) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<PromotionGateResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const text = useMemo(
    () => ({
      eyebrow: en ? "Promotion gate" : "发布门禁",
      title: en ? "v0.5 evidence rollup" : "v0.5 证据汇总",
      subtitle: en
        ? "A release-gate read-model that combines Benchmark, Provider Ops, and Fine-tune evidence without hiding missing data."
        : "把 Benchmark、Provider Ops、Fine-tune 证据汇成一个发布门禁读模型，不掩盖缺失数据。",
      refresh: en ? "Refresh" : "刷新",
      loading: en ? "Loading..." : "加载中...",
      blockers: en ? "Blockers" : "阻塞项",
      releaseDraft: en ? "Release note draft" : "发布说明草稿",
      pass: en ? "Pass" : "通过",
      watch: en ? "Watch" : "观察",
      hold: en ? "Hold" : "暂停",
    }),
    [en],
  );

  const statusLabel = useCallback(
    (status: PromotionGateSourceStatus) => {
      if (status === "pass") return text.pass;
      if (status === "watch") return text.watch;
      return text.hold;
    },
    [text.hold, text.pass, text.watch],
  );

  const loadGate = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/promotion-gate", {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as PromotionGatePayload;
      if (!response.ok || !nextPayload.ok || !nextPayload.sources) {
        throw new Error(nextPayload.error || "Failed to load promotion gate.");
      }
      setPayload(nextPayload as PromotionGateResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load promotion gate.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadGate();
  }, [loadGate]);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">{text.eyebrow}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-white">{text.title}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(payload?.overallStatus || "hold")}`}>
              {statusLabel(payload?.overallStatus || "hold")}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{text.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadGate()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {pending ? text.loading : text.refresh}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {(payload?.sources || []).map((source) => (
          <article key={source.id} className="rounded-[26px] border border-white/10 bg-black/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{source.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{source.summary}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(source.status)}`}>
                {statusLabel(source.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(source.metrics).slice(0, 6).map(([key, value]) => (
                <span key={key} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                  {key}: {String(value)}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {source.blockers.length ? source.blockers.slice(0, 3).map((blocker) => (
                <p key={blocker} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
                  {blocker}
                </p>
              )) : (
                <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                  {en ? "No blockers reported by this source." : "该来源未报告阻塞项。"}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">{text.blockers}</p>
          <div className="mt-3 space-y-2">
            {payload?.blockers.length ? payload.blockers.slice(0, 6).map((blocker) => (
              <p key={blocker} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
                {blocker}
              </p>
            )) : (
              <p className="text-sm text-slate-500">{en ? "No blockers." : "暂无阻塞项。"}</p>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">{text.releaseDraft}</p>
          <div className="mt-3 space-y-2">
            {(payload?.releaseNoteDraft || []).slice(0, 6).map((line) => (
              <p key={line} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
