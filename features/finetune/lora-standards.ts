import {
  LORA_PACKING_POLICIES,
  LORA_SCHEDULER_PRESETS,
  LORA_TARGET_MODULE_PRESETS,
  buildLoraTrainingDefaults,
  getLoraTargetModulePreset,
} from "@/lib/finetune/lora-config";

export type FineTuneLoraStandardsViewModel = {
  targetModulePreset: ReturnType<typeof getLoraTargetModulePreset>;
  defaults: ReturnType<typeof buildLoraTrainingDefaults>;
  schedulerPresets: typeof LORA_SCHEDULER_PRESETS;
  packingPolicies: typeof LORA_PACKING_POLICIES;
  checklist: string[];
};

export function buildFineTuneLoraStandardsViewModel(modelId: string): FineTuneLoraStandardsViewModel {
  return {
    targetModulePreset: getLoraTargetModulePreset(modelId),
    defaults: buildLoraTrainingDefaults(modelId),
    schedulerPresets: LORA_SCHEDULER_PRESETS,
    packingPolicies: LORA_PACKING_POLICIES,
    checklist: [
      "Keep a baseline run before training.",
      "Reserve a real validation split and evaluate every save interval.",
      "Save checkpoints every 100 steps for long local experiments.",
      "Select the best checkpoint by eval_loss before exporting adapters.",
      "Prefer no packing until chat boundaries and loss masks are verified.",
    ],
  };
}

export { LORA_PACKING_POLICIES, LORA_SCHEDULER_PRESETS, LORA_TARGET_MODULE_PRESETS };
