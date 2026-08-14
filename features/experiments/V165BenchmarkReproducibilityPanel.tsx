"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: null | {
    totals: { slices: 15; passed: number; held: number };
    evidenceDigest: string;
  };
  reproducibility: {
    analysis: null | {
      accuracy: number | null;
      confidence: null | { low: number; high: number };
      totals: { samples: number; scored: number; correct: number };
    };
    replay: null | {
      agreementSamples: number;
      replayedSamples: number;
      localStatus: "pass" | "hold";
      independentHost: false;
    };
    multimodalPlan: {
      localStatus: "ready" | "hold";
      candidateTarget: null | { label: string; modalities: string[] };
      conformance: { total: number; passed: number };
      protocols: Array<{
        id: string;
        label: string;
        adapterStatus: string;
        executionStatus: string;
        judgeMode: string;
        blockers: string[];
      }>;
    };
  };
  productionBlockers: string[];
  error?: string;
};

export function V165BenchmarkReproducibilityPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (runAcceptance = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v165-benchmark-reproducibility",
        {
          method: runAcceptance ? "POST" : "GET",
          headers: runAcceptance ? { "content-type": "application/json" } : undefined,
          body: runAcceptance ? "{}" : undefined,
          cache: "no-store",
        },
      );
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Reproducibility acceptance failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reproducibility acceptance failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const analysis = payload?.reproducibility.analysis;
  const replay = payload?.reproducibility.replay;
  const plan = payload?.reproducibility.multimodalPlan;

  return (
    <section className="border border-emerald-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-emerald-300">
            V1.6.5 REPRODUCIBILITY GATE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Run replay and multimodal execution readiness" : "运行重放与多模态执行准备度"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Fifteen fail-closed checks bind the completed MATH-500 run to dataset/evaluator fingerprints, statistical scorecards, same-host replay, and explicit multimodal execution plans."
              : "15 项 fail-closed 检查把完整 MATH-500 run 与数据/判分指纹、统计 scorecard、同机隔离重放和多模态执行计划绑定。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Replaying..." : "重放中...") : en ? "Run 15-slice gate" : "运行 15 项验收"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["LOCAL GATE", payload?.latest ? `${payload.latest.totals.passed}/15` : "NOT RUN"],
          ["MATH-500", analysis ? `${analysis.accuracy}% · ${analysis.totals.scored}/500` : "--"],
          ["REPLAY", replay ? `${replay.agreementSamples}/${replay.replayedSamples}` : "--"],
          ["MULTIMODAL PLAN", plan ? `${plan.conformance.passed}/${plan.conformance.total} · ${plan.localStatus}` : "--"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(plan?.protocols || []).map((protocol) => (
          <article key={protocol.id} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{protocol.label}</h3>
              <span className="border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">
                adapter {protocol.adapterStatus}
              </span>
            </div>
            <p className="mt-2 text-[10px] uppercase text-slate-500">{protocol.judgeMode}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-400">
              {protocol.blockers.join(" ")}
            </p>
            <p className="mt-2 text-[10px] uppercase text-amber-200">
              full run {protocol.executionStatus}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>
          {plan?.candidateTarget
            ? `${plan.candidateTarget.label} · ${plan.candidateTarget.modalities.join(" / ")}`
            : en
              ? "No verified multimodal target"
              : "没有已验证的多模态目标"}
        </span>
        <span className="text-amber-200">PRODUCTION HOLD</span>
      </div>
    </section>
  );
}
