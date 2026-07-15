"use client";

import Link from "next/link";
import { useLocale } from "@/components/layout/LocaleProvider";
import {
  StudioIdentityBand,
  StudioSegmentedChips,
  StudioSurface,
} from "@/components/layout/StudioPageShell";
import { ExperimentTimelinePanel } from "@/features/experiments/ExperimentTimelinePanel";
import { PromotionGatePanel } from "@/features/experiments/PromotionGatePanel";
import { ReleaseEvidenceMatrixPanel } from "@/features/experiments/ReleaseEvidenceMatrixPanel";
import { ReleaseTrainPanel } from "@/features/experiments/ReleaseTrainPanel";
import { GaReleaseEvidenceBundlePanel } from "@/features/experiments/GaReleaseEvidenceBundlePanel";
import { RouteSmokeEvidencePanel } from "@/features/experiments/RouteSmokeEvidencePanel";
import { ReleaseSecurityEvidencePanel } from "@/features/experiments/ReleaseSecurityEvidencePanel";
import { PostV1FoundationPanel } from "@/features/experiments/PostV1FoundationPanel";
import { PostV1ClosurePanel } from "@/features/experiments/PostV1ClosurePanel";
import { PostV1HardeningPanel } from "@/features/experiments/PostV1HardeningPanel";
import { PostV1AcceptancePanel } from "@/features/experiments/PostV1AcceptancePanel";
import { PostV1LifecyclePanel } from "@/features/experiments/PostV1LifecyclePanel";
import { DesktopOnboardingReleasePanel } from "@/features/experiments/DesktopOnboardingReleasePanel";

export function ExperimentsStudioShell() {
  const { locale } = useLocale();
  const en = locale.startsWith("en");
  return (
    <StudioSurface accent="amber" className="flex flex-col gap-4">
      <StudioIdentityBand
        accent="amber"
        className="mb-0"
        eyebrow="EXPERIMENTS"
        title={en ? "Experiment history and evidence" : "实验历史与证据"}
        description={en ? "Follow sessions, fine-tune jobs, Compare and Benchmark runs, retrieval activity, model installs, provider health, artifacts, and lineage in one place." : "统一追踪 Session、Fine-tune、Compare、Benchmark、Retrieval、模型安装、Provider Health、产物与上下游关系。"}
        side={<div className="flex flex-wrap gap-2"><Link href="/fine-tune" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">Fine-tune</Link><Link href="/benchmarks" className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-50 hover:bg-amber-400/20">Benchmarks</Link></div>}
      />
      <StudioSegmentedChips labels={[en ? "Artifact references" : "产物引用", en ? "Cross-feature lineage" : "跨模块 lineage", en ? "Retention policy" : "保留策略", en ? "Release train" : "版本列车"]} />
      <DesktopOnboardingReleasePanel locale={locale} />
      <PromotionGatePanel locale={locale} />
      <GaReleaseEvidenceBundlePanel locale={locale} />
      <RouteSmokeEvidencePanel locale={locale} />
      <ReleaseSecurityEvidencePanel locale={locale} />
      <PostV1FoundationPanel locale={locale} />
      <PostV1ClosurePanel locale={locale} />
      <PostV1HardeningPanel locale={locale} />
      <PostV1AcceptancePanel locale={locale} />
      <PostV1LifecyclePanel locale={locale} />
      <ReleaseEvidenceMatrixPanel locale={locale} />
      <ReleaseTrainPanel locale={locale} />
      <ExperimentTimelinePanel locale={locale} showRetention />
    </StudioSurface>
  );
}
