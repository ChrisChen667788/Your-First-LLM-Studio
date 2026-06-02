"use client";

import type { ComponentProps } from "react";
import type {
  FineTuneLabTab,
  FineTuneWorkspaceTab,
} from "@/features/finetune/state";
import {
  FineTuneDatasetSetupSection,
  FineTuneRecipeSetupSection,
  FineTuneTrainSetupSection,
} from "@/components/finetune/panels";

type FineTuneSetupComposerProps = {
  activeWorkspaceTab: FineTuneWorkspaceTab;
  activeFineTuneLabTab: FineTuneLabTab;
  datasetSetupProps: ComponentProps<typeof FineTuneDatasetSetupSection>;
  recipeSetupProps: ComponentProps<typeof FineTuneRecipeSetupSection>;
  trainSetupProps: ComponentProps<typeof FineTuneTrainSetupSection>;
};

export function FineTuneSetupComposer({
  activeWorkspaceTab,
  activeFineTuneLabTab,
  datasetSetupProps,
  recipeSetupProps,
  trainSetupProps,
}: FineTuneSetupComposerProps) {
  return (
    <div
      className={`mt-5 grid gap-4 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1.12fr)] 2xl:grid-cols-[minmax(380px,1.02fr)_minmax(460px,1.18fr)_minmax(340px,0.84fr)] ${
        activeWorkspaceTab === "setup" && activeFineTuneLabTab === "train"
          ? ""
          : "hidden"
      }`}
    >
      <FineTuneDatasetSetupSection {...datasetSetupProps} />
      <FineTuneRecipeSetupSection {...recipeSetupProps} />
      <FineTuneTrainSetupSection {...trainSetupProps} />
    </div>
  );
}
