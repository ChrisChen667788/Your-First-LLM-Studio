"use client";

import { useState } from "react";
import type {
  AgentFineTuneDatasetFormat,
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
} from "@/lib/agent/types";

export type DatasetSourceMode = "local" | "community";

export type FineTuneDatasetFormState = {
  label: string;
  sourcePath: string;
  format: AgentFineTuneDatasetFormat;
  upstreamQuery: string;
  refreshCadenceHours: number;
};

export type FineTuneCommunityImportFormState = {
  label: string;
  sourceUrl: string;
  sourceLabel: string;
  format: AgentFineTuneDatasetFormat;
  sampleLimit: number;
  license: string;
  upstreamQuery: string;
};

export type NumericRecipeFieldKey =
  | "sequenceLength"
  | "batchSize"
  | "epochs"
  | "learningRate"
  | "numLayers"
  | "gradientAccumulationSteps"
  | "loraRank"
  | "loraAlpha"
  | "validationSplitPct"
  | "saveEverySteps"
  | "seed";

export type FineTuneRecipeFormState = {
  label: string;
  datasetId: string;
  baseTargetId: string;
  adapterName: string;
  sequenceLength: number;
  batchSize: number;
  epochs: number;
  learningRate: number;
  fineTuneMethod: "lora" | "dora";
  optimizer: "adam" | "adamw" | "sgd" | "adafactor";
  numLayers: number;
  gradientAccumulationSteps: number;
  loraRank: number;
  loraAlpha: number;
  gradientCheckpointing: boolean;
  validationSplitPct: number;
  saveEverySteps: number;
  seed: number;
  benchmarkSuiteId: string;
  notes: string;
};

export type FineTuneTrainingArgItem = {
  label: string;
  value: string;
  helper: string;
  recommended: string;
  impact: string;
};

export type FineTuneTrainingArgGroup = {
  label: string;
  items: FineTuneTrainingArgItem[];
};

export type CommunityDatasetPreset = {
  id: string;
  label: { en: string; zh: string };
  description: { en: string; zh: string };
  bestFor: { en: string; zh: string };
  source: "Bundled" | "Hugging Face" | "ModelScope" | "GitHub";
  sourceUrl: string;
  docsUrl?: string;
  paperUrl?: string;
  localPath: string;
  format: AgentFineTuneDatasetFormat;
  upstreamQuery: string;
  sampleCount: number;
  bootstrapRows: number;
  recommendedSamples: number;
  recommendedEpochs: number;
  recommendedSteps: { en: string; zh: string };
  difficulty: { en: string; zh: string };
  license: string;
  recipeNotes: { en: string; zh: string };
};

export type PresetDatasetSaveMetadata = Record<string, unknown> & {
  quality?: AgentFineTuneDatasetQuality;
  qualityWarnings?: string[];
};

export type FineTuneDatasetWatchDraft = {
  upstreamQuery: string;
  refreshCadenceHours: number;
};

export const DEFAULT_DATASET_FORM: FineTuneDatasetFormState = {
  label: "",
  sourcePath: "",
  format: "chat-jsonl",
  upstreamQuery: "",
  refreshCadenceHours: 24,
};

export const DEFAULT_COMMUNITY_IMPORT_FORM: FineTuneCommunityImportFormState = {
  label: "",
  sourceUrl: "",
  sourceLabel: "",
  format: "instruction-jsonl",
  sampleLimit: 384,
  license: "",
  upstreamQuery: "",
};

export const DEFAULT_RECIPE_FORM: FineTuneRecipeFormState = {
  label: "",
  datasetId: "",
  baseTargetId: "",
  adapterName: "",
  sequenceLength: 8192,
  batchSize: 4,
  epochs: 3,
  learningRate: 0.0002,
  fineTuneMethod: "lora",
  optimizer: "adamw",
  numLayers: 16,
  gradientAccumulationSteps: 1,
  loraRank: 16,
  loraAlpha: 32,
  gradientCheckpointing: true,
  validationSplitPct: 10,
  saveEverySteps: 0,
  seed: 42,
  benchmarkSuiteId: "milestone-formal",
  notes: "",
};

export function useFineTuneSetupState() {
  const [datasetForm, setDatasetForm] = useState(DEFAULT_DATASET_FORM);
  const [communityImportForm, setCommunityImportForm] = useState(
    DEFAULT_COMMUNITY_IMPORT_FORM,
  );
  const [datasetSourceMode, setDatasetSourceMode] =
    useState<DatasetSourceMode>("local");
  const [recipeForm, setRecipeForm] = useState(DEFAULT_RECIPE_FORM);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [datasetValidation, setDatasetValidation] =
    useState<AgentFineTuneDatasetValidation | null>(null);
  const [datasetValidationQuality, setDatasetValidationQuality] =
    useState<AgentFineTuneDatasetQuality | null>(null);
  const [
    datasetValidationQualityWarnings,
    setDatasetValidationQualityWarnings,
  ] = useState<string[]>([]);
  const [datasetWatchDrafts, setDatasetWatchDrafts] = useState<
    Record<string, FineTuneDatasetWatchDraft>
  >({});

  return {
    datasetForm,
    setDatasetForm,
    communityImportForm,
    setCommunityImportForm,
    datasetSourceMode,
    setDatasetSourceMode,
    recipeForm,
    setRecipeForm,
    selectedRecipeId,
    setSelectedRecipeId,
    datasetValidation,
    setDatasetValidation,
    datasetValidationQuality,
    setDatasetValidationQuality,
    datasetValidationQualityWarnings,
    setDatasetValidationQualityWarnings,
    datasetWatchDrafts,
    setDatasetWatchDrafts,
  };
}
