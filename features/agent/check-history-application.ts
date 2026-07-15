import {
  getObservabilityPaths,
  readConnectionCheckLogs,
  serializeConnectionChecksAsMarkdown,
} from "@/lib/agent/log-store";

export function readAgentCheckHistory(input?: {
  targetId?: string;
  limit?: number;
}) {
  const limit = Number.isFinite(input?.limit) && (input?.limit || 0) > 0
    ? Math.min(input?.limit || 50, 200)
    : 50;
  const logs = readConnectionCheckLogs({ targetId: input?.targetId, limit });
  return { count: logs.length, paths: getObservabilityPaths(), logs };
}

export function exportAgentCheckHistory(input?: {
  targetId?: string;
  format?: string;
}) {
  const targetId = input?.targetId;
  const format = (input?.format || "markdown").toLowerCase();
  const logs = readConnectionCheckLogs({ targetId, limit: 500 });
  const suffix = targetId ? `-${targetId}` : "";
  if (format === "json") {
    return {
      body: JSON.stringify(logs, null, 2),
      contentType: "application/json; charset=utf-8",
      filename: `connection-checks${suffix}.json`,
    };
  }
  return {
    body: serializeConnectionChecksAsMarkdown(logs),
    contentType: "text/markdown; charset=utf-8",
    filename: `connection-checks${suffix}.md`,
  };
}
