"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceSignal = {
  id: string;
  label: string;
  status: "pass" | "attention" | "unavailable" | "external-only";
  summary: string;
  blockers: string[];
  evidenceUri: string;
};

type Version = {
  version: string;
  label: string;
  evidenceStatus: "missing" | "invalid" | "verified";
  sourceContracts: string[];
  blockers: string[];
  externalBlocker: string;
  sourceSignal: SourceSignal | null;
};

type TrainPayload = {
  ok: boolean;
  localStatus: "pass" | "attention";
  productionStatus: "blocked";
  sourceSummary: {
    sourceOwnedSignals: number;
    passingSignals: number;
    attentionSignals: number;
    unavailableSignals: number;
  };
  summary: {
    verifiedVersions: number;
    requiredVersions: number;
  };
  versions: Version[];
  error?: string;
};

type TrainId = "remediation" | "sustainability";

const TRAINS: Record<TrainId, {
  endpoint: string;
  range: string;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
}> = {
  remediation: {
    endpoint: "/api/experiments/operational-remediation-efficiency",
    range: "V2.8.0-V2.8.9",
    labelEn: "Operational remediation and efficiency",
    labelZh: "运行整改与效率",
    descriptionEn: "Provider, retrieval, model supply-chain, workspace audit, runtime, Agent, Workflow, Benchmark, and Fine-tune gaps are projected into one remediation queue.",
    descriptionZh: "把 Provider、检索、模型供应链、Workspace 审计、Runtime、Agent、Workflow、Benchmark 和 Fine-tune 缺口投影为一条整改队列。",
  },
  sustainability: {
    endpoint: "/api/experiments/sustainable-operations-upgrade",
    range: "V2.9.0-V2.9.4",
    labelEn: "Sustainable operations and upgrades",
    labelZh: "可持续运行与升级",
    descriptionEn: "Telemetry, incident diagnostics, compatibility sunset, desktop upgrade, and data lifecycle stay measurable without turning local rehearsals into production claims.",
    descriptionZh: "持续衡量遥测、故障诊断、兼容层 sunset、桌面升级与数据生命周期，同时不把本地演练冒充生产签收。",
  },
};

function sourceTone(status: SourceSignal["status"] | undefined) {
  if (status === "pass") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "external-only") return "border-sky-300/20 bg-sky-400/10 text-sky-100";
  if (status === "unavailable") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

export function OperationalSustainabilityPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [active, setActive] = useState<TrainId>("remediation");
  const [payloads, setPayloads] = useState<Partial<Record<TrainId, TrainPayload>>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const entries = await Promise.all(
        (Object.entries(TRAINS) as Array<[TrainId, (typeof TRAINS)[TrainId]]>).map(async ([id, train]) => {
          const response = await fetch(train.endpoint, { cache: "no-store" });
          const payload = (await response.json()) as TrainPayload;
          if (!response.ok || !payload.ok) throw new Error(payload.error || `${train.range} could not be loaded.`);
          return [id, payload] as const;
        }),
      );
      setPayloads(Object.fromEntries(entries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operational sustainability evidence failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const train = TRAINS[active];
  const payload = payloads[active];
  const localRatio = useMemo(() => payload ? `${payload.sourceSummary.passingSignals}/${payload.sourceSummary.sourceOwnedSignals}` : "--", [payload]);

  return (
    <section className="min-w-0 border border-emerald-300/20 bg-slate-950/80 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-emerald-300">V2.8.0-V2.9.4 OPERATIONAL REMEDIATION</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{en ? "Close measurable gaps before claiming maturity" : "先闭环可度量缺口，再谈成熟度"}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en ? "These 15 slices read owner-controlled evidence, surface remediation in priority order, and reserve final authority for separately signed external records." : "这 15 个版本只读各 owner 的真实证据，按优先级暴露整改项，并把最终授权保留给独立签名的外部记录。"}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} title={en ? "Refresh signals" : "刷新信号"} className="inline-flex h-10 w-10 items-center justify-center border border-emerald-300/25 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/20 disabled:opacity-50">
          <span aria-hidden className={`text-lg leading-none ${loading ? "animate-spin" : ""}`}>↻</span>
          <span className="sr-only">{en ? "Refresh signals" : "刷新信号"}</span>
        </button>
      </div>

      <div className="mt-4 inline-flex max-w-full flex-wrap border border-white/10 bg-black/25 p-1">
        {(Object.keys(TRAINS) as TrainId[]).map((id) => {
          const option = TRAINS[id];
          const selected = id === active;
          return (
            <button key={id} type="button" aria-pressed={selected} onClick={() => setActive(id)} className={`min-w-0 px-4 py-2 text-left text-xs font-semibold transition ${selected ? "bg-emerald-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <span className="block truncate">{option.range}</span>
              <span className="mt-1 block truncate font-normal">{en ? option.labelEn : option.labelZh}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-emerald-300">{train.range}</p>
            <h3 className="mt-1 text-base font-semibold text-white">{en ? train.labelEn : train.labelZh}</h3>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">{en ? train.descriptionEn : train.descriptionZh}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right text-xs">
            <div><p className="text-slate-500">LOCAL</p><p className="mt-1 font-semibold text-white">{localRatio}</p></div>
            <div><p className="text-slate-500">SIGNED</p><p className="mt-1 font-semibold text-white">{payload ? `${payload.summary.verifiedVersions}/${payload.summary.requiredVersions}` : "--"}</p></div>
            <div><p className="text-slate-500">PRODUCTION</p><p className="mt-1 font-semibold text-amber-100">BLOCKED</p></div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {payload?.versions.map((version) => {
            const source = version.sourceSignal;
            const blocker = source?.blockers[0] || version.blockers[0] || version.externalBlocker;
            return (
              <article key={version.version} className="min-w-0 border border-white/10 bg-slate-950/75 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-emerald-300">{version.version}</p><h4 className="mt-1 text-sm font-semibold text-white">{version.label}</h4></div>
                  <div className="flex shrink-0 flex-col items-end gap-1"><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${sourceTone(source?.status)}`}>{source?.status || "loading"}</span><span className="text-[10px] font-semibold uppercase text-amber-100">signed {version.evidenceStatus}</span></div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">{source?.summary || version.sourceContracts.join(" · ")}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{blocker}</p>
                {source?.evidenceUri ? <Link href={source.evidenceUri} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 hover:text-emerald-100">{en ? "Open source evidence" : "打开源码证据"}<span aria-hidden>↗</span></Link> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
