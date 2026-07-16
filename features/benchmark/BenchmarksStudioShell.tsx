"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { benchmarkDatasets, benchmarkMilestoneSuites } from "@/lib/agent/benchmark-datasets";
import { agentTargets } from "@/lib/agent/catalog";
import type {
  AgentBenchmarkProgress,
  AgentBenchmarkResponse,
  AgentProviderProfile,
  AgentThinkingMode,
} from "@/lib/agent/types";
import type { BenchmarkReleaseEvidenceSummary } from "@/features/benchmark/contracts";
import { useLocale } from "@/components/layout/LocaleProvider";
import {
  StudioSegmentedChips,
  StudioSurface,
} from "@/components/layout/StudioPageShell";

type BenchmarkDashboardRun = {
  id: string;
  runId?: string;
  generatedAt: string;
  prompt: string;
  benchmarkMode?: "prompt" | "dataset" | "suite";
  promptSetLabel?: string;
  datasetLabel?: string;
  suiteLabel?: string;
  contextWindow: number;
  runs: number;
  providerProfile?: string;
  thinkingMode?: string;
  results: Array<{
    targetId: string;
    targetLabel: string;
    execution?: "local" | "remote";
    providerProfile?: string;
    thinkingMode?: string;
    avgFirstTokenLatencyMs: number;
    avgLatencyMs: number;
    avgTokenThroughputTps: number;
    avgScore?: number | null;
    passRate?: number | null;
    okRuns: number;
    runs: number;
  }>;
};

type BenchmarkReleaseEvidence = {
  id: string;
  runId?: string;
  generatedAt: string;
  label?: string;
  note?: string;
  matchSource?: string;
};

type BenchmarkDashboardResponse = {
  generatedAt: string;
  benchmarkHistory?: BenchmarkDashboardRun[];
  releaseEvidence?: BenchmarkReleaseEvidence[];
  benchmarkReleaseEvidenceSummary?: BenchmarkReleaseEvidenceSummary;
};

type BenchmarkPromptSet = {
  id: string;
  label: string;
  description?: string;
  prompts: string[];
};

type BenchmarkPromptSetResponse = {
  promptSets?: BenchmarkPromptSet[];
};

type BenchmarkRunMode = "prompt" | "prompt-set" | "dataset" | "suite";

const defaultBenchmarkTargetIds = agentTargets
  .filter((target) => target.execution === "local")
  .slice(0, 2)
  .map((target) => target.id);
const providerProfileOptions: AgentProviderProfile[] = ["speed", "balanced", "tool-first"];
const thinkingModeOptions: AgentThinkingMode[] = ["standard", "thinking"];

