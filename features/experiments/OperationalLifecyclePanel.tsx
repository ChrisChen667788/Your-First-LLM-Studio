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
    chainComplete: boolean;
  };
  versions: Version[];
  error?: string;
};

type TrainId = "operations" | "lifecycle" | "autonomy" | "interoperability";

const TRAINS: Record<TrainId, {
  endpoint: string;
  range: string;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
}> = {
  operations: {
    endpoint: "/api/experiments/ai-operations-intelligence",
    range: "V2.4.0-V2.4.9",
    labelEn: "AI operations intelligence",
    labelZh: "AI 运行智能",
    descriptionEn:
      "Runtime, providers, SLO, token cost, benchmark, retrieval, Agent, Workflow, and Fine-tune signals are read from their owning modules before independent review.",
    descriptionZh:
      "从各自 feature owner 读取 Runtime、Provider、SLO、Token 成本、Benchmark、Retrieval、Agent、Workflow 与 Fine-tune 信号，再等待独立复核。",
  },
  lifecycle: {
    endpoint: "/api/experiments/deployment-lifecycle-assurance",
    range: "V2.5.0-V2.5.4",
    labelEn: "Deployment lifecycle assurance",
    labelZh: "部署生命周期签收",
    descriptionEn:
      "Portability, data sovereignty, customer keys, continuity, exit, and independent closure remain explicit deployment lifecycle gates.",
    descriptionZh:
      "部署可移植性、数据主权、客户密钥、连续性、退出演练与独立闭环保持为明确门禁。",
  },
  autonomy: {
    endpoint: "/api/experiments/governed-autonomy-readiness",
    range: "V2.6.0-V2.6.9",
    labelEn: "Governed autonomy readiness",
    labelZh: "受治理自治就绪度",
    descriptionEn:
      "Model choice, provider routing, grounded context, tool permissions, approvals, replay, quality, adapters, and audit provenance are projected as one fail-closed policy chain.",
    descriptionZh:
      "把模型选择、Provider 路由、Grounded Context、工具权限、审批、回放、质量、Adapter 与审计谱系投影为一条 fail-closed 策略链。",
  },
  interoperability: {
    endpoint: "/api/experiments/open-ecosystem-interoperability",
    range: "V2.7.0-V2.7.4",
    labelEn: "Open ecosystem interoperability",
    labelZh: "开放生态互操作",
    descriptionEn:
      "OpenAI-compatible clients, MCP extensions, portable model artifacts, and workspace identity contracts remain testable without claiming external deployment authority.",
    descriptionZh:
      "OpenAI-compatible 客户端、MCP 扩展、可移植模型产物和 Workspace Identity 合同可被持续验证，但不冒充外部部署授权。",
  },
};

function sourceTone(status: SourceSignal["status"] | undefined) {
  if (status === "pass") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "external-only") return "border-sky-300/20 bg-sky-400/10 text-sky-100";
  if (status === "unavailable") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

export function OperationalLifecyclePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [active, setActive] = useState<TrainId>("operations");
  const [payloads, setPayloads] = useState<Partial<Record<TrainId, TrainPayload>>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const entries = await Promise.all(
        (Object.entries(TRAINS) as Array<[TrainId, (typeof TRAINS)[TrainId]]>).map(
          async ([id, train]) => {
            const response = await fetch(train.endpoint, { cache: "no-store" });
            const payload = (await response.json()) as TrainPayload;
            if (!response.ok || !payload.ok) {
              throw new Error(payload.error || `${train.range} could not be loaded.`);
            }
            return [id, payload] as const;
          },
        ),
      );
      setPayloads(Object.fromEntries(entries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operational evidence failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const train = TRAINS[active];
  const payload = payloads[active];
  const statusLine = useMemo(() => {
    if (!payload) return "--";
    return `${payload.sourceSummary.passingSignals}/${payload.sourceSummary.sourceOwnedSignals}`;
  }, [payload]);

  return (
    <section className="min-w-0 border border-cyan-300/20 bg-slate-950/80 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-cyan-300">V2.4.0-V2.7.4 OPERATIONAL ASSURANCE</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Local operational truth, external production authority" : "本地运行事实，外部生产授权"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "The source layer reads real module-owned signals without mutation. Operations, lifecycle, governed autonomy, and interoperability remain separate from signed external production authority."
              : "源码层只读真实 feature-owned 信号，不产生副作用；运行、生命周期、受治理自治和互操作证据继续与外部签名生产授权严格分离。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/20"
        >
          {en ? "Refresh signals" : "刷新信号"}
        </button>
      </div>

      <div className="mt-4 inline-flex max-w-full flex-wrap border border-white/10 bg-black/25 p-1">
        {(Object.keys(TRAINS) as TrainId[]).map((id) => {
          const option = TRAINS[id];
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(id)}
              className={`min-w-0 px-4 py-2 text-left text-xs font-semibold transition ${
                selected ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block truncate">{option.range}</span>
              <span className="mt-1 block truncate font-normal">{en ? option.labelEn : option.labelZh}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-cyan-300">{train.range}</p>
            <h3 className="mt-1 text-base font-semibold text-white">
              {en ? train.labelEn : train.labelZh}
            </h3>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
              {en ? train.descriptionEn : train.descriptionZh}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right text-xs">
            <div><p className="text-slate-500">LOCAL</p><p className="mt-1 font-semibold text-white">{statusLine}</p></div>
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
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-cyan-300">{version.version}</p>
                    <h4 className="mt-1 text-sm font-semibold text-white">{version.label}</h4>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${sourceTone(source?.status)}`}>
                      {source?.status || "loading"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-amber-100">
                      signed {version.evidenceStatus}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  {source?.summary || version.sourceContracts.join(" · ")}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{blocker}</p>
                {source?.evidenceUri ? (
                  <Link href={source.evidenceUri} className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    {en ? "Open source evidence" : "打开源码证据"}
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
