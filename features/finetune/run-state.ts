"use client";

import { useState } from "react";

export type FineTuneTrainStage =
  | "supervised-fine-tune"
  | "continued-pretrain"
  | "preference-tuning"
  | "distillation";

export type FineTuneEvalMetric =
  | "loss"
  | "rouge-l"
  | "bleu"
  | "exact-match"
  | "latency";

export type FineTuneEvaluateFormState = {
  datasetId: string;
  checkpointPath: string;
  maxSamples: number;
  maxNewTokens: number;
  temperature: number;
  topP: number;
  metrics: FineTuneEvalMetric[];
  savePredictions: boolean;
};

export type FineTuneChatFormState = {
  adapterId: string;
  role: "user" | "assistant" | "system";
  systemPrompt: string;
  prompt: string;
  maxNewTokens: number;
  temperature: number;
  topP: number;
  skipSpecialTokens: boolean;
  renderHtmlTags: boolean;
};

export type FineTuneDistillationFormState = {
  teacherTargetId: string;
  outputPath: string;
  sampleCount: number;
  maxNewTokens: number;
  temperature: number;
  topP: number;
  seedPrompt: string;
  includeReasoningTrace: boolean;
};

export type FineTuneExportFormState = {
  adapterId: string;
  quantization: "none" | "q8" | "q4";
  exportFormat: "adapter-bundle" | "merged-mlx" | "gguf";
  maxShardSizeGb: number;
  outputDir: string;
  hubId: string;
  includeDatasetCard: boolean;
};

export const DEFAULT_EVALUATE_FORM: FineTuneEvaluateFormState = {
  datasetId: "",
  checkpointPath: "",
  maxSamples: 64,
  maxNewTokens: 512,
  temperature: 0.2,
  topP: 0.8,
  metrics: ["loss", "rouge-l", "exact-match"],
  savePredictions: true,
};

export const DEFAULT_CHAT_FORM: FineTuneChatFormState = {
  adapterId: "",
  role: "user",
  systemPrompt:
    "You are testing a fine-tuned local adapter. Answer directly and avoid exposing training metadata.",
  prompt:
    "Summarize the current fine-tune result in three concise bullets for a teammate.",
  maxNewTokens: 512,
  temperature: 0.7,
  topP: 0.9,
  skipSpecialTokens: true,
  renderHtmlTags: false,
};

export const DEFAULT_DISTILLATION_FORM: FineTuneDistillationFormState = {
  teacherTargetId: "",
  outputPath: "data/fine-tune/distilled/starter-distill.jsonl",
  sampleCount: 384,
  maxNewTokens: 768,
  temperature: 0.4,
  topP: 0.85,
  seedPrompt:
    "Generate concise coding-agent supervision samples for compare, benchmark, retrieval, and local runtime recovery tasks.",
  includeReasoningTrace: false,
};

export const DEFAULT_EXPORT_FORM: FineTuneExportFormState = {
  adapterId: "",
  quantization: "none",
  exportFormat: "adapter-bundle",
  maxShardSizeGb: 5,
  outputDir: "",
  hubId: "",
  includeDatasetCard: true,
};

export function useFineTuneRunState() {
  const [trainStage, setTrainStage] = useState<FineTuneTrainStage>(
    "supervised-fine-tune",
  );
  const [evaluateForm, setEvaluateForm] = useState(DEFAULT_EVALUATE_FORM);
  const [chatForm, setChatForm] = useState(DEFAULT_CHAT_FORM);
  const [distillationForm, setDistillationForm] = useState(
    DEFAULT_DISTILLATION_FORM,
  );
  const [exportForm, setExportForm] = useState(DEFAULT_EXPORT_FORM);

  return {
    trainStage,
    setTrainStage,
    evaluateForm,
    setEvaluateForm,
    chatForm,
    setChatForm,
    distillationForm,
    setDistillationForm,
    exportForm,
    setExportForm,
  };
}
