"use client";

import { useMemo } from "react";
import {
  CompareLaneMatrix,
  ComparePromptEditor,
  CompareRecipeMatrix,
  CompareReviewDrawer,
  computeTokenOverlap,
  extractJsonKeys,
  formatContextWindowLabel,
  formatProviderProfile,
  formatThinkingMode,
} from "@/features/compare/components";
import { CompareWorkbenchSidebar } from "@/features/compare/CompareWorkbenchSidebar";
import { getCompareContextValidatedHelper } from "@/lib/agent/context-recommendation";
import type {
  AgentBenchmarkResponse,
  AgentCompareIntent,
  AgentCompareLaneProgress,
  AgentCompareOutputShape,
  AgentCompareReviewSummaryDetail,
  AgentCompareReviewSummaryTone,
  AgentCompareResponse,
  AgentProviderProfile,
  AgentRuntimeStatus,
  AgentStudioRecipe,
  AgentTarget,
  AgentThinkingMode,
} from "@/lib/agent/types";

export type CompareWorkbenchProps = {
  locale: string;
  targets: AgentTarget[];
  selectedTargetId: string;
  compareTargetIds: string[];
  compareIntent: AgentCompareIntent;
  compareOutputShape: AgentCompareOutputShape;
  input: string;
  systemPrompt: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  contextWindow: number;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
  pending: boolean;
  comparePending: boolean;
  compareError: string;
  compareResult: AgentCompareResponse | null;
  compareBaseTargetId: string;
  compareReviewSummaryTone: AgentCompareReviewSummaryTone;
  compareReviewSummaryDetail: AgentCompareReviewSummaryDetail;
  compareRuntimeByTargetId: Record<string, AgentRuntimeStatus>;
  compareProgressByTargetId: Record<string, AgentCompareLaneProgress>;
  compareBenchmarkUseOutputContract: boolean;
  compareBenchmarkPreviewDiffOnly: boolean;
  compareRecoveryPendingTargetId: string;
  compareRecoveryConfirmTargetId: string;
  compareRecoveryCooldownByTargetId: Record<string, number>;
  compareRecoveryNotice: {
    tone: "info" | "success" | "warning";
    message: string;
  } | null;
  benchmarkPending: boolean;
  benchmarkError: string;
  benchmarkResult: AgentBenchmarkResponse | null;
  recipes: AgentStudioRecipe[];
  recipesPending: boolean;
  recipesExecutionPending: boolean;
  recipesError: string;
  activeRecipeId: string;
  recipeDraftLabel: string;
  recipeDraftDescription: string;
  contextWindowOptions: number[];
  providerProfileOptions: AgentProviderProfile[];
  thinkingModeOptions: AgentThinkingMode[];
  onToggleCompareTarget: (targetId: string) => void;
  onCompareIntentChange: (value: AgentCompareIntent) => void;
  onCompareOutputShapeChange: (value: AgentCompareOutputShape) => void;
  onInputChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
  onEnableToolsChange: (value: boolean) => void;
  onEnableRetrievalChange: (value: boolean) => void;
  onContextWindowChange: (value: number) => void;
  onProviderProfileChange: (value: AgentProviderProfile) => void;
  onThinkingModeChange: (value: AgentThinkingMode) => void;
  onRunCompare: () => void;
  onRerunLane: (targetId: string) => void;
  onSetBaseLane: (targetId: string) => void;
  onCompareReviewSummaryToneChange: (
    value: AgentCompareReviewSummaryTone,
  ) => void;
  onCompareReviewSummaryDetailChange: (
    value: AgentCompareReviewSummaryDetail,
  ) => void;
  onSendToBenchmark: () => void;
  onExportMarkdown: () => void;
  onCompareBenchmarkUseOutputContractChange: (value: boolean) => void;
  onCompareBenchmarkPreviewDiffOnlyChange: (value: boolean) => void;
  onRetryLocalRecovery: (targetId: string) => void;
  onExportLaneMarkdown: (targetId: string) => void;
  onCopyMarkdown: () => void;
  onCopyLaneMarkdown: (targetId: string) => void;
  onCopyLaneReviewSummary: (targetId: string) => void;
  onPreviewLaneMarkdown: (targetId: string) => void;
  onRecipeDraftLabelChange: (value: string) => void;
  onRecipeDraftDescriptionChange: (value: string) => void;
  onRefreshRecipes: () => void;
  onApplyRecipe: (recipeId: string) => void;
  onRunRecipeCompare: (recipeId: string) => void;
  onRunRecipeBenchmark: (recipeId: string) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onSaveCurrentRecipe: () => void;
  onExportRecipesJson: () => void;
  onImportRecipesJson: (file: File) => void;
  onCopy: (text: string, key: string) => void;
  copyState: string;
};

