export type AdminDashboardQueryInput = {
  selectedTargetId: string;
  windowMinutes: number;
  providerFilter: string;
  providerProfileFilter: string;
  benchmarkThinkingModeFilter: string;
  benchmarkHistorySourceFilter: string;
  benchmarkHeatmapPromptScope: string;
  benchmarkHeatmapSampleStatus: string;
  benchmarkHeatmapWindowMinutes: number;
  modelFilter: string;
  contextWindowFilter: string;
  compareTargetIds: string[];
  benchmarkTargetIds: string[];
};

export function buildAdminDashboardQuery(input: AdminDashboardQueryInput) {
  const query = new URLSearchParams({
    targetId: input.selectedTargetId,
    windowMinutes: String(input.windowMinutes),
    provider: input.providerFilter,
    providerProfile: input.providerProfileFilter,
    benchmarkThinkingMode: input.benchmarkThinkingModeFilter,
    benchmarkHistorySource: input.benchmarkHistorySourceFilter,
    benchmarkHeatmapPromptScope: input.benchmarkHeatmapPromptScope,
    benchmarkHeatmapSampleStatus: input.benchmarkHeatmapSampleStatus,
    benchmarkHeatmapWindowMinutes: String(input.benchmarkHeatmapWindowMinutes),
    model: input.modelFilter,
    contextWindow: input.contextWindowFilter,
    compareTargetIds: input.compareTargetIds.join(","),
    benchmarkTargetIds: input.benchmarkTargetIds.join(","),
  });
  return `/api/admin/dashboard?${query.toString()}`;
}
