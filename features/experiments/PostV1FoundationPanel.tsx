"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FoundationRound = {
  version: string;
  label: string;
  status: "foundation-ready" | "partial" | "blocked";
  completionPct: number;
  summary: string;
  evidence: string[];
  blockers: string[];
};

type FoundationPayload = {
  ok: true;
  schemaVersion: "experiments.post-v1-foundation.v1";
  generatedAt: string;
  rounds: FoundationRound[];
  totals: {
    rounds: number;
    foundationReady: number;
    partial: number;
    blocked: number;
    averageCompletionPct: number;
  };
};

function statusClass(status: FoundationRound["status"]) {
  if (status === "foundation-ready") return "border-emerald-300/30 bg-emerald-400/15 text-emerald-50";
  if (status === "blocked") return "border-rose-300/30 bg-rose-400/15 text-rose-50";
  return "border-amber-300/30 bg-amber-300/15 text-amber-50";
}

export function PostV1FoundationPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<FoundationPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const text = useMemo(
    () => ({
      eyebrow: en ? "Post-v1 foundations" : "POST-V1 基础切片",
      title: en ? "Ten-version foundation evidence" : "后续十个版本的基础证据",
      subtitle: en
        ? "These cards prove that the first contract and service boundary exists. They do not mark the full release as complete."
        : "这些卡片只证明首个 contract 与 service boundary 已落地，不代表对应大版本已经完成。",
      refresh: en ? "Refresh" : "刷新",
      loading: en ? "Loading..." : "加载中...",
      blockers: en ? "Remaining" : "剩余项",
    }),
    [en],
  );
  const load = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/post-v1-foundation", { cache: "no-store" });
      const next = (await response.json()) as FoundationPayload & { error?: string };
      if (!response.ok || !next.ok) throw new Error(next.error || "Failed to load post-v1 foundations.");
      setPayload(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load post-v1 foundations.");
    } finally {
      setPending(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">{text.eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{text.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{text.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {payload ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-50">
              {payload.totals.rounds} rounds · {payload.totals.averageCompletionPct}% foundation
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            {pending ? text.loading : text.refresh}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-5">
        {payload?.rounds.map((round) => (
          <article key={round.version} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{round.version}</p>
                <p className="mt-1 text-xs text-slate-400">{round.label}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${statusClass(round.status)}`}>
                {round.status}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${round.completionPct}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{round.summary}</p>
            {round.blockers.length ? (
              <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2">
                <p className="text-[10px] uppercase text-amber-200">{text.blockers}</p>
                <p className="mt-1 text-xs leading-5 text-amber-50">{round.blockers[0]}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
