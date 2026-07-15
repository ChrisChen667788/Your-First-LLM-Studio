export type BenchmarkFailureResult = {
  targetLabel: string;
  providerProfile?: string | null;
  thinkingMode?: string | null;
  samples: Array<{
    ok: boolean;
    warning?: string | null;
    workloadId?: string | null;
    itemId?: string | null;
    latencyMs?: number | null;
  }>;
};

export function classifyBenchmarkFailure(warning?: string) {
  const raw = (warning || "").trim();
  const normalized = raw.toLowerCase();
  if (!raw) {
    return { key: "unknown", label: "未知失败", detail: "没有记录到明确 warning。", operational: true };
  }
  if (normalized.includes("terminated")) {
    return { key: "terminated", label: "执行被终止", detail: "请求在执行过程中被终止，通常是长时间流式执行后连接被中断或超时。少量可接受，但如果这一类明显偏多，通常不算正常波动，说明执行链稳定性还需要继续加固。", operational: true };
  }
  if (normalized.includes("aborted")) {
    return { key: "aborted", label: "请求中止", detail: "请求被 AbortController 或上游连接中止，属于执行链中断型失败。少量出现通常算正常波动，但如果持续增长，说明 timeout 或中断策略需要复核。", operational: true };
  }
  if (normalized.includes("502 bad gateway")) {
    return { key: "bad-gateway", label: "上游网关 502", detail: "上游网关瞬时错误，属于远端服务或代理抖动。少量出现通常是正常远端波动，但连续增多说明上游或代理链路不稳定。", operational: true };
  }
  if (normalized.includes("fetch failed")) {
    return { key: "fetch-failed", label: "网络请求失败", detail: "网络或连接建立失败，通常不是模型能力问题。少量属于链路抖动，偏多则说明网络或代理环境需要排查。", operational: true };
  }
  return {
    key: raw,
    label: raw.length > 48 ? `${raw.slice(0, 48)}…` : raw,
    detail: raw,
    operational: false,
  };
}

export function summarizeBenchmarkFailures(
  results: BenchmarkFailureResult[],
  fallbackProfile?: string | null,
  fallbackThinkingMode?: string | null,
) {
  const failedSamples = results.flatMap((result) =>
    result.samples
      .filter((sample) => !sample.ok)
      .map((sample) => ({
        targetLabel: result.targetLabel,
        providerProfile: result.providerProfile || fallbackProfile || "default",
        thinkingMode: result.thinkingMode || fallbackThinkingMode || "standard",
        workloadId: sample.workloadId || "--",
        itemId: sample.itemId || "--",
        latencyMs: sample.latencyMs,
        classified: classifyBenchmarkFailure(sample.warning || undefined),
      })),
  );
  if (!failedSamples.length) return null;
  const grouped = new Map<string, { label: string; detail: string; operational: boolean; count: number }>();
  for (const sample of failedSamples) {
    const current = grouped.get(sample.classified.key) || {
      label: sample.classified.label,
      detail: sample.classified.detail,
      operational: sample.classified.operational,
      count: 0,
    };
    current.count += 1;
    grouped.set(sample.classified.key, current);
  }
  const groups = [...grouped.values()].sort((a, b) => b.count - a.count);
  return {
    total: failedSamples.length,
    mostlyOperational:
      groups
        .filter((group) => group.operational)
        .reduce((sum, group) => sum + group.count, 0) >=
      failedSamples.length * 0.7,
    groups,
    examples: failedSamples.slice(0, 6),
  };
}

export function getFailureSummaryHeadline(
  summary: ReturnType<typeof summarizeBenchmarkFailures>,
  locale: string,
) {
  if (!summary) return "";
  return locale.startsWith("en")
    ? `Failure summary · ${summary.total}`
    : `失败摘要 · ${summary.total}`;
}

export function getFailureSummaryNarrative(
  summary: ReturnType<typeof summarizeBenchmarkFailures>,
  locale: string,
) {
  if (!summary) return "";
  if (summary.mostlyOperational) {
    return locale.startsWith("en")
      ? "Current failed samples are mostly execution-chain or upstream fluctuations, and should not be read directly as model-quality regressions."
      : "当前 failed 主要属于执行链或上游波动，不应直接解读成模型质量退化。";
  }
  return locale.startsWith("en")
    ? "Current failed samples include execution-chain problems, and should be reviewed sample by sample before drawing model conclusions."
    : "当前 failed 混有执行链问题，得先逐样本复核，再判断是否真是模型退化。";
}
