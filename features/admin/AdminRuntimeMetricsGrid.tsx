import type { AgentRuntimeStatus } from "@/lib/agent/types";
import { RuntimeMetricSparkline } from "./telemetry-components";

export type AdminRuntimeMetricsGridProps = {
  locale: string;
  runtime?: AgentRuntimeStatus;
  liveCostTargetLabel: string | null;
  overviewCards: Array<{ label: string; value: string; detail: string }>;
  cpuHistory: number[];
  rssHistory: number[];
  gpuHistory: number[];
  gpuMemoryHistory: number[];
  energyHistory: number[];
  diskUsedHistory: number[];
};

export function AdminRuntimeMetricsGrid({
  locale,
  runtime,
  liveCostTargetLabel,
  overviewCards,
  cpuHistory,
  rssHistory,
  gpuHistory,
  gpuMemoryHistory,
  energyHistory,
  diskUsedHistory,
}: AdminRuntimeMetricsGridProps) {
  const isEnglish = locale.startsWith("en");
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {overviewCards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3.5 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
          <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{card.detail}</p>
        </div>
      ))}
      <RuntimeMetricSparkline
        title={isEnglish ? "Gateway CPU" : "网关 CPU"}
        latest={typeof runtime?.gatewayCpuPct === "number" ? `${runtime.gatewayCpuPct.toFixed(1)}%` : "--"}
        values={cpuHistory}
        tone="cyan"
        helper={
          liveCostTargetLabel
            ? isEnglish
              ? `Realtime process usage for ${liveCostTargetLabel}`
              : `${liveCostTargetLabel} 的实时进程开销`
            : isEnglish
              ? "No local model loaded"
              : "当前没有已加载模型"
        }
      />
      <RuntimeMetricSparkline
        title={isEnglish ? "Gateway RSS" : "网关内存"}
        latest={typeof runtime?.gatewayResidentMemoryMb === "number" ? `${runtime.gatewayResidentMemoryMb.toFixed(1)} MB` : "--"}
        values={rssHistory}
        tone="emerald"
        helper={isEnglish ? "Rolling resident memory footprint for the shared gateway process" : "共享本地网关进程的滚动常驻内存占用"}
      />
      <RuntimeMetricSparkline
        title={isEnglish ? "Gateway GPU" : "网关 GPU"}
        latest={typeof runtime?.gatewayGpuPct === "number" ? `${runtime.gatewayGpuPct.toFixed(1)}%` : "--"}
        values={gpuHistory}
        tone="violet"
        helper={isEnglish ? "Apple AGX device utilization sampled from ioreg without requiring sudo" : "通过 ioreg 采样 Apple AGX 设备利用率，无需 sudo"}
      />
      <RuntimeMetricSparkline
        title={isEnglish ? "GPU memory" : "GPU 显存"}
        latest={typeof runtime?.gatewayGpuMemoryMb === "number" ? `${runtime.gatewayGpuMemoryMb.toFixed(1)} MB` : "--"}
        values={gpuMemoryHistory}
        tone="amber"
        helper={isEnglish ? "Shared GPU system memory currently in use by AGX" : "AGX 当前占用的共享 GPU 系统内存"}
      />
      <RuntimeMetricSparkline
        title={isEnglish ? "Energy signal" : "能耗信号"}
        latest={typeof runtime?.gatewayEnergySignalPct === "number" ? `${runtime.gatewayEnergySignalPct.toFixed(1)}%` : "--"}
        values={energyHistory}
        tone="amber"
        helper={isEnglish ? "Best-effort energy estimate derived from CPU, GPU, busy state, and AC/battery context" : "结合 CPU、GPU、忙碌状态与供电信息得到的近似能耗信号"}
      />
      <RuntimeMetricSparkline
        title={isEnglish ? "Storage pressure" : "存储占用"}
        latest={typeof runtime?.gatewayDiskUsedPct === "number" ? `${runtime.gatewayDiskUsedPct.toFixed(1)}%` : "--"}
        values={diskUsedHistory}
        tone="emerald"
        helper={
          isEnglish
            ? `System disk usage. Model footprint: ${typeof runtime?.modelStorageFootprintMb === "number" ? `${runtime.modelStorageFootprintMb.toFixed(1)} MB` : "--"}`
            : `系统磁盘使用率。模型体积：${typeof runtime?.modelStorageFootprintMb === "number" ? `${runtime.modelStorageFootprintMb.toFixed(1)} MB` : "--"}`
        }
      />
    </div>
  );
}