const MAX_COMPARE_LANES = 4;

const COMPARE_INTENT_META: Record<
  AgentCompareIntent,
  {
    zh: { label: string; description: string };
    en: { label: string; description: string };
  }
> = {
  "model-vs-model": {
    zh: {
      label: "模型对模型",
      description: "同一提示词、同一推理预算下比较多个目标的行为差异。",
    },
    en: {
      label: "Model vs model",
      description:
        "Compare multiple targets under the same prompt and inference budget.",
    },
  },
  "preset-vs-preset": {
    zh: {
      label: "配置对配置",
      description:
        "保持目标一致，只比较 provider profile、thinking 或 sampling 预设。",
    },
    en: {
      label: "Preset vs preset",
      description:
        "Hold the target steady and compare profile, thinking, or sampling presets.",
    },
  },
  "template-vs-template": {
    zh: {
      label: "模板对模板",
      description: "比较不同 system prompt / prompt frame 对输出的影响。",
    },
    en: {
      label: "Template vs template",
      description:
        "Inspect how different system frames reshape the same task output.",
    },
  },
  "before-vs-after": {
    zh: {
      label: "变更前后",
      description: "为后续微调、提示词修订或 checkpoint 前后对比预留入口。",
    },
    en: {
      label: "Before / after",
      description:
        "Reserve a clean lane for checkpoint, prompt, or fine-tune deltas.",
    },
  },
};

const OUTPUT_SHAPE_META: Record<
  AgentCompareOutputShape,
  {
    zh: { label: string; description: string };
    en: { label: string; description: string };
  }
> = {
  freeform: {
    zh: {
      label: "自由输出",
      description: "保留模型自然回答，适合整体手感和长文风格比较。",
    },
    en: {
      label: "Freeform",
      description:
        "Keep the model natural and compare overall tone and reasoning.",
    },
  },
  "bullet-list": {
    zh: {
      label: "要点列表",
      description: "压成同结构要点，适合快速横向审阅。",
    },
    en: {
      label: "Bullet list",
      description: "Force a concise outline so lanes stay easy to review.",
    },
  },
  "strict-json": {
    zh: {
      label: "严格 JSON",
      description: "为结构化输出、抽取和微调回归验证准备。",
    },
    en: {
      label: "Strict JSON",
      description: "Use a stable schema for extraction and regression checks.",
    },
  },
};

