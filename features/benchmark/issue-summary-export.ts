import type { StoredBenchmarkLog } from "@/lib/agent/log-store";
import { summarizeBenchmarkFailures } from "@/features/benchmark/failure-analysis";

function metric(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Number(value.toFixed(value >= 100 ? 0 : 2))}${suffix}`
    : "--";
}

function workloadLabel(run: StoredBenchmarkLog) {
  return run.suiteLabel || run.datasetLabel || run.promptSetLabel || run.prompt || "Ad hoc prompt";
}

export function serializeBenchmarkIssueSummary(
  logs: StoredBenchmarkLog[],
  options: { generatedAt: string; maxRuns?: number },
) {
  const selected = logs.slice(-(options.maxRuns || 3)).reverse();
  const lines = [
    "## Benchmark issue summary",
    "",
    `Generated: ${options.generatedAt}`,
    "",
  ];
  if (!selected.length) {
    return [...lines, "No benchmark runs matched the selected filters.", ""].join("\n");
  }
  for (const run of selected) {
    const totalSamples = run.results.reduce((sum, result) => sum + result.runs, 0);
    const okSamples = run.results.reduce((sum, result) => sum + result.okRuns, 0);
    const failureSummary = summarizeBenchmarkFailures(
      run.results,
      run.providerProfile,
      run.thinkingMode,
    );
    lines.push(
      `### ${run.runId || run.id}`,
      "",
      `- Workload: ${workloadLabel(run)}`,
      `- Mode: ${run.benchmarkMode || "prompt"}`,
      `- Context: ${run.contextWindow}`,
      `- Samples: ${okSamples}/${totalSamples} ok (${totalSamples ? ((okSamples / totalSamples) * 100).toFixed(1) : "0.0"}%)`,
      `- Profile: ${run.providerProfile || "default"} / ${run.thinkingMode || "standard"}`,
      "",
      "| Target | Model | OK | Pass | Score | FT | Total | TPS |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const result of run.results) {
      lines.push(
        `| ${result.targetLabel} | ${result.resolvedModel} | ${result.okRuns}/${result.runs} | ${metric(result.passRate, "%")} | ${metric(result.avgScore)} | ${metric(result.avgFirstTokenLatencyMs, "ms")} | ${metric(result.avgLatencyMs, "ms")} | ${metric(result.avgTokenThroughputTps)} |`,
      );
    }
    lines.push("");
    if (failureSummary) {
      lines.push(
        `Failure summary: ${failureSummary.total} failed sample(s); ${failureSummary.groups
          .slice(0, 4)
          .map((group) => `${group.label} x${group.count}`)
          .join(", ")}.`,
        "",
      );
    } else {
      lines.push("Failure summary: no failed samples in this run.", "");
    }
  }
  if (logs.length > selected.length) {
    lines.push(`_Showing ${selected.length} of ${logs.length} matched runs._`, "");
  }
  return lines.join("\n");
}
