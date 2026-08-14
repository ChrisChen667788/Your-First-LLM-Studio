"use client";

import { useCallback, useEffect, useState } from "react";

import type { BenchmarkDecisionIntelligence } from "@/features/benchmark/decision-intelligence-contracts";

function statusTone(status: string) {
  if (status === "pass" || status === "stable") return "text-emerald-200";
  if (status === "critical" || status === "hold") return "text-rose-200";
  return "text-amber-200";
}

export function BenchmarkDecisionIntelligencePanel({
  isEnglish,
}: {
  isEnglish: boolean;
}) {
  const [model, setModel] = useState<BenchmarkDecisionIntelligence | null>(null);
  const [baselineRunId, setBaselineRunId] = useState("");
  const [candidateRunId, setCandidateRunId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (baseline = "", candidate = "") => {
    setPending(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (baseline) query.set("baselineRunId", baseline);
      if (candidate) query.set("candidateRunId", candidate);
      const response = await fetch(
        `/api/benchmarks/decision-intelligence${query.size ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as BenchmarkDecisionIntelligence & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Decision analysis failed.");
      setModel(body);
      if (!baseline && body.baseline?.runId) setBaselineRunId(body.baseline.runId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision analysis failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load("", "");
  }, [load]);

  const audit = model?.audit;
  const comparison = model?.comparison;
  const risks = audit?.cohortRisks.filter((entry) => entry.risk !== "stable") || [];

  return (
    <section className="min-w-0 border border-fuchsia-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-fuchsia-300">
            V1.6.6 BENCHMARK DECISION INTELLIGENCE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {isEnglish ? "Audit queue, power, and paired promotion gate" : "错误审计、统计功效与配对晋级门槛"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {isEnglish
              ? "Turns the completed MATH-500 run into item-level error classes, confidence-aware cohort risks, a bounded review queue, and a fail-closed candidate comparison."
              : "把完整 MATH-500 run 转成逐题错误分类、置信区间 cohort 风险、有限复核队列，并对候选 run 执行 fail-closed 配对比较。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(baselineRunId, candidateRunId)}
          disabled={pending}
          className="shrink-0 border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-sm font-semibold text-fuchsia-50 hover:bg-fuchsia-400/20 disabled:opacity-60"
        >
          {pending ? (isEnglish ? "Analyzing..." : "分析中...") : isEnglish ? "Refresh audit" : "刷新审计"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="min-w-0 border border-white/10 bg-black/25 p-3 text-xs text-slate-400">
          <span className="block uppercase text-slate-500">Baseline run</span>
          <select
            value={baselineRunId}
            onChange={(event) => {
              const next = event.target.value;
              setBaselineRunId(next);
              if (candidateRunId === next) setCandidateRunId("");
              void load(next, candidateRunId === next ? "" : candidateRunId);
            }}
            className="mt-2 w-full min-w-0 bg-slate-950 px-2 py-2 text-sm text-white"
          >
            {model?.eligibleRuns.map((run) => (
              <option key={run.runId} value={run.runId}>
                {run.resolvedModel} · {run.runId}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 border border-white/10 bg-black/25 p-3 text-xs text-slate-400">
          <span className="block uppercase text-slate-500">Candidate run</span>
          <select
            value={candidateRunId}
            onChange={(event) => {
              const next = event.target.value;
              setCandidateRunId(next);
              void load(baselineRunId, next);
            }}
            className="mt-2 w-full min-w-0 bg-slate-950 px-2 py-2 text-sm text-white"
          >
            <option value="">{isEnglish ? "Evidence needed" : "需要第二次完整 run"}</option>
            {model?.eligibleRuns
              .filter((run) => run.runId !== baselineRunId)
              .map((run) => (
                <option key={run.runId} value={run.runId}>
                  {run.resolvedModel} · {run.runId}
                </option>
              ))}
          </select>
        </label>
        <div className="min-w-48 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Candidate promotion</p>
          <p className={`mt-2 text-sm font-semibold uppercase ${statusTone(comparison?.promotionDecision || "evidence-needed")}`}>
            {comparison?.promotionDecision || "evidence-needed"}
          </p>
          <p className="mt-1 text-xs text-slate-500">margin -2pp · p95 +20%</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["BASELINE", model?.baseline ? `${model.baseline.accuracy}% · ${model.baseline.samples}/500` : "--"],
          ["EXTRACTION", audit ? `${audit.extractionCoveragePct}%` : "--"],
          ["REVIEW QUEUE", audit ? `${audit.reviewQueue.length}/24` : "--"],
          ["DETECTABLE EFFECT", model?.power ? `${model.power.detectableEffectAtAvailableSamplesPct} pp` : "--"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {isEnglish ? "Error taxonomy" : "错误分类"}
            </h3>
            <span className="text-[10px] uppercase text-slate-500">500 accounted</span>
          </div>
          <div className="mt-3 space-y-2">
            {audit?.errorTaxonomy.map((entry) => (
              <div key={entry.key}>
                <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 break-words text-slate-300">{entry.key}</span>
                  <span className="shrink-0 font-mono text-slate-200">{entry.count} · {entry.pct}%</span>
                </div>
                <div className="mt-1 h-1 bg-white/10">
                  <div className="h-full bg-fuchsia-300" style={{ width: `${entry.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {isEnglish ? "Confidence-aware risk cohorts" : "置信区间风险 cohort"}
            </h3>
            <span className="text-[10px] uppercase text-slate-500">{risks.length} watch / critical</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {risks.map((entry) => (
              <div key={`${entry.kind}-${entry.key}`} className="min-w-0 border border-white/10 px-3 py-2">
                <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 break-words text-slate-300">{entry.key}</span>
                  <span className={`shrink-0 uppercase ${statusTone(entry.risk)}`}>{entry.risk}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-white">
                  {entry.accuracy}% · {entry.deltaFromOverallPct > 0 ? "+" : ""}{entry.deltaFromOverallPct} pp
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Wilson {entry.confidence.low}%–{entry.confidence.high}% · {entry.correct}/{entry.total}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <h3 className="text-sm font-semibold text-white">
            {isEnglish ? "Power plan" : "统计功效规划"}
          </h3>
          <div className="mt-3 space-y-2">
            {model?.power?.targets.map((target) => (
              <div key={target.effectPct} className="flex min-w-0 items-center justify-between gap-3 border border-white/10 px-3 py-2 text-xs">
                <span className="text-slate-300">Detect {target.effectPct} pp</span>
                <span className={target.sufficientlyPowered ? "text-emerald-200" : "text-amber-200"}>
                  {target.requiredSamplesPerRun}/run · {target.sufficientlyPowered ? "READY" : "MORE DATA"}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {isEnglish ? "Priority review queue" : "优先复核队列"}
            </h3>
            <span className="text-[10px] uppercase text-slate-500">
              latency &gt; {audit?.latencyOutliers.thresholdMs || 0} ms · tokens &gt; {audit?.tokenOutliers.thresholdTokens || 0}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {audit?.reviewQueue.slice(0, 6).map((item) => (
              <div key={item.itemId} className="min-w-0 border border-white/10 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px] uppercase">
                  <span className="text-fuchsia-200">{item.subject} · L{item.level}</span>
                  <span className="text-amber-200">{item.errorClass}</span>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{item.itemId}</p>
                <p className="mt-2 break-words text-xs text-slate-300">P: {item.predictionPreview}</p>
                <p className="mt-1 break-words text-xs text-slate-500">G: {item.expectedPreview}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        <span className="min-w-0 break-all">DIGEST {model?.decisionDigest || "--"}</span>
        <span className="text-amber-200">PRODUCTION HOLD</span>
      </div>
    </section>
  );
}
