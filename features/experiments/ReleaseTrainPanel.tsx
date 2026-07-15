"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ReleaseTrainMilestone,
  ReleaseTrainResponse,
  ReleaseTrainStatus,
} from "@/features/experiments/contracts";

type ReleaseTrainPanelProps = {
  locale: string;
};

type ReleaseTrainPayload = Partial<ReleaseTrainResponse> & {
  error?: string;
};

function statusClass(status: ReleaseTrainStatus) {
  if (status === "active") return "border-cyan-300/30 bg-cyan-400/15 text-cyan-50";
  if (status === "complete") return "border-emerald-300/30 bg-emerald-400/15 text-emerald-50";
  if (status === "blocked") return "border-rose-300/30 bg-rose-400/15 text-rose-50";
  if (status === "evidence-needed") return "border-amber-300/30 bg-amber-300/15 text-amber-50";
  return "border-white/10 bg-white/5 text-slate-300";
}

function compactScope(milestone: ReleaseTrainMilestone) {
  return milestone.scope.slice(0, 3);
}

export function ReleaseTrainPanel({ locale }: ReleaseTrainPanelProps) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<ReleaseTrainResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const text = useMemo(
    () => ({
      eyebrow: en ? "Release train" : "版本列车",
      title: en ? "Product release roadmap" : "产品版本路线图",
      subtitle: en
        ? "A live contract spanning the completed foundation, current gates, and post-v1 product train. Each card carries scope, acceptance, evidence, and the next implementation slice."
        : "覆盖既有基础、当前门槛和 post-v1 产品列车的实时契约。每个版本都带范围、验收、证据与下一段实现切片。",
      refresh: en ? "Refresh" : "刷新",
      loading: en ? "Loading..." : "加载中...",
      active: en ? "Active" : "进行中",
      complete: en ? "Complete" : "已完成",
      planned: en ? "Planned" : "计划中",
      blocked: en ? "Blocked" : "阻塞",
      evidence: en ? "Evidence needed" : "待补证据",
      acceptance: en ? "Acceptance" : "验收",
      next: en ? "Next slice" : "下一刀",
      empty: en ? "No release train is available." : "暂无版本列车数据。",
    }),
    [en],
  );

  const statusLabel = useCallback(
    (status: ReleaseTrainStatus) => {
      if (status === "active") return text.active;
      if (status === "complete") return text.complete;
      if (status === "blocked") return text.blocked;
      if (status === "evidence-needed") return text.evidence;
      return text.planned;
    },
    [text.active, text.blocked, text.complete, text.evidence, text.planned],
  );

  const loadTrain = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/release-train", {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as ReleaseTrainPayload;
      if (!response.ok || !nextPayload.ok || !nextPayload.milestones) {
        throw new Error(nextPayload.error || "Failed to load release train.");
      }
      setPayload(nextPayload as ReleaseTrainResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load release train.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void loadTrain();
  }, [loadTrain]);

  const milestones = payload?.milestones || [];

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">
            {text.eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{text.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {text.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTrain()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          {pending ? text.loading : text.refresh}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-5">
        {milestones.length ? (
          milestones.map((milestone) => (
            <article
              key={milestone.version}
              className="rounded-[26px] border border-white/10 bg-black/25 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{milestone.version}</p>
                  <p className="mt-1 text-xs text-slate-400">{milestone.label}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusClass(
                    milestone.status,
                  )}`}
                >
                  {statusLabel(milestone.status)}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
                {milestone.objective}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  {milestone.track}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300">
                  {milestone.targetWindow}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {compactScope(milestone).map((item) => (
                  <p key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300">
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">
                  {text.next}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-50">{milestone.nextSlice}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
            {text.empty}
          </p>
        )}
      </div>
    </section>
  );
}
