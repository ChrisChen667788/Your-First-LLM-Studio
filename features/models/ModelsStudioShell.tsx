"use client";

import Link from "next/link";
import { useLocale } from "@/components/layout/LocaleProvider";
import {
  StudioIdentityBand,
  StudioSurface,
} from "@/components/layout/StudioPageShell";
import { ModelDiscoveryPanel } from "@/features/models/ModelDiscoveryPanel";
import { ModelHubRuntimePanel } from "@/features/models/ModelHubRuntimePanel";
import { LocalServerAcceptancePanel } from "@/features/models/LocalServerAcceptancePanel";
import { ModelHubLifecycleEvidencePanel } from "@/features/models/ModelHubLifecycleEvidencePanel";

export function ModelsStudioShell() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");

  return (
    <StudioSurface accent="emerald" className="flex flex-col gap-4">
      <StudioIdentityBand
        accent="emerald"
        className="mb-0"
        eyebrow="MODELS STUDIO"
        title={isEnglish ? "Model catalog and installs" : "模型目录与安装"}
        description={
          isEnglish
            ? "Discover local-friendly community models, check hardware fit, install candidates, and keep verification evidence near the target catalog."
            : "发现适合本机的社区模型，检查硬件匹配，安装候选模型，并把校验证据留在 target catalog 附近。"
        }
        side={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/agent"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
            >
              {isEnglish ? "Open Agent" : "打开 Agent"}
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              {isEnglish ? "Admin mirror" : "后台镜像"}
            </Link>
          </div>
        }
      />
      <ModelHubLifecycleEvidencePanel />
      <LocalServerAcceptancePanel />
      <ModelHubRuntimePanel embedded />
      <ModelDiscoveryPanel locale={locale} />
    </StudioSurface>
  );
}
