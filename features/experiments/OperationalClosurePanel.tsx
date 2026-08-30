"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceStatus = "pass" | "attention" | "unavailable" | "external-only";

type SourceSignal = {
  id: string;
  label: string;
  status: SourceStatus;
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

type RemediationItem = {
  sourceSignalId: string;
  label: string;
  owner: string;
  priority: "critical" | "high" | "medium" | "low";
  state: "satisfied" | "open" | "blocked" | "external-only";
  blockedBy: string[];
  nextActions: string[];
  evidenceUri: string;
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
  summary: { verifiedVersions: number; requiredVersions: number };
  remediationControlPlane: {
    summary: {
      totalItems: number;
      satisfiedItems: number;
      openItems: number;
      blockedItems: number;
      externalOnlyItems: number;
      criticalAttentionItems: number;
    };
    items: RemediationItem[];
  };
  versions: Version[];
  error?: string;
};

type TrainId = "control" | "readiness";

const TRAINS: Record<TrainId, {
  endpoint: string;
  range: string;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
}> = {
  control: {
    endpoint: "/api/experiments/remediation-control",
    range: "V3.0.0-V3.0.9",
    labelEn: "Remediation control plane",
    labelZh: "整改控制面",
    descriptionEn: "Seven unresolved owner signals become ordered controls with accountable owners, dependencies, acceptance checks, next actions, and evidence fingerprints.",
    descriptionZh: "把 7 个未闭环 owner 信号变成有责任人、依赖、验收条件、下一动作与证据指纹的有序控制项。",
  },
  readiness: {
    endpoint: "/api/experiments/service-readiness",
    range: "V3.1.0-V3.1.4",
    labelEn: "Service readiness",
    labelZh: "服务就绪",
    descriptionEn: "Customer disclosure, support diagnostics, upgrade/change readiness, operational transition, and independent closure stay distinct from local source completion.",
    descriptionZh: "客户披露、支持诊断、升级变更、运行交接与独立终审继续和本地源码完成度严格分离。",
  },
};

const PRIORITY_ORDER: Record<RemediationItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function signalTone(status: SourceStatus | undefined) {
  if (status === "pass") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "external-only") return "border-sky-300/20 bg-sky-400/10 text-sky-100";
  if (status === "unavailable") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-amber-300/20 bg-amber-400/10 text-amber-100";
}

function stateTone(state: RemediationItem["state"]) {
  if (state === "satisfied") return "text-emerald-200";
  if (state === "external-only") return "text-sky-200";
  if (state === "blocked") return "text-rose-200";
  return "text-amber-200";
}

export function OperationalClosurePanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [active, setActive] = useState<TrainId>("control");
  const [payloads, setPayloads] = useState<Partial<Record<TrainId, TrainPayload>>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
      setError(caught instanceof Error ? caught.message : "Operational closure evidence failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const train = TRAINS[active];
  const payload = payloads[active];
  const queue = useMemo(
    () =>
      [...(payload?.remediationControlPlane.items || [])]
        .filter((item) => item.state === "open" || item.state === "blocked")
        .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
        .slice(0, 7),
    [payload],
  );

  return (
    <section
      id="operational-remediation-readiness"
      data-evidence-ready={Boolean(payloads.control && payloads.readiness)}
      className="min-w-0 border border-cyan-300/20 bg-slate-950/80 p-4 backdrop-blur"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-cyan-300">V3.0.0-V3.1.4 REMEDIATION CONTROL</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Turn evidence gaps into accountable work" : "把证据缺口变成可负责的工作"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "This train adds control-plane mechanics and service-readiness contracts. Open work stays open; signed external authority and production remain separate gates."
              : "这组版本增加整改控制面与服务就绪合同。未完成项继续保持未完成；外部签收与生产授权仍是独立门禁。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          title={en ? "Refresh remediation controls" : "刷新整改控制"}
          className="inline-flex h-10 w-10 items-center justify-center border border-cyan-300/25 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          <span aria-hidden className={`text-lg leading-none ${loading ? "animate-spin" : ""}`}>↻</span>
          <span className="sr-only">{en ? "Refresh remediation controls" : "刷新整改控制"}</span>
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
              className={`min-w-0 px-4 py-2 text-left text-xs font-semibold transition ${selected ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <span className="block truncate">{option.range}</span>
              <span className="mt-1 block truncate font-normal">{en ? option.labelEn : option.labelZh}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-cyan-300">{train.range}</p>
              <h3 className="mt-1 text-base font-semibold text-white">{en ? train.labelEn : train.labelZh}</h3>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">{en ? train.descriptionEn : train.descriptionZh}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-xs">
              <div><p className="text-slate-500">LOCAL</p><p className="mt-1 font-semibold text-white">{payload ? `${payload.sourceSummary.passingSignals}/${payload.sourceSummary.sourceOwnedSignals}` : "--"}</p></div>
              <div><p className="text-slate-500">SIGNED</p><p className="mt-1 font-semibold text-white">{payload ? `${payload.summary.verifiedVersions}/${payload.summary.requiredVersions}` : "--"}</p></div>
              <div><p className="text-slate-500">PRODUCTION</p><p className="mt-1 font-semibold text-amber-100">BLOCKED</p></div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {payload?.versions.map((version) => {
              const source = version.sourceSignal;
              const blocker = source?.blockers[0] || version.blockers[0] || version.externalBlocker;
              return (
                <article key={version.version} className="min-w-0 border border-white/10 bg-slate-950/75 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-cyan-300">{version.version}</p><h4 className="mt-1 text-sm font-semibold text-white">{version.label}</h4></div>
                    <div className="flex shrink-0 flex-col items-end gap-1"><span className={`border px-2 py-1 text-[10px] font-semibold uppercase ${signalTone(source?.status)}`}>{source?.status || "loading"}</span><span className="text-[10px] font-semibold uppercase text-amber-100">signed {version.evidenceStatus}</span></div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{source?.summary || version.sourceContracts.join(" · ")}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{blocker}</p>
                  {source?.evidenceUri ? <Link href={source.evidenceUri} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-cyan-100">{en ? "Open owner evidence" : "打开 owner 证据"}<span aria-hidden>↗</span></Link> : null}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 border border-white/10 bg-black/25 p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase text-cyan-300">ACTION QUEUE</p><h3 className="mt-1 text-base font-semibold text-white">{en ? "Highest-priority remediation" : "最高优先级整改"}</h3></div>
            <span className="border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-100">{queue.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {queue.map((item) => (
              <div key={item.sourceSignalId} className="border border-white/10 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-slate-500">{item.owner} · {item.priority}</p><p className="mt-1 text-xs font-semibold text-white">{item.label}</p></div><span className={`shrink-0 text-[10px] font-semibold uppercase ${stateTone(item.state)}`}>{item.state}</span></div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.nextActions[0]}</p>
                {item.blockedBy.length ? <p className="mt-2 text-[10px] leading-4 text-rose-200">{en ? "Blocked by" : "依赖"}: {item.blockedBy.join(", ")}</p> : null}
              </div>
            ))}
            {!queue.length && payload ? <p className="text-xs leading-5 text-emerald-200">{en ? "No source-owned remediation is currently open." : "当前没有未完成的源码整改项。"}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
