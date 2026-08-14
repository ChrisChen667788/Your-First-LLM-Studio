import type {
  AgentFineTuneDataset,
  AgentFineTuneTargetOption,
} from "@/lib/agent/types";
import type {
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
  FineTuneTrainingArgGroup,
} from "@/features/finetune/setup-state";
import type { FineTuneTrainStage } from "@/features/finetune/run-state";
import type {
  getFineTuneRecipeHelp,
  getFineTuneStudioCopy,
} from "@/features/finetune/studio-copy";
import {
  formatFineTuneSampleCount as formatSampleCount,
} from "@/features/finetune/studio-formatters";

type FineTuneStudioCopy = ReturnType<typeof getFineTuneStudioCopy>;
type FineTuneRecipeHelp = ReturnType<typeof getFineTuneRecipeHelp>;

export function buildFineTuneTrainingArgGroups(input: {
  isEnglish: boolean;
  text: FineTuneStudioCopy;
  recipeHelp: FineTuneRecipeHelp;
  recipeForm: FineTuneRecipeFormState;
  datasetForm: FineTuneDatasetFormState;
  selectedRecipeDataset: AgentFineTuneDataset | null;
  selectedRecipeTarget: AgentFineTuneTargetOption | null;
  estimatedTrainingSteps: number | null;
  effectiveTrainingBatch: number;
  estimatedTrainingSamples: number | null;
  trainStage: FineTuneTrainStage;
}): FineTuneTrainingArgGroup[] {
  const {
    datasetForm,
    effectiveTrainingBatch,
    estimatedTrainingSamples,
    estimatedTrainingSteps,
    isEnglish,
    recipeForm,
    recipeHelp,
    selectedRecipeDataset,
    selectedRecipeTarget,
    text,
    trainStage,
  } = input;
  const contextValue = (tokens?: number | null) =>
    typeof tokens === "number" && Number.isFinite(tokens)
      ? `${Math.round(tokens / 1024)}K`
      : "--";
  const recommendedContext = selectedRecipeTarget?.recommendedContextWindow
    ? contextValue(selectedRecipeTarget.recommendedContextWindow)
    : isEnglish
      ? "8K starter, 16K after memory check"
      : "新手先 8K，确认内存后再 16K";
  const datasetRows = formatSampleCount(selectedRecipeDataset?.sampleCount);
  const adapterCapacity = `${recipeForm.fineTuneMethod.toUpperCase()} r${recipeForm.loraRank} / alpha ${recipeForm.loraAlpha}`;
  const checkpointCadence =
    recipeForm.saveEverySteps > 0
      ? `${recipeForm.saveEverySteps} steps`
      : isEnglish
        ? "final only"
        : "仅最终产物";

  return [
    {
      label: text.recipeGroupIdentity,
      items: [
        {
          label: text.trainStage,
          value: trainStage,
          helper: isEnglish
            ? "Written into the job bundle and report metadata."
            : "会写入作业 bundle 和报告元数据。",
          recommended: text.trainStageSft,
          impact: isEnglish
            ? "Defines downstream command mode."
            : "决定后续命令和评估口径。",
        },
        {
          label: text.datasets,
          value:
            selectedRecipeDataset?.label ||
            datasetForm.label ||
            recipeForm.datasetId ||
            "--",
          helper: recipeHelp.datasetId,
          recommended: isEnglish
            ? "Validated JSONL, sampled before long runs"
            : "已校验 JSONL，长轮次前先抽样",
          impact: isEnglish
            ? `${datasetRows} rows available`
            : `可用样本 ${datasetRows}`,
        },
        {
          label: text.baseTarget,
          value:
            selectedRecipeTarget?.label ||
            selectedRecipeTarget?.modelDefault ||
            recipeForm.baseTargetId ||
            "--",
          helper: recipeHelp.baseTargetId,
          recommended: isEnglish
            ? "Smallest safe local target first"
            : "优先选择最小安全本地模型",
          impact: selectedRecipeTarget?.parameterScale || "--",
        },
        {
          label: text.adapterName,
          value: recipeForm.adapterName || "--",
          helper: recipeHelp.adapterName,
          recommended: isEnglish
            ? "Short, versioned, behavior-specific"
            : "短名称、带版本、体现行为目标",
          impact: isEnglish ? "Controls output folder" : "决定产物目录名",
        },
      ],
    },
    {
      label: text.recipeGroupSchedule,
      items: [
        {
          label: text.sequenceLength,
          value: contextValue(recipeForm.sequenceLength),
          helper: recipeHelp.sequenceLength,
          recommended: recommendedContext,
          impact: isEnglish
            ? "Higher context increases memory pressure."
            : "上下文越长，内存压力越高。",
        },
        {
          label: text.effectiveBatch,
          value: String(effectiveTrainingBatch),
          helper: recipeHelp.gradientAccumulationSteps,
          recommended: isEnglish
            ? "1-4 on memory-tight Macs"
            : "内存紧张时建议 1-4",
          impact: `${text.batchSize} ${recipeForm.batchSize} x ${text.gradientAccumulationSteps} ${recipeForm.gradientAccumulationSteps}`,
        },
        {
          label: text.estimatedSteps,
          value: formatSampleCount(estimatedTrainingSteps),
          helper: recipeHelp.epochs,
          recommended: isEnglish
            ? "Smoke 100-300, longer 800-1500"
            : "冒烟 100-300，长轮次 800-1500",
          impact:
            estimatedTrainingSamples !== null
              ? `${text.trainSamples}: ${formatSampleCount(estimatedTrainingSamples)}`
              : "--",
        },
        {
          label: text.learningRate,
          value: String(recipeForm.learningRate),
          helper: recipeHelp.learningRate,
          recommended: "2e-4 LoRA / 5e-5 cautious",
          impact: isEnglish
            ? "Too high can spike loss."
            : "过高容易让 loss 抖动。",
        },
        {
          label: text.epochs,
          value: String(recipeForm.epochs),
          helper: recipeHelp.epochs,
          recommended: isEnglish
            ? "1-3 starter passes"
            : "starter 建议 1-3 轮",
          impact: isEnglish
            ? "More passes raise overfit risk."
            : "轮次越多越需要防过拟合。",
        },
      ],
    },
    {
      label: text.recipeGroupAdapter,
      items: [
        {
          label: text.fineTuneMethod,
          value: recipeForm.fineTuneMethod.toUpperCase(),
          helper: recipeHelp.fineTuneMethod,
          recommended: "LoRA",
          impact: isEnglish
            ? "DoRA is heavier and experimental."
            : "DoRA 更重且更实验。",
        },
        {
          label: `${text.loraRank} / ${text.loraAlpha}`,
          value: adapterCapacity,
          helper: `${recipeHelp.loraRank} ${recipeHelp.loraAlpha}`,
          recommended: "r16 / alpha32",
          impact: isEnglish
            ? "Higher rank grows adapter size."
            : "rank 越高 adapter 越大。",
        },
        {
          label: text.targetModules,
          value: recipeForm.targetModules.join(", ") || "--",
          helper: recipeHelp.targetModules,
          recommended: isEnglish
            ? "Model-family default"
            : "模型族默认值",
          impact: isEnglish
            ? "Controls adapter coverage."
            : "决定 adapter 覆盖范围。",
        },
        {
          label: text.numLayers,
          value: String(recipeForm.numLayers),
          helper: recipeHelp.numLayers,
          recommended: isEnglish
            ? "8-16 local starter"
            : "本地 starter 建议 8-16",
          impact: isEnglish
            ? "More layers cost memory and time."
            : "层数越多越耗内存和时间。",
        },
        {
          label: text.optimizer,
          value: recipeForm.optimizer.toUpperCase(),
          helper: recipeHelp.optimizer,
          recommended: "AdamW",
          impact: isEnglish
            ? "Keep stable unless comparing recipes."
            : "非配方对比不建议频繁改。",
        },
        {
          label: text.scheduler,
          value: `${recipeForm.scheduler} / ${recipeForm.warmupRatio}`,
          helper: `${recipeHelp.scheduler} ${recipeHelp.warmupRatio}`,
          recommended: "cosine / 0.03",
          impact: isEnglish
            ? "Stabilizes longer local runs."
            : "让长轮次训练更稳定。",
        },
        {
          label: text.packingPolicy,
          value: recipeForm.packingPolicy,
          helper: recipeHelp.packingPolicy,
          recommended: "disabled",
          impact: isEnglish
            ? "Avoids boundary bugs until masks are verified."
            : "边界和 mask 确认前避免引入噪音。",
        },
        {
          label: text.gradientCheckpointing,
          value: recipeForm.gradientCheckpointing
            ? isEnglish
              ? "Enabled"
              : "开启"
            : isEnglish
              ? "Disabled"
              : "关闭",
          helper: recipeHelp.gradientCheckpointing,
          recommended: isEnglish
            ? "Enabled on Apple Silicon"
            : "Apple Silicon 建议开启",
          impact: isEnglish
            ? "Saves memory, costs extra compute."
            : "省内存，但会增加计算。",
        },
      ],
    },
    {
      label: text.recipeGroupEvidence,
      items: [
        {
          label: text.validationSplitPct,
          value: `${recipeForm.validationSplitPct}%`,
          helper: recipeHelp.validationSplitPct,
          recommended: "10%",
          impact: isEnglish
            ? "Required for train/val curve."
            : "用于生成训练/验证曲线。",
        },
        {
          label: text.evalEverySteps,
          value: `${recipeForm.evalEverySteps} steps`,
          helper: recipeHelp.evalEverySteps,
          recommended: isEnglish
            ? "Match save cadence"
            : "与保存间隔一致",
          impact: isEnglish
            ? "Feeds best-checkpoint selection."
            : "用于选择最佳 checkpoint。",
        },
        {
          label: text.saveEverySteps,
          value: checkpointCadence,
          helper: recipeHelp.saveEverySteps,
          recommended: isEnglish
            ? "100-200 for long runs"
            : "长轮次建议 100-200",
          impact: isEnglish
            ? "More checkpoints improve recovery."
            : "checkpoint 越多越便于恢复。",
        },
        {
          label: text.bestCheckpointMetric,
          value: recipeForm.bestCheckpointMetric,
          helper: recipeHelp.bestCheckpointMetric,
          recommended: "eval_loss",
          impact: recipeForm.loadBestCheckpointAtEnd
            ? isEnglish
              ? "Selected checkpoint becomes handoff candidate."
              : "选中 checkpoint 会成为 handoff 候选。"
            : isEnglish
              ? "Reported but not auto-selected for handoff."
              : "只进入报告，不自动作为 handoff 候选。",
        },
        {
          label: text.seed,
          value: String(recipeForm.seed),
          helper: recipeHelp.seed,
          recommended: "42",
          impact: isEnglish ? "Keeps runs reproducible." : "保证实验可复现。",
        },
        {
          label: text.benchmarkSuite,
          value: recipeForm.benchmarkSuiteId || "--",
          helper: recipeHelp.benchmarkSuiteId,
          recommended: "milestone-formal",
          impact: isEnglish
            ? "Links adapter to release evidence."
            : "把 adapter 串到发布证据链。",
        },
      ],
    },
  ];
}
