import {
  buildSessionExportEnvelope,
  serializeSessionsAsMarkdown,
  type AgentSessionExportOptions,
  type StoredAgentSession,
} from "./session-model";

export type AgentSessionExportFormat = "markdown" | "json";

export function buildAgentSessionExport(
  sessions: StoredAgentSession[],
  format: AgentSessionExportFormat,
  options: AgentSessionExportOptions,
) {
  const content =
    format === "markdown"
      ? serializeSessionsAsMarkdown(sessions)
      : JSON.stringify(buildSessionExportEnvelope(sessions, options), null, 2);
  return {
    content,
    mimeType:
      format === "markdown"
        ? "text/markdown;charset=utf-8"
        : "application/json;charset=utf-8",
    extension: format === "markdown" ? "md" : "json",
  };
}

export function downloadAgentSessionExport(input: {
  sessions: StoredAgentSession[];
  format: AgentSessionExportFormat;
  options: AgentSessionExportOptions;
}) {
  if (!input.sessions.length) return false;
  const artifact = buildAgentSessionExport(
    input.sessions,
    input.format,
    input.options,
  );
  const blob = new Blob([artifact.content], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-sessions-${input.options.sessionTargetFilter}-${Date.now()}.${artifact.extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
