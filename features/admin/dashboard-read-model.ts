import type { AgentProviderHealthDeskItem } from "@/lib/agent/types";

type NumberPoint = { value: number };
type TelemetryPoint = {
  memoryUsedPct?: number | null;
  batteryPercent?: number | null;
  gpuProxyPct?: number | null;
  diskUsedPct?: number | null;
  energyProxyPct?: number | null;
  activeForTarget?: number | null;
};

type AdminOperationsSource<TLatestTelemetry> = {
  latestTelemetry?: TLatestTelemetry;
  providerHealthDesk?: AgentProviderHealthDeskItem[];
  series?: {
    requests?: NumberPoint[];
    totalTokens?: NumberPoint[];
    telemetry?: TelemetryPoint[];
    firstTokenLatency?: NumberPoint[];
    totalLatency?: NumberPoint[];
    appOverhead?: NumberPoint[];
    tokenThroughput?: NumberPoint[];
  };
} | null;

export function buildAdminOperationsReadModel<TLatestTelemetry>(
  data: AdminOperationsSource<TLatestTelemetry>,
) {
  const series = data?.series;
  const telemetry = series?.telemetry || [];
  return {
    latestTelemetry: data?.latestTelemetry,
    providerHealthDeskRows: data?.providerHealthDesk || [],
    requestValues: series?.requests?.map((entry) => entry.value) || [],
    tokenValues: series?.totalTokens?.map((entry) => entry.value) || [],
    memoryValues: telemetry.map((entry) => entry.memoryUsedPct ?? 0),
    batteryValues: telemetry.map((entry) => entry.batteryPercent ?? 0),
    gpuValues: telemetry.map((entry) => entry.gpuProxyPct ?? 0),
    storageValues: telemetry.map((entry) => entry.diskUsedPct ?? 0),
    energyValues: telemetry.map((entry) => entry.energyProxyPct ?? 0),
    concurrencyValues: telemetry.map((entry) => entry.activeForTarget ?? 0),
    firstTokenLatencyValues:
      series?.firstTokenLatency?.map((entry) => entry.value) || [],
    totalLatencyValues:
      series?.totalLatency?.map((entry) => entry.value) || [],
    appOverheadValues: series?.appOverhead?.map((entry) => entry.value) || [],
    tokenThroughputValues:
      series?.tokenThroughput?.map((entry) => entry.value) || [],
  };
}
