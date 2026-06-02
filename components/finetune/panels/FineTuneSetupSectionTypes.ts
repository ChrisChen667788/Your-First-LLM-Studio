import type { Dispatch, SetStateAction } from "react";
import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
  AgentFineTuneOperation,
  AgentFineTuneRecipe,
  AgentFineTuneReportExport,
  AgentFineTuneSummary,
} from "@/lib/agent/types";
import type {
  CommunityDatasetPreset,
  DatasetSourceMode,
  FineTuneCommunityImportFormState,
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
  FineTuneTrainingArgGroup,
  FineTuneTrainingArgItem,
  NumericRecipeFieldKey,
} from "@/features/finetune/setup-state";
import type {
  FineTuneDistillationFormState,
  FineTuneTrainStage,
} from "@/features/finetune/run-state";

export type {
  CommunityDatasetPreset,
  DatasetSourceMode,
  FineTuneCommunityImportFormState,
  FineTuneDatasetFormState,
  FineTuneRecipeFormState,
  FineTuneTrainingArgGroup,
  FineTuneTrainingArgItem,
  NumericRecipeFieldKey,
} from "@/features/finetune/setup-state";
export type {
  FineTuneDistillationFormState,
  FineTuneTrainStage,
} from "@/features/finetune/run-state";

export type FineTuneResponse = {
  ok?: boolean;
  error?: string;
  summary?: AgentFineTuneSummary;
  dataset?: AgentFineTuneDataset;
  validation?: AgentFineTuneDatasetValidation;
  report?: AgentFineTuneReportExport;
  operation?: AgentFineTuneOperation;
};

export type TextMap = Record<string, string>;

export type NumericRecipeFieldDescriptor = {
  key: NumericRecipeFieldKey;
  label: string;
  helper: string;
  step: number;
};

export type FineTuneActionPoster = (
  body: Record<string, unknown>,
  successMessage: string,
) => Promise<FineTuneResponse | null>;

export type FineTuneDatasetSetupSectionProps = {
  text: TextMap;
  isEnglish: boolean;
  datasetSourceMode: DatasetSourceMode;
  setDatasetSourceMode: Dispatch<SetStateAction<DatasetSourceMode>>;
  communityImportForm: FineTuneCommunityImportFormState;
  setCommunityImportForm: Dispatch<SetStateAction<FineTuneCommunityImportFormState>>;
  actionPending: Record<string, boolean | undefined>;
  importCommunityDatasetSource: () => Promise<void> | void;
  communityDatasetPresets: CommunityDatasetPreset[];
  getPresetLabel: (preset: CommunityDatasetPreset) => string;
  getPresetDescription: (preset: CommunityDatasetPreset) => string;
  getPresetBestFor: (preset: CommunityDatasetPreset) => string;
  getPresetDifficulty: (preset: CommunityDatasetPreset) => string;
  getPresetRecommendedSteps: (preset: CommunityDatasetPreset) => string;
  getPresetModelFit: (preset: CommunityDatasetPreset) => string;
  getPresetLicenseRisk: (preset: CommunityDatasetPreset) => string;
  applyCommunityDatasetPreset: (preset: CommunityDatasetPreset) => void;
  quickStartCommunityDatasetPreset: (preset: CommunityDatasetPreset) => Promise<void> | void;
  datasetForm: FineTuneDatasetFormState;
  setDatasetForm: Dispatch<SetStateAction<FineTuneDatasetFormState>>;
  validateDataset: () => Promise<FineTuneResponse | null> | void;
  saveDataset: () => Promise<FineTuneResponse | null> | void;
  canSaveDataset: boolean;
  datasetValidation: AgentFineTuneDatasetValidation | null;
  datasetValidationQuality: AgentFineTuneDatasetQuality | null;
  datasetValidationQualityWarnings: string[];
  formatSampleCount: (count?: number | null) => string;
  formatQualityScore: (score?: number | null) => string;
  getLicenseRiskLabel: (risk?: AgentFineTuneDatasetQuality["licenseRisk"]) => string;
};

export type FineTuneRecipeSetupSectionProps = {
  text: TextMap;
  summary: AgentFineTuneSummary | null;
  recipeForm: FineTuneRecipeFormState;
  setRecipeForm: Dispatch<SetStateAction<FineTuneRecipeFormState>>;
  recipeHelp: TextMap;
  recipeScheduleFields: NumericRecipeFieldDescriptor[];
  recipeAdapterFields: NumericRecipeFieldDescriptor[];
  recipeEvidenceFields: NumericRecipeFieldDescriptor[];
  updateRecipeNumber: (key: NumericRecipeFieldKey, value: string) => void;
  saveRecipe: () => Promise<FineTuneResponse | null> | void;
};

export type FineTuneTrainSetupSectionProps = {
  text: TextMap;
  summary: AgentFineTuneSummary | null;
  selectedRecipeId: string;
  setSelectedRecipeId: Dispatch<SetStateAction<string>>;
  selectedRecipe: AgentFineTuneRecipe | null;
  stageRecipeJob: (recipeId: string) => Promise<FineTuneResponse | null> | void;
};
