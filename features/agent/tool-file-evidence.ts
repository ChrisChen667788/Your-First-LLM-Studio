export type AgentToolFileEvidence = {
  path: string;
  startLine: number;
  endLine: number;
  citation: string;
  numberedContent: string;
};

function readPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null;
}

export function readAgentToolFileEvidence(
  toolName: string,
  output: Record<string, unknown> | null,
): AgentToolFileEvidence | null {
  if (toolName !== "read_file" || !output) return null;
  const path = typeof output.path === "string" ? output.path.trim() : "";
  const content = typeof output.content === "string" ? output.content : "";
  const startLine = readPositiveInteger(output.startLine);
  const endLine = readPositiveInteger(output.endLine);
  if (!path || !content || !startLine || !endLine || endLine < startLine) return null;
  return {
    path,
    startLine,
    endLine,
    citation:
      typeof output.citation === "string" && output.citation.trim()
        ? output.citation.trim()
        : `${path}:${startLine}-${endLine}`,
    numberedContent: content
      .split("\n")
      .slice(0, endLine - startLine + 1)
      .map((line, index) => `${String(startLine + index).padStart(4, " ")} | ${line}`)
      .join("\n"),
  };
}
