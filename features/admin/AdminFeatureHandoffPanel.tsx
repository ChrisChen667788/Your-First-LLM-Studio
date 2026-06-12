"use client";

import Link from "next/link";

type AdminFeatureHandoffPanelProps = {
  locale: string;
  route: "/models" | "/fine-tune" | "/retrieval";
  feature: "models" | "fine-tune" | "retrieval";
};

const content = {
  models: {
    eyebrow: ["Model governance", "模型治理镜像"],
    title: ["Discovery and verification belong to Models", "发现、安装与验证已归属 Models"],
    description: [
      "Admin keeps fleet health and policy visibility. Browse catalogs, install runtimes, and verify model readiness in the foreground workspace.",
      "Admin 只保留模型健康与策略可见性；目录发现、运行时安装和可用性验证统一进入前台工作区。"
    ],
    action: ["Open Models", "打开 Models"],
    chips: [["Catalog ownership", "目录归属"], ["Install workflow", "安装工作流"], ["Readiness proof", "就绪证明"]],
    tone: "cyan"
  },
  "fine-tune": {
    eyebrow: ["Fine-tune governance", "微调治理镜像"],
    title: ["Training workflows belong to Fine-tune Studio", "训练工作流已归属 Fine-tune Studio"],
    description: [
      "Admin keeps audit and regression visibility. Configure datasets, launch runs, attach adapters, and review evidence in the foreground studio.",
      "Admin 只保留审计与回归可见性；数据集配置、训练执行、adapter 挂载和证据审阅统一进入前台工作室。"
    ],
    action: ["Open Fine-tune Studio", "打开 Fine-tune Studio"],
    chips: [["Dataset ownership", "数据集归属"], ["Run orchestration", "运行编排"], ["Evidence review", "证据审阅"]],
    tone: "emerald"
  },
  retrieval: {
    eyebrow: ["Retrieval governance", "检索治理镜像"],
    title: ["Knowledge workflows belong to Retrieval Studio", "知识工作流已归属 Retrieval Studio"],
    description: [
      "Admin keeps index health and audit visibility. Import documents, inspect chunks, and run grounded probes in the foreground workspace.",
      "Admin 只保留索引健康与审计可见性；文档导入、chunk 检查和 grounded query 统一进入前台工作区。"
    ],
    action: ["Open Retrieval Studio", "打开 Retrieval Studio"],
    chips: [["Index ownership", "索引归属"], ["Path import", "路径导入"], ["Grounded evidence", "Grounded 证据"]],
    tone: "cyan"
  }
} as const;

export function AdminFeatureHandoffPanel({ locale, route, feature }: AdminFeatureHandoffPanelProps) {
  const isEnglish = locale.startsWith("en");
  const copy = content[feature];
  const accent = copy.tone === "cyan"
    ? {
        shell: "border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.38),rgba(2,6,23,0.82)_58%)]",
        eyebrow: "text-cyan-300",
        action: "border-cyan-200/25 bg-cyan-400/15 text-cyan-50 hover:border-cyan-200/40 hover:bg-cyan-400/25"
      }
    : {
        shell: "border-emerald-300/15 bg-[linear-gradient(135deg,rgba(6,78,59,0.34),rgba(2,6,23,0.82)_58%)]",
        eyebrow: "text-emerald-300",
        action: "border-emerald-200/25 bg-emerald-400/15 text-emerald-50 hover:border-emerald-200/40 hover:bg-emerald-400/25"
      };

  return (
    <section className={`rounded-3xl border px-4 py-4 shadow-[0_20px_70px_rgba(2,6,23,0.24)] backdrop-blur ${accent.shell}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${accent.eyebrow}`}>
            {copy.eyebrow[isEnglish ? 0 : 1]}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{copy.title[isEnglish ? 0 : 1]}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{copy.description[isEnglish ? 0 : 1]}</p>
        </div>
        <Link
          href={route}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${accent.action}`}
        >
          {copy.action[isEnglish ? 0 : 1]}
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {copy.chips.map((chip) => (
          <span key={chip[0]} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-slate-300">
            {chip[isEnglish ? 0 : 1]}
          </span>
        ))}
      </div>
    </section>
  );
}
