"use client";

import { useCallback, useEffect, useState } from "react";

type Version = {
  version: string;
  label: string;
  sourceStatus: "pass";
  localStatus: "pass" | "hold";
  externalStatus: "hold";
  sourceContracts: string[];
  localEvidence: string;
  externalBlocker: string;
};

type Payload = {
  ok: boolean;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  totals: {
    sourceContractsPassed: number;
    localPassed: number;
    localHeld: number;
  };
  versions: Version[];
  disclosure: string;
  blockers: string[];
  error?: string;
};

export function V1102V1200SourceTrainPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (record = false) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/experiments/v1102-v1200-source-train", {
        method: record ? "POST" : "GET",
        headers: record ? { "content-type": "application/json" } : undefined,
        body: record ? "{}" : undefined,
        cache: "no-store",
      });
      const body = (await response.json()) as Payload & { evidence?: Payload };
      if (!response.ok && response.status !== 422) {
        throw new Error(body.error || "Future source train request failed.");
      }
      setPayload(body.evidence || body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Future source train request failed.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-violet-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-300">
            V1.10.2–V1.12.0 SOURCE TRAIN
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en
              ? "Ten product-control contracts, without false production promotion"
              : "十轮产品控制契约，不虚报生产晋级"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "Runtime recovery, workspace provenance, protected Agent actions, workflow debugging, trusted artifacts, governed RAG, reproducible training, quality policy, and the enterprise control plane are read together. A source contract never substitutes for an external receipt."
              : "运行时恢复、工作区溯源、受保护 Agent 动作、工作流调试、可信产物、受治理 RAG、可复现训练、质量策略和企业控制面统一读取；源码契约不能替代外部回执。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={pending}
          className="shrink-0 border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-50 hover:bg-violet-400/20 disabled:opacity-60"
        >
          {pending
            ? en
              ? "Recording..."
              : "记录中..."
            : en
              ? "Record source gate"
              : "记录源码门禁"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {[
          ["SOURCE", payload ? `${payload.totals.sourceContractsPassed}/10` : "--"],
          ["LOCAL", payload ? `${payload.totals.localPassed}/10` : "--"],
          ["EXTERNAL", "HOLD"],
          ["PRODUCTION", payload?.productionStatus || "hold"],
        ].map(([label, value]) => (
          <article key={label} className="border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {payload?.versions.map((version) => (
          <article
            key={version.version}
            className="min-w-0 border border-white/10 bg-black/25 p-3"
          >
            <p className="text-sm font-semibold text-white">
              {version.version} · {version.label}
            </p>
            <p className="mt-1 text-xs text-violet-200">
              SOURCE PASS · LOCAL {version.localStatus.toUpperCase()} · EXTERNAL HOLD
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {version.sourceContracts.join(" · ")}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {version.localEvidence}
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-200">
              {version.externalBlocker}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-amber-100">
        {payload?.disclosure || "Loading future source-train boundary..."}
      </p>
    </section>
  );
}
