"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VersionStatus = "complete" | "local-ready" | "in-progress" | "externally-blocked";
type VersionGate = {
  version: string;
  label: string;
  status: VersionStatus;
  localReady: boolean;
  productionReady: boolean;
  releaseCompletionPct: number;
  route: string;
  summary: string;
  layers: { hardening: number; acceptance: number; lifecycle: number; ready: number; total: number };
  localBlockers: string[];
  externalBlockers: string[];
};
type Payload = {
  ok: true;
  versions: VersionGate[];
  totals: {
    versions: number;
    complete: number;
    localReady: number;
    inProgress: number;
    externallyBlocked: number;
    locallyReadyVersions: number;
    productionReadyVersions: number;
    averageReleaseCompletionPct: number;
  };
};

function tone(status: VersionStatus) {
  if (status === "complete") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "local-ready") return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
  if (status === "externally-blocked") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  return "border-amber-300/30 bg-amber-400/10 text-amber-100";
}

export function PostV1PromotionGatePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/experiments/post-v1-promotion-gate", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as Payload & { error?: string };
        if (!response.ok) throw new Error(body.error || "Failed to load post-v1 promotion evidence.");
        setPayload(body);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Failed to load post-v1 promotion evidence."));
  }, []);

  return (
    <section id="post-v1-promotion-gate" className="border border-cyan-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">POST-V1 PROMOTION GATE</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Ten-version productization desk" : "十版本产品化晋级台"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Combines foundation, hardening, product acceptance, and operational lifecycle evidence without treating local fixtures as external production proof."
              : "汇总 foundation、hardening、产品验收和运营生命周期证据，同时避免把本地 fixture 当成外部生产证明。"}
          </p>
        </div>
        {payload ? (
          <div className="grid min-w-72 grid-cols-3 border border-white/10 bg-black/25 text-center">
            <div className="border-r border-white/10 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Local</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">{payload.totals.locallyReadyVersions}/{payload.totals.versions}</p>
            </div>
            <div className="border-r border-white/10 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Production</p>
              <p className="mt-1 text-sm font-semibold text-emerald-100">{payload.totals.productionReadyVersions}/{payload.totals.versions}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Average</p>
              <p className="mt-1 text-sm font-semibold text-white">{payload.totals.averageReleaseCompletionPct}%</p>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {payload?.versions.map((entry) => {
          const blocker = entry.localBlockers[0] || entry.externalBlockers[0];
          return (
            <article key={entry.version} className="flex min-h-64 flex-col border border-white/10 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-cyan-300">{entry.version}</p>
                  <h3 className="mt-1 text-sm font-semibold text-white">{entry.label}</h3>
                </div>
                <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${tone(entry.status)}`}>{entry.status}</span>
              </div>
              <div className="mt-3 h-1 bg-white/10">
                <div className="h-full bg-cyan-300" style={{ width: `${entry.releaseCompletionPct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] text-slate-400">
                <span className="border border-white/10 px-1 py-1">H {entry.layers.hardening}</span>
                <span className="border border-white/10 px-1 py-1">A {entry.layers.acceptance}</span>
                <span className="border border-white/10 px-1 py-1">L {entry.layers.lifecycle}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{entry.summary}</p>
              {blocker ? <p className="mt-2 text-xs leading-5 text-amber-200">{blocker}</p> : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="text-[10px] uppercase text-slate-500">{entry.layers.ready}/{entry.layers.total} checks</span>
                <Link href={entry.route} className="border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-400/20">
                  {en ? "Open" : "打开"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
