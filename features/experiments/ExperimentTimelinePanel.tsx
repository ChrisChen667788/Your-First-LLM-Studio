"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  ExperimentEvent,
  ExperimentEventKind,
  ExperimentEventStatus,
  ExperimentRetentionPolicy,
  ExperimentRetentionResult,
} from "@/features/experiments/contracts";
import { resolveExperimentLinkHref } from "@/features/experiments/navigation";

type ExperimentTimelinePanelProps = {
  locale: string;
  showRetention?: boolean;
};

type TimelineResponse = {
  ok?: boolean;
  error?: string;
  events?: ExperimentEvent[];
};

type KindFilter = "all" | ExperimentEventKind;
type StatusFilter = "all" | "active" | "success" | "failed";

const KIND_FILTERS: KindFilter[] = [
  "all",
  "session",
  "compare",
  "benchmark",
  "finetune",
  "retrieval",
  "model",
  "provider",
];
const STATUS_FILTERS: StatusFilter[] = ["all", "active", "success", "failed"];

function formatDateTime(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusMatchesFilter(
  status: ExperimentEventStatus,
  filter: StatusFilter,
) {
  if (filter === "all") return true;
  if (filter === "active") return status === "started";
  if (filter === "success") return status === "completed" || status === "saved";
  return status === "failed" || status === "cancelled" || status === "conflict";
}

function statusTone(status: ExperimentEventStatus) {
  if (status === "completed" || status === "saved") {
    return "bg-emerald-400/10 text-emerald-100";
  }
  if (status === "failed" || status === "conflict") {
    return "bg-rose-400/10 text-rose-100";
  }
  if (status === "started") return "bg-cyan-400/10 text-cyan-100";
  return "bg-amber-400/10 text-amber-100";
}

function metadataChips(metadata?: ExperimentEvent["metadata"]) {
  if (!metadata) return [] as string[];
  const preferred = [
    "source",
    "sourceType",
    "adapterName",
    "datasetLabel",
    "benchmarkMode",
    "suiteId",
    "suiteLabel",
    "profileBatchScope",
    "targetCount",
    "laneCount",
    "okLanes",
    "sampleCount",
    "totalSteps",
    "runId",
  ];
  const chips: string[] = [];
  for (const key of preferred) {
    const value = metadata[key];
    if (value === undefined || value === null || value === "") continue;
    chips.push(`${key}: ${String(value)}`);
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (chips.length >= 8) break;
    if (preferred.includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string" && value.length > 80) continue;
    chips.push(`${key}: ${String(value)}`);
  }
  return chips.slice(0, 8);
}

export function ExperimentTimelinePanel({
  locale,
  showRetention = false,
}: ExperimentTimelinePanelProps) {
  const text = useMemo(() => {
    if (locale.startsWith("en")) {
      return {
        eyebrow: "Unified activity timeline",
        title: "Unified experiment and operations timeline",
        subtitle:
          "Track sessions, runs, retrieval, model installs, provider health, artifacts, and upstream/downstream links on one rail.",
        refresh: "Refresh",
        loading: "Loading...",
        empty: "No timeline events match the current filters.",
        all: "All",
        active: "Active",
        success: "Success",
        failed: "Needs review",
        session: "Session",
        compare: "Compare",
        benchmark: "Benchmark",
        finetune: "Fine-tune",
        retrieval: "Retrieval",
        model: "Models",
        provider: "Provider",
        targets: "Targets",
        metadata: "Run metadata",
        artifacts: "Artifacts",
        links: "Cross-links",
        retention: "Retention policy",
        applyRetention: "Apply retention",
        maxEvents: "Recent event cap",
        maxAgeDays: "Max age (days)",
        preserveFailures: "Preserve failures",
        preserveArtifacts: "Preserve artifact events",
        retentionFailed: "Retention update failed.",
      };
    }
    return {
      eyebrow: "统一活动时间线",
      title: "统一实验与运维时间线",
      subtitle:
        "把 Session、运行、检索、模型安装、Provider Health、产物与上下游关系串成一条可追踪时间线。",
      refresh: "刷新",
      loading: "加载中...",
      empty: "当前筛选下暂无时间线事件。",
      all: "全部",
      active: "运行中",
      success: "成功",
      failed: "需处理",
      session: "Session",
      compare: "Compare",
      benchmark: "Benchmark",
      finetune: "Fine-tune",
      retrieval: "检索",
      model: "模型",
      provider: "Provider",
      targets: "目标",
      metadata: "运行元数据",
      artifacts: "产物",
      links: "上下游关联",
      retention: "保留策略",
      applyRetention: "执行保留策略",
      maxEvents: "近期事件上限",
      maxAgeDays: "最长保留天数",
      preserveFailures: "保护失败事件",
      preserveArtifacts: "保护带产物事件",
      retentionFailed: "保留策略执行失败。",
    };
  }, [locale]);

  const [events, setEvents] = useState<ExperimentEvent[]>([]);
  const [pending, setPending] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [retentionPending, setRetentionPending] = useState(false);
  const [retentionError, setRetentionError] = useState("");
  const [retentionResult, setRetentionResult] =
    useState<ExperimentRetentionResult | null>(null);
  const [retentionPolicy, setRetentionPolicy] = useState<ExperimentRetentionPolicy>({
    maxEvents: 500,
    maxAgeDays: 90,
    preserveFailures: true,
    preserveArtifacts: true,
  });

  const loadTimeline = useCallback(async () => {
    setPending(true);
    try {
      const response = await fetch("/api/experiments?limit=120", {
        cache: "no-store",
      });
      const payload = (await response.json()) as TimelineResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load timeline.");
      }
      setEvents(payload.events || []);
    } finally {
      setPending(false);
    }
  }, []);

  const applyRetention = useCallback(async () => {
    setRetentionPending(true);
    setRetentionError("");
    try {
      const response = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-retention", policy: retentionPolicy }),
      });
      const payload = (await response.json()) as {
        error?: string;
        retention?: ExperimentRetentionResult;
      };
      if (!response.ok || !payload.retention) {
        throw new Error(payload.error || "Retention failed.");
      }
      setRetentionResult(payload.retention);
      await loadTimeline();
    } catch (error) {
      setRetentionError(
        error instanceof Error ? error.message : text.retentionFailed,
      );
    } finally {
      setRetentionPending(false);
    }
  }, [loadTimeline, retentionPolicy, text.retentionFailed]);

  useEffect(() => {
    void loadTimeline();
    const timer = window.setInterval(() => {
      void loadTimeline();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadTimeline]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const kindOk = kindFilter === "all" || event.kind === kindFilter;
        return kindOk && statusMatchesFilter(event.status, statusFilter);
      }),
    [events, kindFilter, statusFilter],
  );

  const kindLabel = useCallback(
    (kind: KindFilter) => {
      if (kind === "all") return text.all;
      return text[kind];
    },
    [text],
  );

  const statusLabel = useCallback(
    (status: StatusFilter) => {
      if (status === "all") return text.all;
      return text[status];
    },
    [text],
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            {text.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{text.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {text.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTimeline()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {pending ? text.loading : text.refresh}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                kindFilter === kind
                  ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-50"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {kindLabel(kind)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                statusFilter === status
                  ? "border-violet-300/40 bg-violet-400/15 text-violet-50"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {showRetention ? (
        <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/[0.035] p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                {text.retention}
              </p>
              {retentionResult ? (
                <p className="mt-2 text-xs text-slate-400">
                  {retentionResult.beforeCount} → {retentionResult.afterCount} · {retentionResult.removedCount} removed · {retentionResult.protectedCount} protected
                </p>
              ) : null}
              {retentionError ? (
                <p className="mt-2 text-xs text-rose-200">{retentionError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-400">
                <span className="mb-1 block">{text.maxEvents}</span>
                <input type="number" min={50} max={5000} value={retentionPolicy.maxEvents} onChange={(event) => setRetentionPolicy((current) => ({ ...current, maxEvents: Number(event.target.value) }))} className="w-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <label className="text-xs text-slate-400">
                <span className="mb-1 block">{text.maxAgeDays}</span>
                <input type="number" min={7} max={730} value={retentionPolicy.maxAgeDays} onChange={(event) => setRetentionPolicy((current) => ({ ...current, maxAgeDays: Number(event.target.value) }))} className="w-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
              </label>
              <label className="flex items-center gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={retentionPolicy.preserveFailures} onChange={(event) => setRetentionPolicy((current) => ({ ...current, preserveFailures: event.target.checked }))} />{text.preserveFailures}</label>
              <label className="flex items-center gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={retentionPolicy.preserveArtifacts} onChange={(event) => setRetentionPolicy((current) => ({ ...current, preserveArtifacts: event.target.checked }))} />{text.preserveArtifacts}</label>
              <button type="button" disabled={retentionPending} onClick={() => void applyRetention()} className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/20 disabled:cursor-wait disabled:opacity-60">
                {retentionPending ? text.loading : text.applyRetention}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {filteredEvents.length ? (
          filteredEvents.map((event) => {
            const chips = metadataChips(event.metadata);
            return (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
                      {text[event.kind]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${statusTone(
                        event.status,
                      )}`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {formatDateTime(event.at)}
                  </p>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">
                  {event.title}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-300">
                  {event.summary}
                </p>
                {event.targetIds?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {text.targets}: {event.targetIds.length}
                    </span>
                    {event.targetIds.slice(0, 3).map((targetId) => (
                      <span
                        key={targetId}
                        className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/5 px-2 py-0.5"
                      >
                        {targetId}
                      </span>
                    ))}
                  </div>
                ) : null}
                {chips.length ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {text.metadata}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className="max-w-full truncate rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-slate-300"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {event.artifacts?.length ? (
                  <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.035] p-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">
                      {text.artifacts} · {event.artifacts.length}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {event.artifacts.slice(0, 4).map((artifact, index) => {
                        const label = `${artifact.role} · ${artifact.label}`;
                        return artifact.kind === "api" || artifact.kind === "url" ? (
                          <a
                            key={`${artifact.uri}:${index}`}
                            href={artifact.uri}
                            target={artifact.kind === "url" ? "_blank" : undefined}
                            rel={artifact.kind === "url" ? "noreferrer" : undefined}
                            className="block truncate text-[11px] text-cyan-100 transition hover:text-white"
                            title={artifact.uri}
                          >
                            {label}
                          </a>
                        ) : (
                          <p
                            key={`${artifact.uri}:${index}`}
                            className="truncate text-[11px] text-slate-300"
                            title={artifact.uri}
                          >
                            {label}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {event.links?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.links.slice(0, 6).map((link) => {
                      const href = resolveExperimentLinkHref(link);
                      const label = `${link.relation} · ${link.entityType} · ${link.label || link.id}`;
                      return href ? (
                        <Link key={`${link.relation}:${link.entityType}:${link.id}`} href={href} className="max-w-full truncate rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-2 py-1 text-[10px] text-violet-100 transition hover:bg-violet-400/15" title={link.id}>
                          {label}
                        </Link>
                      ) : (
                        <span key={`${link.relation}:${link.entityType}:${link.id}`} className="max-w-full truncate rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-2 py-1 text-[10px] text-violet-100" title={link.id}>{label}</span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{text.empty}</p>
        )}
      </div>
    </div>
  );
}
