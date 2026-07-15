"use client";

import { useCallback } from "react";
import { serializeTurnsAsMarkdown, type AgentTurn } from "./session-model";

export type AgentTranscriptExportFormat = "markdown" | "json";

export function buildAgentTranscriptExport(
  turns: AgentTurn[],
  format: AgentTranscriptExportFormat,
) {
  return format === "markdown"
    ? serializeTurnsAsMarkdown(turns)
    : JSON.stringify({ generatedAt: new Date().toISOString(), turns }, null, 2);
}

export function downloadAgentTranscript(input: {
  turns: AgentTurn[];
  selectedTargetId: string;
  format: AgentTranscriptExportFormat;
}) {
  if (!input.turns.length) return false;
  const blob = new Blob([buildAgentTranscriptExport(input.turns, input.format)], {
    type:
      input.format === "markdown"
        ? "text/markdown;charset=utf-8"
        : "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-transcript-${input.selectedTargetId}-${Date.now()}.${input.format === "markdown" ? "md" : "json"}`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function useAgentTranscriptExportActions(input: {
  turns: AgentTurn[];
  selectedTargetId: string;
}) {
  const handleExportTurns = useCallback(
    (format: AgentTranscriptExportFormat) =>
      downloadAgentTranscript({ ...input, format }),
    [input.selectedTargetId, input.turns],
  );
  return { handleExportTurns };
}
