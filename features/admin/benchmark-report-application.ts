export type AdminBenchmarkReportEntry = {
  runId?: string;
  benchmarkMode?: "prompt" | "dataset" | "suite";
  profileBatchScope?: "full-suite" | "comparison-subset";
  promptSetId?: string;
  datasetId?: string;
  suiteId?: string;
  prompt?: string;
  providerProfile?: string;
  thinkingMode?: string;
  contextWindow?: number;
  results?: Array<{ targetId: string }>;
};

export function buildAdminBenchmarkReportQuery(input: {
  entry?: AdminBenchmarkReportEntry | null;
  fallbackTargetIds: string[];
  windowMinutes: number;
}) {
  const { entry } = input;
  const query = new URLSearchParams({
    benchmarkMode: entry?.benchmarkMode || "prompt",
    targetIds:
      entry?.results?.map((result) => result.targetId).join(",") ||
      input.fallbackTargetIds.join(","),
    windowMinutes: String(input.windowMinutes),
    providerProfile: entry?.providerProfile || "balanced",
    thinkingMode: entry?.thinkingMode || "standard",
    contextWindow: String(entry?.contextWindow || 32768),
  });
  if (entry?.runId) query.set("runId", entry.runId);
  if (entry?.promptSetId) query.set("promptSetId", entry.promptSetId);
  else if (entry?.datasetId) query.set("datasetId", entry.datasetId);
  else if (entry?.suiteId) query.set("suiteId", entry.suiteId);
  else if (entry?.prompt?.trim()) query.set("prompt", entry.prompt.trim());
  if (entry?.profileBatchScope) {
    query.set("profileBatchScope", entry.profileBatchScope);
  }
  return query;
}

export function openAdminBenchmarkReport(input: {
  entry?: AdminBenchmarkReportEntry | null;
  fallbackTargetIds: string[];
  windowMinutes: number;
}) {
  const query = buildAdminBenchmarkReportQuery(input);
  window.open(`/api/admin/benchmark/report?${query.toString()}`, "_blank");
}
