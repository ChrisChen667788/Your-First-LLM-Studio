"use client";

import { useCallback, useEffect, useState } from "react";

import type { Math500ReproducibilityReadModel } from "@/features/benchmark/reproducibility-contracts";

export function Math500ReproducibilityPanel({ isEnglish }: { isEnglish: boolean }) {
  const [payload, setPayload] = useState<Math500ReproducibilityReadModel | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (replay = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/benchmarks/reproducibility", {
        method: replay ? "POST" : "GET",
        headers: replay ? { "content-type": "application/json" } : undefined,
        body: replay ? JSON.stringify({ action: "replay" }) : undefined,
        cache: "no-store",
      });
      const body = (await response.json()) as Math500ReproducibilityReadModel & {
        evidence?: Math500ReproducibilityReadModel;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Evaluator replay failed.");
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluator replay failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const analysis = payload?.analysis;
  const replay = payload?.replay;

  return (
    <section
      id="math500-reproducibility-performance"
      data-evidence-ready={Boolean(analysis)}
      className="border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-cyan-300">
            MATH-500 REPRODUCIBILITY
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {isEnglish ? "Scorecard, confidence, and evaluator replay" : "分层评分、置信区间与判分重放"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {isEnglish
              ? "Analyzes the completed run without new model calls, then replays every prediction through the pinned isolated evaluator to detect scorer drift."
              : "不重复调用模型，直接分析已完成的 500 题输出，并通过固定隔离判分器逐题重放以检测 scorer drift。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending || !analysis}
          className="shrink-0 border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-60"
        >
          {pending
            ? isEnglish
              ? "Replaying..."
              : "重判中..."
            : isEnglish
              ? "Replay all 500 scores"
              : "重放全部 500 题判分"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Accuracy / Wilson 95%</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {analysis?.accuracy ?? "--"}%
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {analysis?.confidence
              ? `${analysis.confidence.low}% - ${analysis.confidence.high}%`
              : "--"}
          </p>
        </article>
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Evaluator replay</p>
          <p className={`mt-1 text-lg font-semibold ${replay?.localStatus === "pass" ? "text-emerald-100" : "text-amber-100"}`}>
            {replay ? `${replay.agreementSamples}/${replay.replayedSamples}` : "EVIDENCE NEEDED"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {replay ? `${replay.durationMs} ms · same host` : "--"}
          </p>
        </article>
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Latency</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {analysis ? `${analysis.latencyMs.p95} ms p95` : "--"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {analysis ? `p50 ${analysis.latencyMs.p50} · p99 ${analysis.latencyMs.p99}` : "--"}
          </p>
        </article>
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Checkpoint / tokens</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {analysis ? `${analysis.totals.resumed} / ${analysis.totals.inferred}` : "--"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {analysis ? `${analysis.tokens.promptAndCompletion.toLocaleString()} total tokens` : "--"}
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">
              {isEnglish ? "Accuracy by subject" : "按学科拆分准确率"}
            </h3>
            <span className="text-[10px] uppercase text-slate-500">7 groups</span>
          </div>
          <div className="mt-3 space-y-3">
            {(analysis?.subjects || []).map((entry) => (
              <div key={entry.key} className="min-w-0">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-slate-300">{entry.key}</span>
                  <span className="shrink-0 font-mono text-cyan-100">
                    {entry.accuracy}% · {entry.correct}/{entry.total}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden bg-slate-900">
                  <div className="h-full bg-cyan-300" style={{ width: `${entry.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 border border-white/10 bg-black/20 p-3">
          <h3 className="text-sm font-semibold text-white">
            {isEnglish ? "Accuracy by difficulty" : "按难度拆分准确率"}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {(analysis?.levels || []).map((entry) => (
              <article key={entry.key} className="min-w-0 border border-white/10 bg-white/[0.025] p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-200">{entry.key}</span>
                  <span className="font-mono text-xs text-cyan-100">{entry.accuracy}%</span>
                </div>
                <p className="mt-1 break-words text-[10px] text-slate-500">
                  Wilson {entry.confidence.low}% - {entry.confidence.high}% · {entry.correct}/{entry.total}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>

      {analysis ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[10px] uppercase text-slate-500">
          <span className="max-w-full break-all">run {analysis.runId}</span>
          <span className="max-w-full break-all">digest {analysis.runDigest.slice(0, 20)}</span>
        </div>
      ) : null}
    </section>
  );
}
