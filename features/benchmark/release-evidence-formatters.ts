import type { AgentBenchmarkReleaseEvidence } from "@/lib/agent/types";

export function formatBenchmarkReportMatchSource(
  locale: string,
  value: AgentBenchmarkReleaseEvidence["matchSource"] | undefined,
) {
  if (value === "exact-run-id") {
    return locale.startsWith("en") ? "Exact run" : "精确 run";
  }
  if (value === "full-history") {
    return locale.startsWith("en") ? "Full history fallback" : "全历史回退";
  }
  return locale.startsWith("en") ? "Recent window" : "最近窗口";
}

export function benchmarkReportMatchSourceClass(
  value: AgentBenchmarkReleaseEvidence["matchSource"] | undefined,
) {
  if (value === "exact-run-id") {
    return "border-violet-300/20 bg-violet-400/10 text-violet-100";
  }
  if (value === "full-history") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  }
  return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
}
