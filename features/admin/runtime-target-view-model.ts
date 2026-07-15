import { getBenchmarkContextRecommendationHelper } from "@/lib/agent/context-recommendation";
import type {
  AgentRuntimeLogSummary,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";
import { formatRecommendedContextBadge } from "./telemetry-components";
import {
  describeAdminRuntimeAlias,
  describeAdminRuntimePhase,
} from "./runtime-formatters";

export type AdminRuntimeMetricSample = {
  timestamp: string;
  gatewayCpuPct: number | null;
  gatewayResidentMemoryMb: number | null;
  gatewayGpuPct: number | null;
  gatewayGpuMemoryMb: number | null;
  gatewayEnergySignalPct: number | null;
  gatewayDiskUsedPct: number | null;
  modelStorageFootprintMb: number | null;
};

type RuntimeOverviewText = {
  supervisor: string;
  gateway: string;
  restartCount: string;
  lastExitCode: string;
  lastStart: string;
  lastExit: string;
  ok: string;
  failed: string;
  unknown: string;
};

function numericHistory(
  samples: AdminRuntimeMetricSample[],
  key: keyof AdminRuntimeMetricSample,
) {
  return samples
    .map((entry) => entry[key])
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
}

export function buildAdminRuntimeTargetViewModel(input: {
  target: AgentTarget;
  runtime: AgentRuntimeStatus | null | undefined;
  metricHistory: AdminRuntimeMetricSample[];
  localTargets: AgentTarget[];
  locale: string;
  action: string;
  runtimeMessage: string;
  logExcerpt: string;
  logSummary?: AgentRuntimeLogSummary | null;
  runtimeLogQuery: string;
  runtimeLogLimit: number;
  lastSwitchMs: number | null;
  lastSwitchAt: string | null;
  text: RuntimeOverviewText;
}) {
  const {
    target,
    metricHistory,
    localTargets,
    locale,
    text,
  } = input;
  const runtime = input.runtime || undefined;
  const runtimeIsIdle = runtime?.phase === "unloaded";
  const loadedAliasForTarget =
    runtime?.loadedAlias === target.id ? runtime.loadedAlias : null;
  const gatewayLoadedOtherAlias =
    runtime?.loadedAlias && runtime.loadedAlias !== target.id
      ? runtime.loadedAlias
      : null;
  const liveCostTargetLabel = loadedAliasForTarget
    ? target.label
    : gatewayLoadedOtherAlias
      ? describeAdminRuntimeAlias(gatewayLoadedOtherAlias, localTargets)
      : null;
  const supervisorValue = runtime?.supervisorPid
    ? String(runtime.supervisorPid)
    : runtimeIsIdle
      ? locale.startsWith("en")
        ? "On-demand"
        : "按需"
      : "—";
  const supervisorDetail = runtime?.supervisorPid
    ? runtime.supervisorAlive
      ? text.ok
      : text.failed
    : runtimeIsIdle
      ? locale.startsWith("en")
        ? "Not required while idle"
        : "空载时无需常驻"
      : text.unknown;
  const gatewayValue = runtime?.gatewayPid ? String(runtime.gatewayPid) : "—";
  const gatewayDetail = runtime?.gatewayAlive
    ? runtimeIsIdle
      ? locale.startsWith("en")
        ? "Idle"
        : "空载"
      : text.ok
    : runtimeIsIdle
      ? locale.startsWith("en")
        ? "Cold"
        : "冷启动"
      : text.failed;

  return {
    runtime,
    cpuHistory: numericHistory(metricHistory, "gatewayCpuPct"),
    rssHistory: numericHistory(metricHistory, "gatewayResidentMemoryMb"),
    gpuHistory: numericHistory(metricHistory, "gatewayGpuPct"),
    gpuMemoryHistory: numericHistory(metricHistory, "gatewayGpuMemoryMb"),
    energyHistory: numericHistory(metricHistory, "gatewayEnergySignalPct"),
    diskUsedHistory: numericHistory(metricHistory, "gatewayDiskUsedPct"),
    action: input.action,
    runtimeMessage: input.runtimeMessage,
    logExcerpt: input.logExcerpt,
    logSummary: input.logSummary || undefined,
    runtimePhase: describeAdminRuntimePhase(runtime || null, locale),
    runtimeLogQuery: input.runtimeLogQuery,
    runtimeLogLimit: input.runtimeLogLimit,
    loadedAliasForTarget,
    gatewayLoadedOtherAlias,
    liveCostTargetLabel,
    recommendedContextBadge: formatRecommendedContextBadge(
      target.recommendedContextWindow,
    ),
    benchmarkContextHelper:
      target.execution === "local"
        ? getBenchmarkContextRecommendationHelper(locale)
        : "",
    lastSwitchMsForTarget: input.lastSwitchMs,
    lastSwitchAtForTarget: input.lastSwitchAt,
    runtimeIsIdle,
    overviewCards: [
      { label: text.supervisor, value: supervisorValue, detail: supervisorDetail },
      { label: text.gateway, value: gatewayValue, detail: gatewayDetail },
      {
        label: text.restartCount,
        value: String(runtime?.restartCount ?? 0),
        detail: locale.startsWith("en")
          ? "Gateway restarts observed"
          : "累计网关重启次数",
      },
      {
        label: text.lastExitCode,
        value:
          typeof runtime?.lastExitCode === "number"
            ? String(runtime.lastExitCode)
            : "—",
        detail: locale.startsWith("en")
          ? "Latest process exit code"
          : "最近一次进程退出码",
      },
      {
        label: text.lastStart,
        value: runtime?.lastStartAt
          ? new Date(runtime.lastStartAt).toLocaleString()
          : "—",
        detail: locale.startsWith("en")
          ? "Last gateway start"
          : "最近一次网关启动",
      },
      {
        label: text.lastExit,
        value: runtime?.lastExitAt
          ? new Date(runtime.lastExitAt).toLocaleString()
          : "—",
        detail: locale.startsWith("en")
          ? "Last gateway stop"
          : "最近一次网关退出",
      },
    ],
  };
}
