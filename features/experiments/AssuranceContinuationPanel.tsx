"use client";

import { useCallback, useEffect, useState } from "react";

type Version = {
  version: string;
  label: string;
  evidenceStatus: "missing" | "invalid" | "verified";
  sourceContracts: string[];
  blockers: string[];
  externalBlocker: string;
};

type TrainPayload = {
  ok: boolean;
  productionStatus: "blocked";
  summary: {
    verifiedVersions: number;
    requiredVersions: number;
    chainComplete: boolean;
    anchorVerified: boolean;
  };
  versions: Version[];
  error?: string;
};

type TrainDefinition = {
  id: "continuous" | "closure";
  endpoint: string;
  eyebrow: string;
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
};

const TRAINS: TrainDefinition[] = [
  {
    id: "continuous",
    endpoint: "/api/experiments/continuous-assurance-train",
    eyebrow: "V2.2.0-V2.2.9 CONTINUOUS ASSURANCE",
    titleEn: "Continuous compliance and customer trust",
    titleZh: "持续合规与客户信任链",
    descriptionEn:
      "Privacy, model risk, vendors, regulatory mapping, transparency, accessibility, efficiency, remediation, and independent review remain signed external evidence.",
    descriptionZh:
      "隐私、模型风险、供应商、监管映射、透明度、无障碍、资源效率、整改与独立复核继续保持为外部签名证据。",
  },
  {
    id: "closure",
    endpoint: "/api/experiments/assurance-closure-train",
    eyebrow: "V2.3.0-V2.3.4 ASSURANCE CLOSURE",
    titleEn: "Portable evidence and independent closure",
    titleZh: "可移植证据与独立闭环",
    descriptionEn:
      "Evidence portability, trust-center publication, continuous monitoring, audit remediation, and immutable closure are verified without a local authorization path.",
    descriptionZh:
      "证据迁移、Trust Center 发布、持续监控、审计整改与不可变闭环只做验证，不提供本地授权路径。",
  },
];

export function AssuranceContinuationPanel({ locale }: { locale: string }) {
  const en = locale.startsWith("en");
  const [payloads, setPayloads] = useState<Partial<Record<TrainDefinition["id"], TrainPayload>>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const entries = await Promise.all(
        TRAINS.map(async (train) => {
          const response = await fetch(train.endpoint, { cache: "no-store" });
          const payload = (await response.json()) as TrainPayload;
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || `${train.eyebrow} could not be loaded.`);
          }
          return [train.id, payload] as const;
        }),
      );
      setPayloads(Object.fromEntries(entries));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assurance evidence failed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="min-w-0 border border-emerald-300/20 bg-slate-950/75 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-300">V2.2.0-V2.3.4 ASSURANCE TRAIN</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {en ? "Fifteen source-complete, externally controlled gates" : "十五项源码完备、外部受控门禁"}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {en
              ? "The Studio validates strict schemas, predecessor digests, RSA signatures, pinned keys, freshness, control semantics, and reviewer independence. It cannot mint evidence or promote production."
              : "Studio 验证严格 schema、前序摘要、RSA 签名、固定密钥、时效、控制语义与复核独立性；它不能生成外部证据，也不能提升生产状态。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/20"
        >
          {en ? "Refresh evidence" : "刷新证据"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4">
        {TRAINS.map((train) => {
          const payload = payloads[train.id];
          return (
            <article key={train.id} className="min-w-0 border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-emerald-300">{train.eyebrow}</p>
                  <h3 className="mt-1 text-base font-semibold text-white">{en ? train.titleEn : train.titleZh}</h3>
                  <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
                    {en ? train.descriptionEn : train.descriptionZh}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-right text-xs">
                  <div><p className="text-slate-500">SOURCE</p><p className="mt-1 font-semibold text-white">PASS</p></div>
                  <div><p className="text-slate-500">VERIFIED</p><p className="mt-1 font-semibold text-white">{payload ? `${payload.summary.verifiedVersions}/${payload.summary.requiredVersions}` : "--"}</p></div>
                  <div><p className="text-slate-500">PRODUCTION</p><p className="mt-1 font-semibold text-amber-100">BLOCKED</p></div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {payload?.versions.map((version) => (
                  <div key={version.version} className="min-w-0 border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{version.version} · {version.label}</p>
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-100">
                        {version.evidenceStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{version.sourceContracts.join(" · ")}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {version.blockers[0] || version.externalBlocker}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
