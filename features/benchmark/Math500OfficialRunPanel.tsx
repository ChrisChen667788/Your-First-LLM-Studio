"use client";

import { useCallback, useEffect, useState } from "react";

import { BENCHMARK_OFFICIAL_RUNS_API_PATH } from "@/features/benchmark/contracts";
import type { OfficialBenchmarkRunReadModel } from "@/features/benchmark/official-run-contracts";

const LAUNCH_HEARTBEAT_DELAY_MS = 750;

function waitForLaunchHeartbeat() {
  return new Promise((resolve) =>
    window.setTimeout(resolve, LAUNCH_HEARTBEAT_DELAY_MS),
  );
}

export function Math500OfficialRunPanel({ isEnglish }: { isEnglish: boolean }) {
  const [model, setModel] = useState<OfficialBenchmarkRunReadModel | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(BENCHMARK_OFFICIAL_RUNS_API_PATH, {
      cache: "no-store",
    });
    const body = (await response.json()) as OfficialBenchmarkRunReadModel & {
      error?: string;
    };
    if (!response.ok || body.ok !== true) {
      throw new Error(body.error || "Failed to load official run status.");
    }
    setModel(body);
  }, []);

  const launch = useCallback(
    async (action: "start" | "resume") => {
      setPending(true);
      setError("");
      try {
        const response = await fetch(BENCHMARK_OFFICIAL_RUNS_API_PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            runId:
              action === "resume" ? model?.latestProgress?.runId : undefined,
            targetId: "local-qwen3-0.6b",
            maxTokens: 512,
          }),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error || "Failed to launch official run.");
        }
        await waitForLaunchHeartbeat();
        await load();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to launch official run.",
        );
      } finally {
        setPending(false);
      }
    },
    [load, model?.latestProgress?.runId],
  );

  useEffect(() => {
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Failed to load official run."),
    );
  }, [load]);

  useEffect(() => {
    if (!model?.active) return;
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, model?.active]);

  const progress = model?.latestProgress;
  const evidence = model?.latestEvidence;
  const progressPercent = progress?.totalSamples
    ? Math.round((progress.completedSamples / progress.totalSamples) * 100)
    : 0;
  const canResume =
    progress &&
    !model?.active &&
    progress.status !== "completed" &&
    progress.completedSamples < progress.totalSamples;

  return (
    <section className="mt-4 border border-cyan-300/15 bg-cyan-300/[0.035] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {isEnglish ? "Full MATH-500 execution" : "MATH-500 全量执行"}
            </p>
            <span className="border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-100">
              Math-Verify 0.9.0
            </span>
            <span className={`border px-2 py-0.5 text-[10px] ${evidence?.complete ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>
              {evidence?.complete ? "500/500 PASS" : "evidence needed"}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            {isEnglish
              ? "Runs every qualified item on the local Qwen3 0.6B target. Per-sample checkpoints make service restarts resumable without repeating completed inference."
              : "在本地 Qwen3 0.6B 上运行全部资格化题目；逐题 checkpoint 支持服务中断后续跑，不重复已完成推理。"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canResume ? (
            <button
              type="button"
              onClick={() => void launch("resume")}
              disabled={pending}
              className="border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-300/20 disabled:opacity-50"
            >
              {isEnglish ? "Resume" : "断点续跑"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void launch("start")}
            disabled={pending || model?.active}
            className="border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-300/20 disabled:opacity-50"
          >
            {model?.active
              ? isEnglish
                ? "Running..."
                : "运行中..."
              : isEnglish
                ? "Run all 500"
                : "运行完整 500 题"}
          </button>
        </div>
      </div>

      {progress ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <span className="truncate font-mono">{progress.runId}</span>
            <span>{progress.completedSamples}/{progress.totalSamples} · {progressPercent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden bg-slate-950/80">
            <div className="h-full bg-cyan-300 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      {evidence ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-3 font-mono text-[10px] text-slate-400">
          <span>{evidence.resolvedModel}</span>
          <span>{evidence.scoredSamples} scored</span>
          <span>{evidence.correctSamples} correct</span>
          <span>{evidence.accuracy ?? "--"}% accuracy</span>
          <span>{evidence.resumedSamples} resumed</span>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
    </section>
  );
}
