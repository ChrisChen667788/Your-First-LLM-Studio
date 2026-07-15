export function hasSuccessfulBenchmarkMetrics(row: { okRuns: number }) {
  return row.okRuns > 0;
}

export function formatBenchmarkMetric(
  value: number,
  success: boolean,
  digits: number,
  suffix = "",
) {
  return success ? `${value.toFixed(digits)}${suffix}` : "--";
}

export function formatBenchmarkTrendLegendMetric(
  value: number | null | undefined,
  kind: "first-token" | "total-latency" | "throughput",
  tokensPerSecondLabel: string,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (kind === "throughput") {
    return `${value.toFixed(2)} ${tokensPerSecondLabel}`;
  }
  return `${value.toFixed(1)} ms`;
}

export function buildHeatmapCellClass(
  value: number,
  min: number,
  max: number,
) {
  if (!Number.isFinite(value) || max <= min) return "bg-white/5";
  const ratio = Math.max(
    0,
    Math.min(1, (value - min) / Math.max(max - min, 1)),
  );
  if (ratio >= 0.75) return "bg-rose-500/25";
  if (ratio >= 0.5) return "bg-amber-500/20";
  if (ratio >= 0.25) return "bg-cyan-500/15";
  return "bg-emerald-500/15";
}

export function buildDirectionalHeatmapCellClass(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean,
) {
  if (!Number.isFinite(value) || max <= min) return "bg-white/5";
  return buildHeatmapCellClass(
    higherIsBetter ? max - value + min : value,
    min,
    max,
  );
}

export function getHeatmapRecommendation(
  providerProfile: string,
  thinkingMode: string,
  hasSamples: boolean,
  locale: string,
) {
  const isEnglish = locale.startsWith("en");
  if (!hasSamples) {
    return isEnglish
      ? "No samples yet. Run this combination first."
      : "暂无样本，先跑一次该组合再比较。";
  }
  const key = `${providerProfile}:${thinkingMode}`;
  const zhMap: Record<string, string> = {
    "speed:standard": "推荐短答、低等待成本场景，优先看首字体验。",
    "speed:thinking": "推荐少量试验型深想任务，先观察样本再决定是否长期使用。",
    "balanced:standard": "推荐默认主工作流，适合日常稳定对比。",
    "balanced:thinking": "推荐复杂问答与较长推理，兼顾稳定与质量。",
    "tool-first:standard": "推荐工具调用、仓库问答、函数调用型任务。",
    "tool-first:thinking": "推荐复杂多步任务，适合工具 + 深度推理。",
  };
  const enMap: Record<string, string> = {
    "speed:standard": "Best for short replies and fast first-token checks.",
    "speed:thinking": "Use sparingly for exploratory deep-thinking runs.",
    "balanced:standard": "Best default for day-to-day stable workloads.",
    "balanced:thinking": "Best for more complex reasoning with stable quality.",
    "tool-first:standard": "Best for tool use, repo QA, and function calling.",
    "tool-first:thinking": "Best for multi-step tasks with tools and deep reasoning.",
  };
  return (isEnglish ? enMap : zhMap)[key] ||
    (isEnglish
      ? "General-purpose benchmark mode."
      : "通用 benchmark 策略组合。");
}
