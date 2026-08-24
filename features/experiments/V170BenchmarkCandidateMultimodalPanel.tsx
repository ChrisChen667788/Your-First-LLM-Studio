"use client";

import { useCallback, useEffect, useState } from "react";

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold";
  candidatePromotionStatus: "pass" | "hold" | "evidence-needed";
  multimodalExecutionStatus: "pass" | "hold";
  productionStatus: "hold";
  totals: { slices: 15; passed: number; held: number };
  baseline: null | { runId: string; targetLabel: string; totalSamples: number };
  candidate: null | { runId: string; targetLabel: string; scoredSamples: number };
  candidateTarget: null | { label: string; modalities: string[] };
  multimodalProtocols: Array<{
    id: string;
    label: string;
    adapterStatus: "pass" | "hold";
    executionStatus: "ready" | "hold";
    blockers: string[];
  }>;
  blockers: string[];
  disclosure: string;
  error?: string;
};

export function V170BenchmarkCandidateMultimodalPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v170-benchmark-candidate-multimodal",
        {
          method: record ? "POST" : "GET",
          headers: record ? { "content-type": "application/json" } : undefined,
          body: record ? "{}" : undefined,
          cache: "no-store",
        },
      );
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Candidate gate request failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Candidate gate request failed.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-sky-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-sky-300">
            V1.7.0 CANDIDATE + MULTIMODAL GATE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Distinct candidate and official multimodal truth" : "不同候选与官方多模态真相"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "A second run must bind a different model or adapter, not merely a new run id. Official assets and native image/video execution remain separate proof from parser fixtures and capability declarations."
              : "第二次运行必须绑定不同的模型或适配器，不能只更换 run id；官方资产和原生图像/视频执行也与解析器 fixture、能力声明分开取证。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-50 hover:bg-sky-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Checking..." : "验收中...") : en ? "Record 15-slice gate" : "记录 15 项验收"}
        </button>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["LOCAL GATE", payload ? `${payload.totals.passed}/15` : "NOT RUN"],
          ["BASELINE", payload?.baseline ? `${payload.baseline.targetLabel} · ${payload.baseline.totalSamples}` : "--"],
          ["CANDIDATE", payload?.candidatePromotionStatus || "evidence-needed"],
          ["MULTIMODAL", payload?.multimodalExecutionStatus || "hold"],
          ["PRODUCTION", payload?.productionStatus || "hold"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Candidate binding</p>
          <p className="mt-2 text-sm font-semibold text-sky-100">
            {payload?.candidate
              ? `${payload.candidate.targetLabel} · ${payload.candidate.scoredSamples}/500`
              : en ? "Second complete candidate required" : "需要第二个完整候选"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {en
              ? "The gate rejects a duplicate target/model binding even if it has a new run id."
              : "即使 run id 不同，门禁也会拒绝重复的 target/model 绑定。"}
          </p>
        </article>
        <article className="min-w-0 border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Official multimodal execution</p>
          <p className="mt-2 text-sm font-semibold text-amber-100">
            {payload?.candidateTarget
              ? `${payload.candidateTarget.label} · ${payload.candidateTarget.modalities.join(" / ")}`
              : "--"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {payload?.multimodalProtocols.find((protocol) => protocol.executionStatus === "hold")?.blockers[0] ||
              payload?.disclosure ||
              "--"}
          </p>
        </article>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>{payload?.blockers.length || 0} active blockers</span>
        <span className="text-amber-200">PRODUCTION HOLD</span>
      </div>
    </section>
  );
}