function formatDateTime(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatMetric(value?: number | null, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
}

function summarizeRun(run: BenchmarkDashboardRun, isEnglish: boolean) {
  if (run.benchmarkMode === "suite") {
    return run.suiteLabel || (isEnglish ? "Suite benchmark" : "评测集 benchmark");
  }
  if (run.benchmarkMode === "dataset") {
    return run.datasetLabel || (isEnglish ? "Dataset benchmark" : "Dataset benchmark");
  }
  if (run.promptSetLabel) {
    return run.promptSetLabel;
  }
  return run.prompt;
}

export function BenchmarksStudioShell() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");
  const [data, setData] = useState<BenchmarkDashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(
    defaultBenchmarkTargetIds.length
      ? defaultBenchmarkTargetIds
      : agentTargets.slice(0, 2).map((target) => target.id),
  );
  const [runMode, setRunMode] = useState<BenchmarkRunMode>("prompt");
  const [prompt, setPrompt] = useState(
    "Answer in one concise paragraph: what makes a local LLM setup production-ready?",
  );
  const [promptSets, setPromptSets] = useState<BenchmarkPromptSet[]>([]);
  const [promptSetId, setPromptSetId] = useState("");
  const [datasetId, setDatasetId] = useState(benchmarkDatasets[0]?.id || "");
  const [datasetSampleLimit, setDatasetSampleLimit] = useState(
    benchmarkDatasets[0]?.sampleCount || 1,
  );
  const [suiteId, setSuiteId] = useState(
    benchmarkMilestoneSuites.find((suite) => suite.reportTier === "milestone")?.id ||
      benchmarkMilestoneSuites[0]?.id ||
      "",
  );
  const [runs, setRuns] = useState(1);
  const [contextWindow, setContextWindow] = useState(4096);
  const [providerProfile, setProviderProfile] = useState<AgentProviderProfile>("speed");
  const [thinkingMode, setThinkingMode] = useState<AgentThinkingMode>("standard");
  const [runPending, setRunPending] = useState(false);
  const [runError, setRunError] = useState("");
  const [activeRunId, setActiveRunId] = useState("");
  const [runProgress, setRunProgress] = useState<AgentBenchmarkProgress | null>(null);

  const loadBenchmarks = useCallback(
    async (options?: { keepLoadingState?: boolean; signal?: AbortSignal }) => {
      if (!options?.keepLoadingState) {
        setPending(true);
      }
      setError("");
      try {
        const response = await fetch("/api/admin/dashboard", {
          cache: "no-store",
          signal: options?.signal,
        });
        const payload = (await response.json()) as BenchmarkDashboardResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load benchmark data.");
        }
        setData(payload);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load benchmark data.",
          );
        }
      } finally {
        if (!options?.keepLoadingState) {
          setPending(false);
        }
      }
    },
    [],
  );

  const loadPromptSets = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/benchmark/prompt-sets", {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as BenchmarkPromptSetResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load prompt sets.");
      }
      const nextPromptSets = payload.promptSets || [];
      setPromptSets(nextPromptSets);
      setPromptSetId((current) =>
        current && nextPromptSets.some((entry) => entry.id === current)
          ? current
          : nextPromptSets[0]?.id || "",
      );
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError((current) =>
          current ||
          (loadError instanceof Error
            ? loadError.message
            : "Failed to load prompt sets."),
        );
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBenchmarks({ signal: controller.signal });
    void loadPromptSets(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadBenchmarks, loadPromptSets]);

  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pollProgress() {
      try {
        const response = await fetch(
          `/api/admin/benchmark/progress?runId=${encodeURIComponent(activeRunId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as AgentBenchmarkProgress & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load benchmark progress.");
        }
        if (!cancelled) {
          setRunProgress(payload);
          if (payload.status === "pending" || payload.status === "running") {
            timer = setTimeout(pollProgress, 1500);
          }
        }
      } catch {
        if (!cancelled && runPending) {
          timer = setTimeout(pollProgress, 2500);
        }
      }
    }

    void pollProgress();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeRunId, runPending]);

  const latestRuns = useMemo(
    () => (data?.benchmarkHistory || []).slice(0, 6),
    [data?.benchmarkHistory],
  );
  const releaseEvidence = useMemo(
    () => (data?.releaseEvidence || []).slice(0, 4),
    [data?.releaseEvidence],
  );
  const datasetCount = benchmarkDatasets.length;
  const suiteCount = benchmarkMilestoneSuites.length;
  const selectedTargets = useMemo(
    () => agentTargets.filter((target) => selectedTargetIds.includes(target.id)),
    [selectedTargetIds],
  );
  const selectedDataset = useMemo(
    () => benchmarkDatasets.find((dataset) => dataset.id === datasetId) || null,
    [datasetId],
  );
  const progressPercent =
    runProgress && runProgress.totalSamples > 0
      ? Math.round((runProgress.completedSamples / runProgress.totalSamples) * 100)
      : runPending
        ? 5
        : 0;

  function toggleTarget(targetId: string) {
    setSelectedTargetIds((current) =>
      current.includes(targetId)
        ? current.filter((id) => id !== targetId)
        : [...current, targetId],
    );
  }

  async function handleRunBenchmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunError("");
    setRunProgress(null);
    const normalizedPrompt = prompt.trim();
    if (!selectedTargetIds.length) {
      setRunError(isEnglish ? "Select at least one target." : "至少选择一个目标。");
      return;
    }
    if (runMode === "prompt" && !normalizedPrompt) {
      setRunError(isEnglish ? "Prompt is required." : "需要填写 prompt。");
      return;
    }
    if (runMode === "prompt-set" && !promptSetId) {
      setRunError(isEnglish ? "Select a prompt set." : "请选择 prompt set。");
      return;
    }
    if (runMode === "dataset" && !datasetId) {
      setRunError(isEnglish ? "Select a dataset." : "请选择 dataset。");
      return;
    }
    if (runMode === "suite" && !suiteId) {
      setRunError(isEnglish ? "Select a milestone suite." : "请选择里程碑评测集。");
      return;
    }
    const runId = `bench-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setActiveRunId(runId);
    setRunPending(true);
    try {
      const response = await fetch("/api/admin/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          benchmarkMode:
            runMode === "dataset" ? "dataset" : runMode === "suite" ? "suite" : "prompt",
          prompt: runMode === "prompt" ? normalizedPrompt : undefined,
          promptSetId: runMode === "prompt-set" ? promptSetId : undefined,
          datasetId: runMode === "dataset" ? datasetId : undefined,
          datasetSampleLimit: runMode === "dataset" ? datasetSampleLimit : undefined,
          suiteId: runMode === "suite" ? suiteId : undefined,
          targetIds: selectedTargetIds,
          runs,
          contextWindow,
          providerProfile,
          thinkingMode,
          runNote: `Started from /benchmarks (${runMode}).`,
        }),
      });
      const payload = (await response.json()) as AgentBenchmarkResponse & {
        error?: string;
        warning?: string;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.warning || "Benchmark run failed.");
      }
      setData((current) => ({
        generatedAt: payload.generatedAt,
        benchmarkHistory: [
          {
            id: payload.runId || runId,
            runId: payload.runId || runId,
            generatedAt: payload.generatedAt,
            prompt: payload.prompt,
            benchmarkMode: payload.benchmarkMode,
            promptSetLabel: payload.promptSetLabel,
            datasetLabel: payload.datasetLabel,
            suiteLabel: payload.suiteLabel,
            contextWindow: payload.contextWindow,
            runs: payload.runs,
            providerProfile: payload.providerProfile,
            thinkingMode: payload.thinkingMode,
            results: payload.results,
          },
          ...(current?.benchmarkHistory || []),
        ],
        releaseEvidence: current?.releaseEvidence || [],
      }));
      void loadBenchmarks({ keepLoadingState: true });
    } catch (submitError) {
      setRunError(
        submitError instanceof Error
          ? submitError.message
          : "Benchmark run failed.",
      );
    } finally {
      setRunPending(false);
    }
  }

  return (
    <StudioSurface
      accent="amber"
      className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]"
    >
        <aside className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_26px_70px_rgba(2,6,23,0.45)] backdrop-blur">
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300">
              BENCHMARKS
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              {isEnglish ? "Benchmark runs and release evidence" : "Benchmark 运行与发布证据"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-100/75">
              {isEnglish
                ? "Run checks from the foreground studio, then keep release evidence and regression history beside the controls."
                : "从前台工作台发起评测，把发布证据、回归历史和运行控制放在同一个 side rail。"}
            </p>
          </div>
          <div className="mt-4">
            <StudioSegmentedChips
              wide={false}
              labels={[
                isEnglish ? "Run controls" : "运行控制",
                isEnglish ? "Evidence" : "发布证据",
                isEnglish ? "Regression" : "回归监控",
              ]}
            />
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {isEnglish ? "Built-in datasets" : "内置数据集"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{datasetCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {isEnglish ? "Milestone suites" : "里程碑评测集"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{suiteCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {isEnglish ? "Recent runs" : "最近运行"}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {data?.benchmarkHistory?.length || 0}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/compare"
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
            >
              {isEnglish ? "Compare" : "对比"}
            </Link>
          </div>
          <form
            onSubmit={handleRunBenchmark}
            className="mt-5 space-y-4 border-t border-white/10 pt-5"
          >
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {isEnglish ? "Workload" : "运行模式"}
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["prompt", isEnglish ? "Prompt" : "自定义"],
                    ["prompt-set", "Prompt set"],
                    ["dataset", "Dataset"],
                    ["suite", isEnglish ? "Suite" : "评测集"],
                  ] as Array<[BenchmarkRunMode, string]>
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRunMode(mode)}
                    className={`min-h-9 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      runMode === mode
                        ? "border-amber-300/35 bg-amber-300/15 text-amber-100"
                        : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {runMode === "prompt" ? (
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-amber-300/40"
                />
              </div>
            ) : null}

            {runMode === "prompt-set" ? (
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                Prompt set
                <select
                  value={promptSetId}
                  onChange={(event) => setPromptSetId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-amber-300/40"
                >
                  {promptSets.map((promptSet) => (
                    <option key={promptSet.id} value={promptSet.id}>
                      {promptSet.label} · {promptSet.prompts.length}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {runMode === "dataset" ? (
              <div className="space-y-3">
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                  Dataset
                  <select
                    value={datasetId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const nextDataset = benchmarkDatasets.find((entry) => entry.id === nextId);
                      setDatasetId(nextId);
                      setDatasetSampleLimit(nextDataset?.sampleCount || 1);
                    }}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-amber-300/40"
                  >
                    {benchmarkDatasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                  {isEnglish ? "Samples" : "采样数"}
                  <input
                    type="number"
                    min={1}
                    max={selectedDataset?.sampleCount || 1}
                    value={datasetSampleLimit}
                    onChange={(event) =>
                      setDatasetSampleLimit(
                        Math.max(
                          1,
                          Math.min(
                            selectedDataset?.sampleCount || 1,
                            Number(event.target.value) || 1,
                          ),
                        ),
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-amber-300/40"
                  />
                </label>
              </div>
            ) : null}

            {runMode === "suite" ? (
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                {isEnglish ? "Milestone suite" : "里程碑评测集"}
                <select
                  value={suiteId}
                  onChange={(event) => setSuiteId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm normal-case text-slate-100 outline-none focus:border-amber-300/40"
                >
                  {benchmarkMilestoneSuites.map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.label} · {suite.workloads.length}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-white">
                  {isEnglish ? "Run controls" : "运行控制"}
                </label>
                <span className="text-xs text-slate-500">
                  {selectedTargets.length} {isEnglish ? "selected" : "已选"}
                </span>
              </div>
              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                {agentTargets.map((target) => (
                  <label
                    key={target.id}
                    className="flex cursor-pointer items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:bg-white/[0.07]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTargetIds.includes(target.id)}
                      onChange={() => toggleTarget(target.id)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-amber-300"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-100">
                        {target.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        {target.execution} · {target.providerLabel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Runs
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={runs}
                  onChange={(event) =>
                    setRuns(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Context
                <input
                  type="number"
                  min={1024}
                  step={1024}
                  value={contextWindow}
                  onChange={(event) =>
                    setContextWindow(Math.max(1024, Number(event.target.value) || 4096))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Provider
                <select
                  value={providerProfile}
                  onChange={(event) =>
                    setProviderProfile(event.target.value as AgentProviderProfile)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
                >
                  {providerProfileOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Thinking
                <select
                  value={thinkingMode}
                  onChange={(event) =>
                    setThinkingMode(event.target.value as AgentThinkingMode)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300/40"
                >
                  {thinkingModeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {runProgress || runPending ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-amber-100">
                  <span>{runProgress?.status || (isEnglish ? "starting" : "启动中")}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/70">
                  <div
                    className="h-full rounded-full bg-amber-300 transition-all"
                    style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
                  />
                </div>
                {runProgress ? (
                  <p className="mt-2 text-xs text-amber-100/80">
                    {runProgress.completedSamples}/{runProgress.totalSamples} samples
                    {runProgress.lastCompletedTargetLabel
                      ? ` · ${runProgress.lastCompletedTargetLabel}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            {runError ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {runError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={runPending}
              className="w-full rounded-full border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runPending
                ? isEnglish
                  ? "Running..."
                  : "运行中..."
                : isEnglish
                  ? "Start benchmark"
                  : "开始 benchmark"}
            </button>
          </form>
        </aside>

        <section className="min-w-0 rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_26px_70px_rgba(2,6,23,0.45)] backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm text-slate-300">
                {isEnglish ? "Latest benchmark evidence" : "最新 benchmark 证据"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {pending
                  ? isEnglish
                    ? "Loading..."
                    : "加载中..."
                  : `${isEnglish ? "Updated" : "更新于"} ${formatDateTime(data?.generatedAt)}`}
              </p>
            </div>
            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
            <div className="space-y-3">
              {latestRuns.length ? (
                latestRuns.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">
                            {summarizeRun(run, isEnglish)}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                            {run.benchmarkMode || "prompt"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDateTime(run.generatedAt)} · {run.runs} runs ·{" "}
                          {run.contextWindow >= 1024
                            ? `${Math.round(run.contextWindow / 1024)}K`
                            : run.contextWindow}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          {run.providerProfile || "default"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          {run.thinkingMode || "standard"}
                        </span>
                        <a
                          href={`/api/admin/benchmark/export?format=issue-summary&runId=${encodeURIComponent(run.runId || run.id)}`}
                          className="border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-semibold text-cyan-100 hover:bg-cyan-300/20"
                        >
                          {isEnglish ? "Issue summary" : "Issue 摘要"}
                        </a>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {run.results.slice(0, 4).map((result) => (
                        <div
                          key={`${run.id}:${result.targetId}:${result.providerProfile || "default"}:${result.thinkingMode || "standard"}`}
                          className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {result.targetLabel}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                {result.execution || "remote"} · {result.okRuns}/{result.runs}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-emerald-200">
                              {typeof result.passRate === "number"
                                ? `${result.passRate.toFixed(0)}%`
                                : "--"}
                            </p>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                            <div>
                              <p className="text-slate-500">FT</p>
                              <p className="mt-1 text-slate-100">
                                {formatMetric(result.avgFirstTokenLatencyMs, "ms")}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Total</p>
                              <p className="mt-1 text-slate-100">
                                {formatMetric(result.avgLatencyMs, "ms")}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">TPS</p>
                              <p className="mt-1 text-slate-100">
                                {formatMetric(result.avgTokenThroughputTps)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-500">
                  {pending
                    ? isEnglish
                      ? "Loading benchmark history..."
                      : "正在加载 benchmark 历史..."
                    : isEnglish
                      ? "No benchmark runs yet."
                      : "暂无 benchmark 运行。"}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              {data?.benchmarkReleaseEvidenceSummary ? (
                <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {isEnglish ? "Release note summary" : "发布说明摘要"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-cyan-100/70">
                        {isEnglish
                          ? "Pinned evidence grouped from stored benchmark runs."
                          : "从已固定 benchmark run 自动生成的分组摘要。"}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100">
                      {data.benchmarkReleaseEvidenceSummary.totals.groupCount}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {isEnglish ? "Matched" : "已匹配"}
                      </p>
                      <p className="mt-1 font-semibold text-white">
                        {data.benchmarkReleaseEvidenceSummary.totals.matchedRunCount}/
                        {data.benchmarkReleaseEvidenceSummary.totals.evidenceCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {isEnglish ? "Success" : "成功率"}
                      </p>
                      <p className="mt-1 font-semibold text-white">
                        {data.benchmarkReleaseEvidenceSummary.totals.successRatePct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {data.benchmarkReleaseEvidenceSummary.releaseNoteDraft.slice(0, 2).map((line) => (
                      <p
                        key={line}
                        className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">
                  {isEnglish ? "Release evidence" : "发布证据"}
                </p>
                <div className="mt-3 space-y-3">
                  {releaseEvidence.length ? (
                    releaseEvidence.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-100">
                            {entry.label || entry.runId || entry.id}
                          </p>
                          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">
                            {entry.matchSource || "recent"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDateTime(entry.generatedAt)}
                        </p>
                        {entry.note ? (
                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      {pending
                        ? isEnglish
                          ? "Loading..."
                          : "加载中..."
                        : isEnglish
                          ? "No pinned evidence yet."
                          : "暂无固定发布证据。"}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
    </StudioSurface>
  );
}
