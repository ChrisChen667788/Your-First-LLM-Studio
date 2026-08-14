"use client";

import type { ComponentProps } from "react";
import type { FineTuneWorkspaceTab } from "@/features/finetune/state";
import {
  FineTuneAssetsPanel,
  FineTuneRunsPanel,
} from "@/components/finetune/panels";

type FineTuneEvidenceComposerProps = {
  activeWorkspaceTab: FineTuneWorkspaceTab;
  assetsPanelProps: ComponentProps<typeof FineTuneAssetsPanel>;
  runsPanelProps: ComponentProps<typeof FineTuneRunsPanel>;
};

export function FineTuneEvidenceComposer({
  activeWorkspaceTab,
  assetsPanelProps,
  runsPanelProps,
}: FineTuneEvidenceComposerProps) {
  return (
    <div
      className={`mt-5 grid gap-4 ${
        activeWorkspaceTab === "runs"
          ? "xl:grid-cols-1"
          : "xl:grid-cols-[0.95fr_1.2fr_1fr]"
      } ${activeWorkspaceTab === "setup" ? "hidden" : ""}`}
    >
      {activeWorkspaceTab === "assets" ? (
        <FineTuneAssetsPanel {...assetsPanelProps} />
      ) : null}

      {activeWorkspaceTab === "runs" ? (
        <FineTuneRunsPanel {...runsPanelProps} />
      ) : null}
    </div>
  );
}
