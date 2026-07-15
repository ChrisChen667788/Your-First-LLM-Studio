import type { ComponentProps, ReactNode } from "react";
import type { AgentWorkbenchMode } from "@/lib/agent/types";
import { AgentComposerForm } from "./agent-composer-form";
import { AgentSecondaryAnalysisPanel } from "./secondary-analysis-panel";
import { AgentTranscriptPanel } from "./agent-transcript-panel";

export type AgentWorkbenchModeContentProps = {
  mode: AgentWorkbenchMode;
  transcriptProps: ComponentProps<typeof AgentTranscriptPanel>;
  composerProps: ComponentProps<typeof AgentComposerForm>;
  secondaryAnalysisProps: ComponentProps<typeof AgentSecondaryAnalysisPanel>;
  compareContent: ReactNode;
};

export function AgentWorkbenchModeContent({
  mode,
  transcriptProps,
  composerProps,
  secondaryAnalysisProps,
  compareContent,
}: AgentWorkbenchModeContentProps) {
  if (mode === "compare") return compareContent;
  return (
    <>
      <AgentTranscriptPanel {...transcriptProps} />
      <AgentComposerForm {...composerProps} />
      <AgentSecondaryAnalysisPanel {...secondaryAnalysisProps} />
    </>
  );
}
