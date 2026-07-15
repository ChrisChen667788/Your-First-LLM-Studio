import type { ComponentProps } from "react";
import { AgentComposerForm } from "./agent-composer-form";
import { AgentGetCodePanel } from "./get-code-panel";
import { AgentSecondaryAnalysisPanel } from "./secondary-analysis-panel";
import { AgentSessionToolsPanel } from "./session-tools-panel";
import { AgentTranscriptPanel } from "./agent-transcript-panel";
import { AgentTargetProfilePanel } from "./target-profile-panel";
import { TargetCatalogPanel } from "./target-catalog-panel";
import { AgentWorkbenchHeader } from "./workbench-header";
import { AgentWorkbenchLayout } from "./workbench-layout";
import { AgentWorkbenchPromptStrip } from "./workbench-prompt-strip";
import { AgentWorkbenchStatusBand } from "./workbench-status-band";

export function buildAgentSessionToolsProps(
  input: ComponentProps<typeof AgentSessionToolsPanel>,
) {
  return input;
}

export function buildAgentTranscriptProps(
  input: ComponentProps<typeof AgentTranscriptPanel>,
) {
  return input;
}

export function buildAgentComposerProps(
  input: ComponentProps<typeof AgentComposerForm>,
) {
  return input;
}

export function buildAgentSecondaryAnalysisProps(
  input: ComponentProps<typeof AgentSecondaryAnalysisPanel>,
) {
  return input;
}

export function buildAgentGetCodeProps(
  input: ComponentProps<typeof AgentGetCodePanel>,
) {
  return input;
}

export function buildAgentTargetCatalogProps(
  input: ComponentProps<typeof TargetCatalogPanel>,
) {
  return input;
}

export function buildAgentTargetProfileProps(
  input: ComponentProps<typeof AgentTargetProfilePanel>,
) {
  return input;
}

export function buildAgentWorkbenchHeaderProps(
  input: ComponentProps<typeof AgentWorkbenchHeader>,
) {
  return input;
}

export function buildAgentWorkbenchStatusBandProps(
  input: ComponentProps<typeof AgentWorkbenchStatusBand>,
) {
  return input;
}

export function buildAgentWorkbenchPromptStripProps(
  input: ComponentProps<typeof AgentWorkbenchPromptStrip>,
) {
  return input;
}

export function buildAgentWorkbenchLayoutProps(
  input: ComponentProps<typeof AgentWorkbenchLayout>,
) {
  return input;
}