export function CompareWorkbench({
  locale,
  targets,
  selectedTargetId,
  compareTargetIds,
  compareIntent,
  compareOutputShape,
  input,
  systemPrompt,
  enableTools,
  enableRetrieval,
  contextWindow,
  providerProfile,
  thinkingMode,
  pending,
  comparePending,
  compareError,
  compareResult,
  compareBaseTargetId,
  compareReviewSummaryTone,
  compareReviewSummaryDetail,
  compareRuntimeByTargetId,
  compareProgressByTargetId,
  compareBenchmarkUseOutputContract,
  compareBenchmarkPreviewDiffOnly,
  compareRecoveryPendingTargetId,
  compareRecoveryConfirmTargetId,
  compareRecoveryCooldownByTargetId,
  compareRecoveryNotice,
  benchmarkPending,
  benchmarkError,
  benchmarkResult,
  recipes,
  recipesPending,
  recipesExecutionPending,
  recipesError,
  activeRecipeId,
  recipeDraftLabel,
  recipeDraftDescription,
  contextWindowOptions,
  providerProfileOptions,
  thinkingModeOptions,
  onToggleCompareTarget,
  onCompareIntentChange,
  onCompareOutputShapeChange,
  onInputChange,
  onSystemPromptChange,
  onEnableToolsChange,
  onEnableRetrievalChange,
  onContextWindowChange,
  onProviderProfileChange,
  onThinkingModeChange,
  onRunCompare,
  onRerunLane,
  onSetBaseLane,
  onCompareReviewSummaryToneChange,
  onCompareReviewSummaryDetailChange,
  onSendToBenchmark,
  onExportMarkdown,
  onCompareBenchmarkUseOutputContractChange,
  onCompareBenchmarkPreviewDiffOnlyChange,
  onRetryLocalRecovery,
  onExportLaneMarkdown,
  onCopyMarkdown,
  onCopyLaneMarkdown,
  onCopyLaneReviewSummary,
  onPreviewLaneMarkdown,
  onRecipeDraftLabelChange,
  onRecipeDraftDescriptionChange,
  onRefreshRecipes,
  onApplyRecipe,
  onRunRecipeCompare,
  onRunRecipeBenchmark,
  onDeleteRecipe,
  onSaveCurrentRecipe,
  onExportRecipesJson,
  onImportRecipesJson,
  onCopy,
  copyState,
}: CompareWorkbenchProps) {
  const localeKey = locale.startsWith("en") ? "en" : "zh";
  const copy = locale.startsWith("en")
    ? {
        title: "Compare Lab",
        subtitle:
          "Compare multiple lanes with one shared prompt frame and a compact settings stack.",
        targets: "Compare targets",
        targetsHint: `Keep the current target pinned, then add up to ${MAX_COMPARE_LANES - 1} more lanes for a fair side-by-side.`,
        recipe: "Compare recipe",
        outputShape: "Output shape",
        lockedControls: "Locked controls",
        lockedControlsHint:
          "These settings stay aligned across every lane, so we compare behavior instead of accidental parameter drift.",
        promptFrame: "Prompt frame",
        promptInput: "Task prompt",
        systemFrame: "System frame",
        lanePreview: "Lane preview",
        lanePreviewHint:
          "This compares real outputs while keeping the current /agent workbench frame intact.",
        fairnessFingerprint: "Fairness fingerprint",
        currentTarget: "Current target",
        local: "Local",
        remote: "Remote",
        recommendedContext: "Recommended context",
        runCompare: "Run compare",
        runningCompare: "Running compare...",
        benchmarkAction: "Send to benchmark",
        benchmarkPending: "Sending to benchmark...",
        benchmarkHint:
          "Reuse the current compare setup as a prompt benchmark run in /admin.",
        benchmarkContractToggle: "Preserve compare output contract in handoff",
        benchmarkContractHint:
          "Carry over bullet-list or strict JSON instructions when you convert this compare run into a prompt benchmark.",
        benchmarkPromptPreview: "Benchmark prompt preview",
        benchmarkPromptPreviewHint:
          "This read-only prompt is the exact payload that compare handoff will send to /api/admin/benchmark.",
        benchmarkPromptDiffOnly: "Show diff only",
        benchmarkPromptCopy: "Copy preview",
        benchmarkSuccess: "Benchmark handoff ready",
        benchmarkOpen: "Open /admin and track this run",
        benchmarkRunNoteAttached:
          "Compare compact markdown was attached to this benchmark run as a run note.",
        exportMarkdown: "Export markdown",
        copyMarkdown: "Copy issue / PR markdown",
        rerunLane: "Rerun lane",
        setBaseLane: "Set as base",
        baseLaneTag: "Base lane",
        needMoreTargets:
          "Add at least one more lane to make the comparison meaningful.",
        targetMatrixCurrent: "Pinned current target",
        targetMatrixCapacity: "Lane capacity",
        targetMatrixTarget: "Target",
        targetMatrixContext: "Context",
        targetMatrixStatus: "Lane state",
        laneReady: "Lane ready",
        lanePending: "Waiting",
        tools: "Tool loop",
        retrieval: "Retrieval",
        on: "On",
        off: "Off",
        resultReview: "Result review",
        resultReviewHint:
          "Review response shape, output length, warning state, and overlap against the base lane.",
        reviewSummaryTone: "Comment tone",
        reviewSummaryToneHint:
          "Choose the voice you want when copying a short review summary.",
        reviewSummaryToneIssue: "Issue",
        reviewSummaryTonePr: "PR",
        reviewSummaryToneChat: "Chat",
        reviewSummaryDetail: "Summary depth",
        reviewSummaryDetailHint:
          "Use longer templates when you want a stricter review note or a friendlier status update.",
        reviewSummaryDetailCompact: "Compact",
        reviewSummaryDetailStrict: "Strict review",
        reviewSummaryDetailFriendly: "Friendly report",
        latestRun: "Latest run",
        baseLane: "Base lane",
        overlap: "Overlap",
        lengthDelta: "Length delta",
        schema: "Schema",
        warning: "Warning",
        copyOutput: "Copy output",
        copied: "Copied",
        noResults:
          "Run compare to inspect side-by-side outputs and review notes.",
        laneFailed: "Lane failed",
        laneOk: "Lane ok",
        actualContext: "Actual context",
        usage: "Usage",
        promptTokens: "Prompt",
        completionTokens: "Completion",
        totalTokens: "Total",
        partialRun: "Compare completed with one or more failed lanes.",
        compareWarning: "Compare note",
        schemaMatch: "Matched keys",
        schemaMismatch: "Different keys",
        schemaUnavailable: "Not JSON",
        compareRuntimePhase: "Compare runtime",
        compareLoadingFor: "Loading for",
        compareRecoveryBudget: "Recovery budget",
        compareLatestRecovery: "Latest recovery",
        compareAwaitingRecovery:
          "Compare will trigger one local recovery if this lane stays stalled.",
        compareRecoveryTimeline: "Recovery timeline",
        compareIdleStatus: "idle",
        compareNoTimeline:
          "Timeline entries will appear here once compare records loading or recovery milestones.",
        compareManualRecovery: "Retry local recovery",
        compareManualRecoveryPending: "Retrying local recovery...",
        compareManualRecoveryConfirm: "Click again to confirm",
        compareManualRecoveryConfirmHint:
          "Click once more within 5 seconds to restart the local gateway from Compare.",
        compareManualRecoveryCooldown: "Recovery cooldown",
        compareManualRecoveryCooldownHint:
          "A short cooldown is active so we do not spam local restarts.",
        compareDrawer: "Timeline and notes",
        exportLane: "Export lane",
        copyLaneMarkdown: "Copy markdown",
        copyLaneReviewSummary: "Copy review summary",
        previewLane: "Open preview",
      }
    : {
        title: "Compare Lab",
        subtitle: "",
        targets: "对比目标",
        targetsHint: `固定当前目标，再额外加入最多 ${MAX_COMPARE_LANES - 1} 条 lane。`,
        recipe: "对比方案",
        outputShape: "输出形态",
        lockedControls: "锁定控制项",
        lockedControlsHint: "",
        promptFrame: "提示词框架",
        promptInput: "任务提示词",
        systemFrame: "系统提示词",
        lanePreview: "对比 lane 预览",
        lanePreviewHint: "",
        fairnessFingerprint: "公平性指纹",
        currentTarget: "当前目标",
        local: "本地",
        remote: "远端",
        recommendedContext: "推荐上下文",
        runCompare: "运行对比",
        runningCompare: "对比运行中...",
        benchmarkAction: "送入 benchmark",
        benchmarkPending: "正在送入 benchmark...",
        benchmarkHint:
          "沿用当前 compare 配置，直接转成 /admin 里的 prompt benchmark。",
        benchmarkContractToggle: "handoff 时沿用 compare 输出契约",
        benchmarkContractHint:
          "把 bullet-list 或 strict JSON 的输出约束一并带到 prompt benchmark 里。",
        benchmarkPromptPreview: "benchmark prompt 预览",
        benchmarkPromptPreviewHint:
          "这里展示的只读 prompt，就是 compare handoff 真正会送到 /api/admin/benchmark 的内容。",
        benchmarkPromptDiffOnly: "只看差异",
        benchmarkPromptCopy: "复制预览",
        benchmarkSuccess: "benchmark 已接收",
        benchmarkOpen: "去 /admin 跟踪这轮运行",
        benchmarkRunNoteAttached:
          "这轮 benchmark 已自动附带 compare 的紧凑 Markdown run note。",
        exportMarkdown: "导出 Markdown",
        copyMarkdown: "复制 issue / PR Markdown",
        rerunLane: "重跑此 lane",
        setBaseLane: "设为基准",
        baseLaneTag: "基准 lane",
        needMoreTargets: "至少再加一条 lane，才能形成有意义的对比。",
        targetMatrixCurrent: "固定当前目标",
        targetMatrixCapacity: "Lane 容量",
        targetMatrixTarget: "目标",
        targetMatrixContext: "上下文",
        targetMatrixStatus: "状态",
        laneReady: "已就绪",
        lanePending: "待补齐",
        tools: "工具循环",
        retrieval: "检索增强",
        on: "开启",
        off: "关闭",
        resultReview: "结果审阅",
        resultReviewHint:
          "现在可以看输出形态、长度、warning，以及相对基准 lane 的重合度和结构差异。",
        reviewSummaryTone: "评论语气",
        reviewSummaryToneHint:
          "复制评论摘要前，先选 issue / PR / chat 的表达方式。",
        reviewSummaryToneIssue: "Issue",
        reviewSummaryTonePr: "PR",
        reviewSummaryToneChat: "Chat",
        reviewSummaryDetail: "摘要长度",
        reviewSummaryDetailHint:
          "需要更正式的评审或更柔和的汇报时，可以切换到更长的模板。",
        reviewSummaryDetailCompact: "紧凑",
        reviewSummaryDetailStrict: "严格审阅",
        reviewSummaryDetailFriendly: "友好汇报",
        latestRun: "最近一次运行",
        baseLane: "基准 lane",
        overlap: "重合度",
        lengthDelta: "长度差",
        schema: "结构",
        warning: "告警",
        copyOutput: "复制输出",
        copied: "已复制",
        noResults: "运行 compare 后，这里会出现并排输出和基础审阅结论。",
        laneFailed: "lane 失败",
        laneOk: "lane 正常",
        actualContext: "实际上下文",
        usage: "用量",
        promptTokens: "提示",
        completionTokens: "生成",
        totalTokens: "总计",
        partialRun: "这轮 compare 已完成，但有一个或多个 lane 失败。",
        compareWarning: "对比说明",
        schemaMatch: "键一致",
        schemaMismatch: "键不同",
        schemaUnavailable: "非 JSON",
        compareRuntimePhase: "Compare 运行态",
        compareLoadingFor: "加载时长",
        compareRecoveryBudget: "恢复预算",
        compareLatestRecovery: "最近恢复动作",
        compareAwaitingRecovery:
          "如果这条 lane 继续卡住，compare 会触发一次本地恢复。",
        compareRecoveryTimeline: "恢复动作时间线",
        compareIdleStatus: "空闲",
        compareNoTimeline:
          "当 compare 记录到加载、恢复或完成节点后，这里会显示可读历史。",
        compareManualRecovery: "手动重试本地恢复",
        compareManualRecoveryPending: "正在手动重试本地恢复...",
        compareManualRecoveryConfirm: "再次点击确认",
        compareManualRecoveryConfirmHint:
          "请在 5 秒内再次点击，Compare 才会真正重启本地网关。",
        compareManualRecoveryCooldown: "恢复冷却中",
        compareManualRecoveryCooldownHint:
          "为了避免连续误触，本地恢复会有一个很短的冷却时间。",
        compareDrawer: "时间线与备注",
        exportLane: "导出此 lane",
        copyLaneMarkdown: "复制 Markdown",
        copyLaneReviewSummary: "复制评论摘要",
        previewLane: "新标签页预览",
      };

  const compareTargets = useMemo(
    () => targets.filter((target) => compareTargetIds.includes(target.id)),
    [compareTargetIds, targets],
  );
  const selectedIntentMeta = COMPARE_INTENT_META[compareIntent][localeKey];
  const selectedOutputShapeMeta =
    OUTPUT_SHAPE_META[compareOutputShape][localeKey];
  const compareContextValidated = getCompareContextValidatedHelper(
    locale,
    contextWindow,
  );

  const fairnessFingerprint = useMemo(
    () =>
      [
        formatContextWindowLabel(contextWindow),
        formatProviderProfile(locale, providerProfile),
        formatThinkingMode(locale, thinkingMode),
        `${copy.tools} ${enableTools ? copy.on : copy.off}`,
        `${copy.retrieval} ${enableRetrieval ? copy.on : copy.off}`,
        OUTPUT_SHAPE_META[compareOutputShape][
          locale.startsWith("en") ? "en" : "zh"
        ].label,
      ].join(" · "),
    [
      compareOutputShape,
      contextWindow,
      copy.off,
      copy.on,
      copy.retrieval,
      copy.tools,
      enableRetrieval,
      enableTools,
      locale,
      providerProfile,
      thinkingMode,
    ],
  );

  const hasEnoughTargets = compareTargets.length >= 2;
  const baseResult = useMemo(
    () =>
      compareResult?.results.find(
        (lane) => lane.targetId === compareBaseTargetId,
      ) ||
      compareResult?.results[0] ||
      null,
    [compareBaseTargetId, compareResult?.results],
  );
  const reviewRows = useMemo(() => {
    if (!compareResult?.results.length || !baseResult) return [];
    const baseJsonKeys = extractJsonKeys(baseResult.content);
    return compareResult.results.map((lane) => {
      const overlap = computeTokenOverlap(baseResult.content, lane.content);
      const candidateJsonKeys = extractJsonKeys(lane.content);
      const schemaStatus =
        !baseJsonKeys || !candidateJsonKeys
          ? copy.schemaUnavailable
          : JSON.stringify(baseJsonKeys) === JSON.stringify(candidateJsonKeys)
            ? copy.schemaMatch
            : copy.schemaMismatch;
      return {
        lane,
        overlap,
        lengthDelta: lane.content.length - baseResult.content.length,
        schemaStatus,
        isBase: lane.targetId === baseResult.targetId,
      };
    });
  }, [
    baseResult,
    compareResult?.results,
    copy.schemaMatch,
    copy.schemaMismatch,
    copy.schemaUnavailable,
  ]);
  const primaryReviewRow =
    reviewRows.find((row) => row.isBase) || reviewRows[0] || null;
  const secondaryReviewRows = reviewRows.filter((row) => !row.isBase);
  const reviewLayoutCopy = locale.startsWith("en")
    ? {
        primaryResult: "Primary result",
        secondaryDiffs: "Secondary diff drawers",
        secondaryDiffsHint:
          "Keep the base lane in full view, then open only the diffs you want to inspect.",
        openDrawer: "Open diff drawer",
        drawerNotes: "Expanded diff",
      }
    : {
        primaryResult: "主结果",
        secondaryDiffs: "次级 diff 抽屉",
        secondaryDiffsHint:
          "让基准 lane 保持完整可读，只按需展开其它 lane 的差异细节。",
        openDrawer: "展开 diff 抽屉",
        drawerNotes: "展开后细节",
      };

  return (
    <div className="min-h-[620px] bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(2,6,23,0.12))]">
      <div className="space-y-5 px-5 py-5">
        <section className="rounded-[28px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.85),rgba(2,6,23,0.92))] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/80">
                /agent · compare
              </p>
              <h3 className="ui-balance mt-3 text-2xl font-semibold text-white">
                {copy.title}
              </h3>
              {copy.subtitle ? (
                <p className="ui-pretty mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {copy.subtitle}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                {copy.fairnessFingerprint}
              </p>
              <p className="ui-safe-break mt-2 text-sm font-medium text-white">
                {fairnessFingerprint}
              </p>
            </div>
          </div>
          {compareRecoveryNotice ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                compareRecoveryNotice.tone === "success"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : compareRecoveryNotice.tone === "warning"
                    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
              }`}
            >
              {compareRecoveryNotice.message}
            </div>
          ) : null}
        </section>

        <div className="grid gap-5">
          <div className="space-y-5">
            <CompareRecipeMatrix
              locale={locale}
              recipes={recipes}
              recipesPending={recipesPending}
              recipesExecutionPending={recipesExecutionPending}
              recipesError={recipesError}
              activeRecipeId={activeRecipeId}
              recipeDraftLabel={recipeDraftLabel}
              recipeDraftDescription={recipeDraftDescription}
              selectedTargetCount={compareTargets.length}
              onRecipeDraftLabelChange={onRecipeDraftLabelChange}
              onRecipeDraftDescriptionChange={onRecipeDraftDescriptionChange}
              onRefreshRecipes={onRefreshRecipes}
              onApplyRecipe={onApplyRecipe}
              onRunRecipeCompare={onRunRecipeCompare}
              onRunRecipeBenchmark={onRunRecipeBenchmark}
              onDeleteRecipe={onDeleteRecipe}
              onSaveCurrentRecipe={onSaveCurrentRecipe}
              onExportRecipesJson={onExportRecipesJson}
              onImportRecipesJson={onImportRecipesJson}
            />

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    {locale.startsWith("en") ? "Compare composer" : "对比编排"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5">
                    {
                      Object.entries(COMPARE_INTENT_META).find(
                        ([intent]) => intent === compareIntent,
                      )?.[1][locale.startsWith("en") ? "en" : "zh"].label
                    }
                  </span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5">
                    {
                      Object.entries(OUTPUT_SHAPE_META).find(
                        ([shape]) => shape === compareOutputShape,
                      )?.[1][locale.startsWith("en") ? "en" : "zh"].label
                    }
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    {formatContextWindowLabel(contextWindow)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    {formatProviderProfile(locale, providerProfile)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    {formatThinkingMode(locale, thinkingMode)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.72fr)] 2xl:items-start">
                <div className="space-y-4">
                  <ComparePromptEditor
                    locale={locale}
                    copy={copy}
                    input={input}
                    systemPrompt={systemPrompt}
                    selectedIntentMeta={selectedIntentMeta}
                    selectedOutputShapeMeta={selectedOutputShapeMeta}
                    onInputChange={onInputChange}
                    onSystemPromptChange={onSystemPromptChange}
                  />

                  <CompareLaneMatrix
                    copy={copy}
                    targets={targets}
                    selectedTargetId={selectedTargetId}
                    compareTargetIds={compareTargetIds}
                    compareContextValidated={compareContextValidated}
                    maxCompareLanes={MAX_COMPARE_LANES}
                    onToggleCompareTarget={onToggleCompareTarget}
                  />
                </div>

                <div className="space-y-4">
                  <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {copy.recipe}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(COMPARE_INTENT_META).map(
                        ([intent, meta]) => {
                          const selected = compareIntent === intent;
                          const labelSet = meta[localeKey];
                          return (
                            <button
                              key={intent}
                              type="button"
                              onClick={() =>
                                onCompareIntentChange(
                                  intent as AgentCompareIntent,
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                                selected
                                  ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
                                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                              }`}
                            >
                              {labelSet.label}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                      <p className="text-sm font-medium text-white">
                        {selectedIntentMeta.label}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-400">
                        {selectedIntentMeta.description}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {copy.outputShape}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(OUTPUT_SHAPE_META).map(
                        ([shape, meta]) => {
                          const selected = compareOutputShape === shape;
                          const labelSet = meta[localeKey];
                          return (
                            <button
                              key={shape}
                              type="button"
                              onClick={() =>
                                onCompareOutputShapeChange(
                                  shape as AgentCompareOutputShape,
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                                selected
                                  ? "border-violet-400/25 bg-violet-400/10 text-violet-100"
                                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                              }`}
                            >
                              {labelSet.label}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                      <p className="text-sm font-medium text-white">
                        {selectedOutputShapeMeta.label}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-400">
                        {selectedOutputShapeMeta.description}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          {copy.lockedControls}
                        </p>
                        {copy.lockedControlsHint ? (
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {copy.lockedControlsHint}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEnableToolsChange(!enableTools)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                            enableTools
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                              : "border-white/10 bg-white/[0.04] text-slate-300"
                          }`}
                        >
                          {copy.tools}: {enableTools ? copy.on : copy.off}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onEnableRetrievalChange(!enableRetrieval)
                          }
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                            enableRetrieval
                              ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                              : "border-white/10 bg-white/[0.04] text-slate-300"
                          }`}
                        >
                          {copy.retrieval}:{" "}
                          {enableRetrieval ? copy.on : copy.off}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3">
                        <span className="text-[11px] font-medium text-slate-400">
                          {locale.startsWith("en") ? "Context" : "上下文长度"}
                        </span>
                        <select
                          value={contextWindow}
                          onChange={(event) =>
                            onContextWindowChange(Number(event.target.value))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          {contextWindowOptions.map((value) => (
                            <option key={value} value={value}>
                              {formatContextWindowLabel(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3">
                        <span className="text-[11px] font-medium text-slate-400">
                          {locale.startsWith("en")
                            ? "Profile"
                            : "Provider 档位"}
                        </span>
                        <select
                          value={providerProfile}
                          onChange={(event) =>
                            onProviderProfileChange(
                              event.target.value as AgentProviderProfile,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          {providerProfileOptions.map((value) => (
                            <option key={value} value={value}>
                              {formatProviderProfile(locale, value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 sm:col-span-2">
                        <span className="text-[11px] font-medium text-slate-400">
                          {locale.startsWith("en") ? "Thinking" : "思考模式"}
                        </span>
                        <select
                          value={thinkingMode}
                          onChange={(event) =>
                            onThinkingModeChange(
                              event.target.value as AgentThinkingMode,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          {thinkingModeOptions.map((value) => (
                            <option key={value} value={value}>
                              {formatThinkingMode(locale, value)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {copy.fairnessFingerprint}
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {fairnessFingerprint}
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </section>

            <CompareReviewDrawer
              locale={locale}
              copy={copy}
              copyState={copyState}
              comparePending={comparePending}
              compareResult={compareResult}
              compareReviewSummaryTone={compareReviewSummaryTone}
              compareReviewSummaryDetail={compareReviewSummaryDetail}
              primaryReviewRow={primaryReviewRow}
              secondaryReviewRows={secondaryReviewRows}
              reviewLayoutCopy={reviewLayoutCopy}
              onRerunLane={onRerunLane}
              onSetBaseLane={onSetBaseLane}
              onCopy={onCopy}
              onExportLaneMarkdown={onExportLaneMarkdown}
              onPreviewLaneMarkdown={onPreviewLaneMarkdown}
              onCopyLaneMarkdown={onCopyLaneMarkdown}
              onCopyLaneReviewSummary={onCopyLaneReviewSummary}
              onCompareReviewSummaryToneChange={
                onCompareReviewSummaryToneChange
              }
              onCompareReviewSummaryDetailChange={
                onCompareReviewSummaryDetailChange
              }
            />
          </div>

          <CompareWorkbenchSidebar
            locale={locale}
            copy={copy}
            copyState={copyState}
            compareTargets={compareTargets}
            maxCompareLanes={MAX_COMPARE_LANES}
            hasEnoughTargets={hasEnoughTargets}
            selectedTargetId={selectedTargetId}
            compareContextValidated={compareContextValidated}
            compareRuntimeByTargetId={compareRuntimeByTargetId}
            compareProgressByTargetId={compareProgressByTargetId}
            compareRecoveryConfirmTargetId={compareRecoveryConfirmTargetId}
            compareRecoveryPendingTargetId={compareRecoveryPendingTargetId}
            compareRecoveryCooldownByTargetId={compareRecoveryCooldownByTargetId}
            pending={pending}
            comparePending={comparePending}
            benchmarkPending={benchmarkPending}
            compareResult={compareResult}
            benchmarkResult={benchmarkResult}
            compareError={compareError}
            benchmarkError={benchmarkError}
            input={input}
            systemPrompt={systemPrompt}
            compareOutputShape={compareOutputShape}
            compareBenchmarkUseOutputContract={compareBenchmarkUseOutputContract}
            compareBenchmarkPreviewDiffOnly={compareBenchmarkPreviewDiffOnly}
            onRetryLocalRecovery={onRetryLocalRecovery}
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
        </div>
      </div>
    </div>
  );
}
