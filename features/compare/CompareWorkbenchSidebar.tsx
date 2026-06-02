"use client";

import { useMemo } from "react";
import {
  CompareLanePreviewPanel,
  CompareRunHandoffPanel,
} from "@/features/compare/components";
import {
  buildCompareBenchmarkPrompt,
  buildCompareBenchmarkPromptDiff,
} from "@/lib/agent/compare-share";
import type {
  AgentBenchmarkResponse,
  AgentCompareLaneProgress,
  AgentCompareOutputShape,
  AgentCompareResponse,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";

type CompareWorkbenchSidebarProps = {
  locale: string;
  copy: Record<string, string>;
  copyState: string;
  compareTargets: AgentTarget[];
  maxCompareLanes: number;
  hasEnoughTargets: boolean;
  selectedTargetId: string;
  compareContextValidated: string;
  compareRuntimeByTargetId: Record<string, AgentRuntimeStatus>;
  compareProgressByTargetId: Record<string, AgentCompareLaneProgress>;
  compareRecoveryConfirmTargetId: string;
  compareRecoveryPendingTargetId: string;
  compareRecoveryCooldownByTargetId: Record<string, number>;
  pending: boolean;
  comparePending: boolean;
  benchmarkPending: boolean;
  compareResult: AgentCompareResponse | null;
  benchmarkResult: AgentBenchmarkResponse | null;
  compareError: string;
  benchmarkError: string;
  input: string;
  systemPrompt: string;
  compareOutputShape: AgentCompareOutputShape;
  compareBenchmarkUseOutputContract: boolean;
  compareBenchmarkPreviewDiffOnly: boolean;
  onRetryLocalRecovery: (targetId: string) => void;
  onRunCompare: () => void;
  onSendToBenchmark: () => void;
  onExportMarkdown: () => void;
  onCopyMarkdown: () => void;
  onCopy: (text: string, key: string) => void;
  onCompareBenchmarkUseOutputContractChange: (value: boolean) => void;
  onCompareBenchmarkPreviewDiffOnlyChange: (value: boolean) => void;
};

export function CompareWorkbenchSidebar({
  locale,
  copy,
  copyState,
  compareTargets,
  maxCompareLanes,
  hasEnoughTargets,
  selectedTargetId,
  compareContextValidated,
  compareRuntimeByTargetId,
  compareProgressByTargetId,
  compareRecoveryConfirmTargetId,
  compareRecoveryPendingTargetId,
  compareRecoveryCooldownByTargetId,
  pending,
  comparePending,
  benchmarkPending,
  compareResult,
  benchmarkResult,
  compareError,
  benchmarkError,
  input,
  systemPrompt,
  compareOutputShape,
  compareBenchmarkUseOutputContract,
  compareBenchmarkPreviewDiffOnly,
  onRetryLocalRecovery,
  onRunCompare,
  onSendToBenchmark,
  onExportMarkdown,
  onCopyMarkdown,
  onCopy,
  onCompareBenchmarkUseOutputContractChange,
  onCompareBenchmarkPreviewDiffOnlyChange,
}: CompareWorkbenchSidebarProps) {
  const compareBenchmarkPromptPreview = useMemo(
    () =>
      buildCompareBenchmarkPrompt({
        input,
        systemPrompt,
        compareOutputShape,
        compareBenchmarkUseOutputContract,
      }),
    [
      compareBenchmarkUseOutputContract,
      compareOutputShape,
      input,
      systemPrompt,
    ],
  );
  const compareBenchmarkPromptDiffPreview = useMemo(
    () =>
      buildCompareBenchmarkPromptDiff({
        input,
        systemPrompt,
        compareOutputShape,
        compareBenchmarkUseOutputContract,
      }),
    [
      compareBenchmarkUseOutputContract,
      compareOutputShape,
      input,
      systemPrompt,
    ],
  );

  return (
    <aside className="space-y-5 2xl:sticky 2xl:top-5 2xl:self-start">
      <CompareLanePreviewPanel
        locale={locale}
        copy={copy}
        compareTargets={compareTargets}
        maxCompareLanes={maxCompareLanes}
        hasEnoughTargets={hasEnoughTargets}
        selectedTargetId={selectedTargetId}
        compareContextValidated={compareContextValidated}
        compareRuntimeByTargetId={compareRuntimeByTargetId}
        compareProgressByTargetId={compareProgressByTargetId}
        compareRecoveryConfirmTargetId={compareRecoveryConfirmTargetId}
        compareRecoveryPendingTargetId={compareRecoveryPendingTargetId}
        compareRecoveryCooldownByTargetId={compareRecoveryCooldownByTargetId}
        benchmarkPending={benchmarkPending}
        onRetryLocalRecovery={onRetryLocalRecovery}
      />

      <CompareRunHandoffPanel
        locale={locale}
        copy={copy}
        copyState={copyState}
        pending={pending}
        comparePending={comparePending}
        benchmarkPending={benchmarkPending}
        hasEnoughTargets={hasEnoughTargets}
        compareResult={compareResult}
        benchmarkResult={benchmarkResult}
        compareError={compareError}
        benchmarkError={benchmarkError}
        compareBenchmarkUseOutputContract={compareBenchmarkUseOutputContract}
        compareBenchmarkPreviewDiffOnly={compareBenchmarkPreviewDiffOnly}
        compareBenchmarkPromptPreview={compareBenchmarkPromptPreview}
        compareBenchmarkPromptDiffPreview={compareBenchmarkPromptDiffPreview}
        onRunCompare={onRunCompare}
        onSendToBenchmark={onSendToBenchmark}
        onExportMarkdown={onExportMarkdown}
        onCopyMarkdown={onCopyMarkdown}
        onCopy={onCopy}
        onCompareBenchmarkUseOutputContractChange={
          onCompareBenchmarkUseOutputContractChange
        }
        onCompareBenchmarkPreviewDiffOnlyChange={
          onCompareBenchmarkPreviewDiffOnlyChange
        }
      />
    </aside>
  );
}
