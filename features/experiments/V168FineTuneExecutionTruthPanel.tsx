"use client";

import { useCallback, useEffect, useState } from "react";

type Evidence = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: null | {
    totals: { slices: 15; passed: number; held: number };
    schemas: { backend: string; metrics: string };
    evidenceDigest: string;
    disclosure: string;
    error?: string;
  };
  error?: string;
};

export function V168FineTuneExecutionTruthPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (accept = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/experiments/v168-finetune-execution-truth",
        {
          method: accept ? "POST" : "GET",
          headers: accept ? { "content-type": "application/json" } : undefined,
          body: accept ? "{}" : undefined,
          cache: "no-store",
        },
      );
      const body = (await response.json()) as Evidence & { evidence?: Evidence };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Fine-tune execution truth acceptance failed.");
      }
      setEvidence(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Fine-tune execution truth acceptance failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-emerald-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-emerald-300">
            V1.6.8 FINE-TUNE EXECUTION GATE
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Backend and checkpoint truth" : "后端与 checkpoint 执行真实性"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Scheduler, warmup, target modules, packing rejection, checkpoint selection, and task metrics now share explicit backend contracts."
              : "Scheduler、warmup、target modules、packing 拒绝、checkpoint 选择和任务指标现在统一受显式后端 contract 约束。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {pending ? (en ? "Running..." : "运行中...") : en ? "Run 15-slice gate" : "运行 15 项验收"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["LOCAL", evidence?.latest ? `${evidence.latest.totals.passed}/15` : "NOT RUN"],
          ["BACKEND", evidence?.latest?.schemas.backend || "--"],
          ["METRICS", evidence?.latest?.schemas.metrics || "--"],
          ["PRODUCTION", evidence?.productionStatus || "hold"],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold uppercase text-white">{value}</p>
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        {evidence?.latest?.error || evidence?.latest?.disclosure || (en ? "Run the gate to create local evidence." : "运行门槛后生成本地证据。")}
      </p>
    </section>
  );
}
