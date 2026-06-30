export type LoraModelFamily =
  | "qwen"
  | "llama"
  | "mistral"
  | "gemma"
  | "phi"
  | "generic";

export type LoraTargetModulePreset = {
  family: LoraModelFamily;
  label: string;
  targetModules: string[];
  rationale: string;
};

export type LoraSchedulerPreset = {
  id: "cosine" | "linear" | "constant-with-warmup";
  label: string;
  warmupRatio: number;
  minLearningRateRatio?: number;
  rationale: string;
};

export type LoraPackingPolicy = {
  id: "disabled" | "pack-by-length" | "chat-boundary-safe";
  label: string;
  requiresBoundaryMetadata: boolean;
  rationale: string;
};

export type LoraTrainingDefaults = {
  targetModules: string[];
  scheduler: LoraSchedulerPreset;
  packing: LoraPackingPolicy;
  evalEverySteps: number;
  saveEverySteps: number;
  bestCheckpointMetric: "eval_loss" | "win_rate" | "exact_match";
  loadBestCheckpointAtEnd: boolean;
};

export const LORA_TARGET_MODULE_PRESETS: LoraTargetModulePreset[] = [
  {
    family: "qwen",
    label: "Qwen/Qwen2/Qwen3 attention + MLP",
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    rationale: "Good default for Qwen-family SFT: attention adapts behavior, MLP captures task style.",
  },
  {
    family: "llama",
    label: "Llama attention + MLP",
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    rationale: "Matches the common PEFT recipe for Llama-derived decoder blocks.",
  },
  {
    family: "mistral",
    label: "Mistral attention + MLP",
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    rationale: "Keeps adapter coverage broad enough for instruction tuning without full fine-tune cost.",
  },
  {
    family: "gemma",
    label: "Gemma projections",
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    rationale: "Gemma adapters generally benefit from the same attention and feed-forward coverage.",
  },
  {
    family: "phi",
    label: "Phi compact decoder",
    targetModules: ["q_proj", "k_proj", "v_proj", "dense", "fc1", "fc2"],
    rationale: "Phi variants use a slightly different module naming shape; keep dense and feed-forward layers explicit.",
  },
  {
    family: "generic",
    label: "Generic attention-only fallback",
    targetModules: ["q_proj", "v_proj"],
    rationale: "Safe fallback when module naming is unknown; lower quality ceiling but fewer mismatch failures.",
  },
];

export const LORA_SCHEDULER_PRESETS: LoraSchedulerPreset[] = [
  {
    id: "cosine",
    label: "Cosine decay with warmup",
    warmupRatio: 0.03,
    minLearningRateRatio: 0.1,
    rationale: "Best default for longer LoRA runs because it avoids a hard learning-rate cliff.",
  },
  {
    id: "linear",
    label: "Linear decay with warmup",
    warmupRatio: 0.05,
    rationale: "Predictable for short supervised runs and easy to compare across experiments.",
  },
  {
    id: "constant-with-warmup",
    label: "Constant after warmup",
    warmupRatio: 0.02,
    rationale: "Useful for tiny smoke runs where decay can dominate the whole schedule.",
  },
];

export const LORA_PACKING_POLICIES: LoraPackingPolicy[] = [
  {
    id: "disabled",
    label: "No packing",
    requiresBoundaryMetadata: false,
    rationale: "Most debuggable option and safest for small local datasets.",
  },
  {
    id: "pack-by-length",
    label: "Pack by token length",
    requiresBoundaryMetadata: false,
    rationale: "Improves throughput when examples are short and homogeneous.",
  },
  {
    id: "chat-boundary-safe",
    label: "Chat boundary safe packing",
    requiresBoundaryMetadata: true,
    rationale: "Preferred for chat data once turn boundaries and masks are available.",
  },
];

export function inferLoraModelFamily(modelId: string): LoraModelFamily {
  const normalized = modelId.toLowerCase();
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("llama")) return "llama";
  if (normalized.includes("mistral") || normalized.includes("mixtral")) return "mistral";
  if (normalized.includes("gemma")) return "gemma";
  if (normalized.includes("phi")) return "phi";
  return "generic";
}

export function getLoraTargetModulePreset(modelId: string) {
  const family = inferLoraModelFamily(modelId);
  return (
    LORA_TARGET_MODULE_PRESETS.find((preset) => preset.family === family) ||
    LORA_TARGET_MODULE_PRESETS[LORA_TARGET_MODULE_PRESETS.length - 1]
  );
}

export function buildLoraTrainingDefaults(modelId: string): LoraTrainingDefaults {
  const targetPreset = getLoraTargetModulePreset(modelId);
  return {
    targetModules: targetPreset.targetModules,
    scheduler: LORA_SCHEDULER_PRESETS[0],
    packing: LORA_PACKING_POLICIES[0],
    evalEverySteps: 100,
    saveEverySteps: 100,
    bestCheckpointMetric: "eval_loss",
    loadBestCheckpointAtEnd: true,
  };
}
