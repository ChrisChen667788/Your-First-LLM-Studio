"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  candidatePromotionStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: null | {
    totals: { slices: 15; passed: number; held: number };
    evidenceDigest: string;
  };
  decisionIntelligence: {
    baseline: null | { accuracy: number; samples: number; runId: string };
    audit: null | {
      accountedSamples: number;
      extractionCoveragePct: number;
      reviewQueue: unknown[];
    };
    power: null | { detectableEffectAtAvailableSamplesPct: number };
    comparison: null | {
      candidateRunId: string | null;
      promotionDecision: string;
      blockers: string[];
    };
    eligibleRuns: unknown[];
  };
  error?: string;
};

export function V166BenchmarkDecisionPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (runAcceptance = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v166-benchmark-decision-intelligence",
        {
          method: runAcceptance ? "POST" : "GET",
          headers: runAcceptance ? { "content-type": "application/json" } : undefined,
          body: runAcceptance ? "{}" : undefined,
          cache: "no-store",
        },
      );
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Decision acceptance failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision acceptance failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decision = payload?.decisionIntelligence;
  const comparison = decision?.comparison;

  return (
    <section className="min-w-0 border border-fuchsia-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-fuchsia-300">
            V1.6.6 BENCHMARK DECISION GATE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Auditable model promotion evidence" : "可审计的模型晋级证据"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Fifteen local checks verify item accounting, error taxonomy, cohort risk, outlier policy, statistical power, and a fail-closed paired candidate gate."
              : "15 项本地检查验证逐题记账、错误分类、cohort 风险、异常点策略、统计功效和 fail-closed 候选配对门槛。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-sm font-semibold text-fuchsia-50 hover:bg-fuchsia-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Checking..." : "验收中...") : en ? "Run 15-slice gate" : "运行 15 项验收"}
        </button>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["LOCAL GATE", payload?.latest ? `${payload.latest.totals.passed}/15` : "NOT RUN"],
          ["BASELINE", decision?.baseline ? `${decision.baseline.accuracy}% · ${decision.baseline.samples}` : "--"],
          ["AUDIT", decision?.audit ? `${decision.audit.accountedSamples}/500` : "--"],
          ["POWER MDE", decision?.power ? `${decision.power.detectableEffectAtAvailableSamplesPct} pp` : "--"],
          ["CANDIDATE", payload?.candidatePromotionStatus || "evidence-needed"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Audit readiness</p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">
            {decision?.audit?.extractionCoveragePct ?? 0}% extraction · {decision?.audit?.reviewQueue.length || 0} queued
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {en
              ? "The complete run is classified and reviewable without changing its stored predictions."
              : "完整 run 已完成分类并可复核，不改写任何已存预测。"}
          </p>
        </article>
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Candidate promotion</p>
          <p className="mt-2 text-sm font-semibold uppercase text-amber-200">
            {comparison?.promotionDecision || "evidence-needed"}
          </p>
          <p className="mt-2 break-words text-xs leading-5 text-slate-400">
            {comparison?.blockers[0] || (en ? "No comparison blocker." : "没有对比阻塞项。")}
          </p>
        </article>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>{decision?.eligibleRuns.length || 0} distinct complete run id</span>
        <span className="text-amber-200">PRODUCTION HOLD</span>
      </div>
    </section>
  );
}
