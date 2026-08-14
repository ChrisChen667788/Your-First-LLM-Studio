"use client";

import { useCallback, useEffect, useState } from "react";

const LAUNCH_HEARTBEAT_DELAY_MS = 750;

function waitForLaunchHeartbeat() {
  return new Promise((resolve) =>
    window.setTimeout(resolve, LAUNCH_HEARTBEAT_DELAY_MS),
  );
}

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold" | "evidence-needed";
  productionStatus: "hold";
  latest: null | {
    totals: { slices: number; passed: number; held: number };
    evidenceDigest: string;
  };
  acceptance: {
    totals: { slices: number; passed: number; held: number };
  };
  mathRuntime: { available: boolean; evaluatorVersion: string };
  officialRun: {
    active: boolean;
    latestProgress: null | {
      runId: string;
      status: string;
      completedSamples: number;
      totalSamples: number;
      estimatedRemainingMs: number | null;
    };
    latestEvidence: null | {
      runId: string;
      resolvedModel: string;
      scoredSamples: number;
      correctSamples: number;
      accuracy: number | null;
      complete: boolean;
    };
  };
  protocols: Array<{
    id: string;
    label: string;
    adapterStatus: string;
    executionStatus: string;
    detail: string;
  }>;
  productionBlockers: string[];
  error?: string;
};

export function V164OfficialEvaluatorsPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (runChecks = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/v164-official-evaluators", {
        method: runChecks ? "POST" : "GET",
        headers: runChecks ? { "content-type": "application/json" } : undefined,
        body: runChecks ? "{}" : undefined,
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Official evaluator check failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Official evaluator check failed.");
    } finally {
      setPending(false);
    }
  }, []);

  const launch = useCallback(async (resume = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/benchmarks/official-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: resume ? "resume" : "start",
          runId: resume ? payload?.officialRun.latestProgress?.runId : undefined,
          targetId: "local-qwen3-0.6b",
          maxTokens: 512,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Full run launch failed.");
      await waitForLaunchHeartbeat();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Full run launch failed.");
    } finally {
      setPending(false);
    }
  }, [load, payload?.officialRun.latestProgress?.runId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!payload?.officialRun.active) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, payload?.officialRun.active]);

  const progress = payload?.officialRun.latestProgress;
  const percent = progress?.totalSamples
    ? Math.round((progress.completedSamples / progress.totalSamples) * 100)
    : 0;

  return (
    <section className="border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">
            V1.6.4 OFFICIAL EVALUATORS
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Equivalence scoring and resumable full runs" : "等价判分与可恢复全量运行"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Pinned Math-Verify scoring, sample checkpoints, and protocol-parity adapters for MMMU, MathVista, MMBench, and Video-MME v2. Full multimodal execution remains a separate evidence gate."
              : "固定 Math-Verify 判分、逐题 checkpoint，并接入 MMMU、MathVista、MMBench、Video-MME v2 协议适配；多模态全量执行仍保持独立证据门槛。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={pending}
            className="border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-60"
          >
            {pending ? (en ? "Checking..." : "检查中...") : en ? "Run evaluator checks" : "运行判分验收"}
          </button>
          <button
            type="button"
            onClick={() => void launch(false)}
            disabled={pending || payload?.officialRun.active}
            className="border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/20 disabled:opacity-60"
          >
            {en ? "Run all 500" : "运行完整 500 题"}
          </button>
          {progress && !payload?.officialRun.active && progress.status !== "completed" ? (
            <button
              type="button"
              onClick={() => void launch(true)}
              disabled={pending}
              className="border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/20 disabled:opacity-60"
            >
              {en ? "Resume" : "断点续跑"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Math-Verify</p>
          <p className={`mt-1 text-sm font-semibold ${payload?.mathRuntime.available ? "text-emerald-100" : "text-amber-100"}`}>
            {payload?.mathRuntime.available ? `READY · ${payload.mathRuntime.evaluatorVersion}` : "HOLD"}
          </p>
        </div>
        <div className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Acceptance</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {payload?.acceptance
              ? `${payload.acceptance.totals.passed}/${payload.acceptance.totals.slices}`
              : "not run"}
          </p>
        </div>
        <div className="border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] uppercase text-slate-500">Full MATH-500</p>
          <p className={`mt-1 text-sm font-semibold ${payload?.officialRun.latestEvidence?.complete ? "text-emerald-100" : "text-amber-100"}`}>
            {payload?.officialRun.latestEvidence?.complete
              ? `${payload.officialRun.latestEvidence.accuracy}% · 500/500`
              : progress
                ? `${progress.status} · ${progress.completedSamples}/${progress.totalSamples}`
                : "EVIDENCE NEEDED"}
          </p>
        </div>
      </div>

      {progress ? (
        <div className="mt-3 border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="truncate font-mono">{progress.runId}</span>
            <span>{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden bg-slate-900">
            <div className="h-full bg-cyan-300 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(payload?.protocols || []).map((protocol) => (
          <article key={protocol.id} className="border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{protocol.label}</h3>
              <span className="border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">
                adapter {protocol.adapterStatus}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{protocol.detail}</p>
            <p className="mt-2 text-[10px] uppercase text-amber-200">full run {protocol.executionStatus}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
