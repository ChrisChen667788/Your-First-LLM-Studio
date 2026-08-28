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
import { PostV1PromotionGatePanel } from "@/features/experiments/PostV1PromotionGatePanel";
import { ExtensionEcosystemEvidencePanel } from "@/features/experiments/ExtensionEcosystemEvidencePanel";
import { V14AcceptancePanel } from "@/features/experiments/V14AcceptancePanel";
import { V15AcceptancePanel } from "@/features/experiments/V15AcceptancePanel";
import { V151ReleaseCandidatePanel } from "@/features/experiments/V151ReleaseCandidatePanel";
import { V16FeatureOwnershipPanel } from "@/features/experiments/V16FeatureOwnershipPanel";
import { V161ApplicationContractsPanel } from "@/features/experiments/V161ApplicationContractsPanel";
import { V163BenchmarkQualificationPanel } from "@/features/experiments/V163BenchmarkQualificationPanel";
import { V164OfficialEvaluatorsPanel } from "@/features/experiments/V164OfficialEvaluatorsPanel";
import { V165BenchmarkReproducibilityPanel } from "@/features/experiments/V165BenchmarkReproducibilityPanel";
import { V166BenchmarkDecisionPanel } from "@/features/experiments/V166BenchmarkDecisionPanel";
import { V167WorkflowExecutionPanel } from "@/features/experiments/V167WorkflowExecutionPanel";
import { V168FineTuneExecutionTruthPanel } from "@/features/experiments/V168FineTuneExecutionTruthPanel";
import { V169FineTuneQualityExportPanel } from "@/features/experiments/V169FineTuneQualityExportPanel";
import { V170BenchmarkCandidateMultimodalPanel } from "@/features/experiments/V170BenchmarkCandidateMultimodalPanel";
import { V171V190SourceTrainPanel } from "@/features/experiments/V171V190SourceTrainPanel";
import { V1102V1200SourceTrainPanel } from "@/features/experiments/V1102V1200SourceTrainPanel";
import { ArtifactFederationTrustPanel } from "@/features/experiments/ArtifactFederationTrustPanel";
import { QualityPolicySafetyReviewPanel } from "@/features/experiments/QualityPolicySafetyReviewPanel";
import { EnterpriseControlPlaneCandidatePanel } from "@/features/experiments/EnterpriseControlPlaneCandidatePanel";
import { EnterpriseProductionGaPanel } from "@/features/experiments/EnterpriseProductionGaPanel";
import { ProductionEvidenceAuthorityPanel } from "@/features/experiments/ProductionEvidenceAuthorityPanel";
import { ReleaseAuthorityDecisionLedgerPanel } from "@/features/experiments/ReleaseAuthorityDecisionLedgerPanel";
import { ProductionLifecycleClosurePanel } from "@/features/experiments/ProductionLifecycleClosurePanel";
import { PostGaOperationsTrainPanel } from "@/features/experiments/PostGaOperationsTrainPanel";
import { AssuranceContinuationPanel } from "@/features/experiments/AssuranceContinuationPanel";

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
      <StudioSegmentedChips labels={[en ? "MCP and extensions" : "MCP 与扩展", en ? "Artifact references" : "产物引用", en ? "Cross-feature lineage" : "跨模块 lineage", en ? "Release train" : "版本列车"]} />
      <ExtensionEcosystemEvidencePanel locale={locale} />
      <DesktopOnboardingReleasePanel locale={locale} />
      <V14AcceptancePanel locale={locale} />
      <V15AcceptancePanel locale={locale} />
      <V151ReleaseCandidatePanel locale={locale} />
      <V16FeatureOwnershipPanel locale={locale} />
      <V161ApplicationContractsPanel locale={locale} />
      <V163BenchmarkQualificationPanel locale={locale} />
      <V164OfficialEvaluatorsPanel locale={locale} />
      <V165BenchmarkReproducibilityPanel locale={locale} />
      <V166BenchmarkDecisionPanel locale={locale} />
      <V167WorkflowExecutionPanel locale={locale} />
      <V168FineTuneExecutionTruthPanel locale={locale} />
      <V169FineTuneQualityExportPanel locale={locale} />
      <V170BenchmarkCandidateMultimodalPanel locale={locale} />
      <V171V190SourceTrainPanel locale={locale} />
      <V1102V1200SourceTrainPanel locale={locale} />
      <QualityPolicySafetyReviewPanel locale={locale} />
      <EnterpriseControlPlaneCandidatePanel locale={locale} />
      <EnterpriseProductionGaPanel locale={locale} />
      <ProductionEvidenceAuthorityPanel locale={locale} />
      <ReleaseAuthorityDecisionLedgerPanel locale={locale} />
      <ProductionLifecycleClosurePanel locale={locale} />
      <PostGaOperationsTrainPanel locale={locale} />
      <AssuranceContinuationPanel locale={locale} />
      <ArtifactFederationTrustPanel locale={locale} />
      <PostV1PromotionGatePanel locale={locale} />
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
