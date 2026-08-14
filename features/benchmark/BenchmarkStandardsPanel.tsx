"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BENCHMARK_QUALIFICATION_API_PATH,
  BENCHMARK_STANDARDS_API_PATH,
} from "@/features/benchmark/contracts";
import type {
  BenchmarkQualificationReadModel,
  QualifiedBenchmarkDatasetSummary,
} from "@/features/benchmark/qualification-contracts";
import type { BenchmarkStandardsReadModel } from "@/features/benchmark/standards-contracts";

export function BenchmarkStandardsPanel({
  isEnglish,
  onQualifiedDatasetChange,
}: {
  isEnglish: boolean;
  onQualifiedDatasetChange?: (
    dataset: QualifiedBenchmarkDatasetSummary | null,
  ) => void;
}) {
  const [model, setModel] = useState<BenchmarkStandardsReadModel | null>(null);
  const [qualification, setQualification] =
    useState<BenchmarkQualificationReadModel | null>(null);
  const [pending, setPending] = useState(true);
  const [qualificationPending, setQualificationPending] = useState(true);
  const [error, setError] = useState("");
  const [qualificationError, setQualificationError] = useState("");

  const load = useCallback(async (manual = false, signal?: AbortSignal) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        manual ? BENCHMARK_STANDARDS_API_PATH : `${BENCHMARK_STANDARDS_API_PATH}?refresh=auto`,
        {
          method: manual ? "POST" : "GET",
          headers: manual ? { "Content-Type": "application/json" } : undefined,
          body: manual ? JSON.stringify({ action: "refresh" }) : undefined,
          cache: "no-store",
          signal,
        },
      );
      const payload = (await response.json()) as BenchmarkStandardsReadModel & {
        error?: string;
      };
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error || "Failed to load benchmark standards.");
      }
      setModel(payload);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load benchmark standards.",
        );
      }
    } finally {
      setPending(false);
    }
  }, []);

  const loadQualification = useCallback(
    async (
      action?: "qualify" | "reverify",
      signal?: AbortSignal,
    ) => {
      setQualificationPending(true);
      setQualificationError("");
      try {
        const response = await fetch(BENCHMARK_QUALIFICATION_API_PATH, {
          method: action ? "POST" : "GET",
          headers: action ? { "Content-Type": "application/json" } : undefined,
          body: action ? JSON.stringify({ action }) : undefined,
          cache: "no-store",
          signal,
        });
        const payload = (await response.json()) as BenchmarkQualificationReadModel & {
          error?: string;
        };
        if (!response.ok || payload.ok !== true) {
          throw new Error(
            payload.error || "Failed to load benchmark qualification.",
          );
        }
        setQualification(payload);
        onQualifiedDatasetChange?.(payload.qualifiedDataset);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setQualificationError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load benchmark qualification.",
          );
        }
      } finally {
        setQualificationPending(false);
      }
    },
    [onQualifiedDatasetChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void loadQualification(undefined, controller.signal);
    return () => controller.abort();
  }, [loadQualification]);

  return (
    <section className="border-b border-white/10 pb-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {isEnglish ? "Evaluation standards registry" : "权威评测标准目录"}
            </p>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-100">
              {model?.totals.standards || 0} standards
            </span>
            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-0.5 text-[11px] text-fuchsia-100">
              {model?.totals.multimodal || 0} multimodal
            </span>
          </div>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
            {model?.disclosure ||
              (isEnglish
                ? "Tracking official datasets, evaluator protocols, and upstream revisions."
                : "跟踪官方数据集、评测协议和上游 revision，starter 子集不会冒充正式榜单成绩。")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
        >
          {pending
            ? isEnglish
              ? "Checking..."
              : "检查中..."
            : isEnglish
              ? "Refresh upstream"
              : "刷新上游版本"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">
                MATH-500 · {isEnglish ? "official snapshot" : "官方数据快照"}
              </p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  qualification?.localStatus === "pass"
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                    : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                }`}
              >
                {qualification?.localStatus || "evidence-needed"}
              </span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                full-run evidence separate
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {qualification?.disclosure ||
                (isEnglish
                  ? "Pin, hash, and validate the official 500-row test snapshot before it becomes runnable."
                  : "固定官方 revision、校验 500 行测试集并保存 SHA-256 后，才允许进入可运行数据集。")}
            </p>
            {qualification?.latest ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-500">
                <span>
                  {qualification.totals.passed}/{qualification.totals.checks} checks
                </span>
                <span>{qualification.latest.manifest.rowCount} rows</span>
                <span>{qualification.latest.manifest.revision.slice(0, 12)}</span>
                <span>{qualification.snapshotIntegrity}</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              void loadQualification(
                qualification?.localStatus === "pass" ? "reverify" : "qualify",
              )
            }
            disabled={qualificationPending}
            className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50"
          >
            {qualificationPending
              ? isEnglish
                ? "Verifying..."
                : "校验中..."
              : qualification?.localStatus === "pass"
                ? isEnglish
                  ? "Reverify snapshot"
                  : "复验快照"
                : isEnglish
                  ? "Qualify MATH-500"
                  : "资格化 MATH-500"}
          </button>
        </div>
        {qualificationError ? (
          <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
            {qualificationError}
          </p>
        ) : null}
      </div>
      <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {(model?.standards || []).map((standard) => (
          <article
            key={standard.id}
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={standard.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-slate-100 hover:text-cyan-100"
                >
                  {standard.label}
                </a>
                <p className="mt-1 text-[11px] text-slate-500">
                  {standard.authority} · {standard.metric}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                  standard.upstream.status === "available"
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                    : standard.upstream.status === "stale"
                      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    : standard.upstream.status === "error"
                      ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                      : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                {standard.upstream.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {standard.modalities.map((modality) => (
                <span
                  key={modality}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {modality}
                </span>
              ))}
              <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                {standard.adapterStatus}
              </span>
            </div>
            <p className="mt-2 truncate font-mono text-[10px] text-slate-500">
              {standard.upstream.revision || "revision not checked"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
