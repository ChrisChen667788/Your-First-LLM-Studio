import type { AgentFineTuneJob } from "@/lib/agent/types";

export function formatFineTuneDateTime(value?: string) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatFineTuneNumber(value?: number | null, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

export function formatFineTuneSignedNumber(
  value?: number | null,
  digits = 2,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function formatFineTuneSignedInteger(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value)}`;
}

export function formatFineTuneSignedDurationMs(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${Math.round(value / 1000)}s`;
}

export function getFineTuneRunDeltaConclusionLabel(
  conclusion: string | undefined,
  isEnglish: boolean,
) {
  switch (conclusion) {
    case "improved":
      return isEnglish ? "Improved" : "整体改善";
    case "regressed":
      return isEnglish ? "Regressed" : "整体回退";
    case "mixed":
      return isEnglish ? "Mixed" : "有升有降";
    case "stable":
      return isEnglish ? "Stable" : "基本稳定";
    case "insufficient-data":
      return isEnglish ? "Insufficient data" : "数据不足";
    default:
      return "--";
  }
}

export function formatFineTuneSampleCount(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toLocaleString();
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getFineTuneJobProgressPercent(job: AgentFineTuneJob) {
  if (job.status === "completed") return 100;
  if (typeof job.progress?.percent === "number") {
    return clampPercent(job.progress.percent);
  }
  const currentStep = job.progress?.currentStep;
  const totalSteps = job.progress?.totalSteps;
  if (
    typeof currentStep === "number" &&
    typeof totalSteps === "number" &&
    totalSteps > 0
  ) {
    return clampPercent((currentStep / totalSteps) * 100);
  }
  return 0;
}

export function getFineTuneJobStatusMeta(job: AgentFineTuneJob) {
  switch (job.status) {
    case "completed":
      return {
        label: "completed",
        dot: "bg-emerald-300",
        badge: "bg-emerald-400/10 text-emerald-100",
        bar: "from-emerald-300 to-cyan-300",
      };
    case "failed":
      return {
        label: "failed",
        dot: "bg-rose-300",
        badge: "bg-rose-400/10 text-rose-100",
        bar: "from-rose-300 to-amber-300",
      };
    case "running":
    case "queued":
      return {
        label: job.status,
        dot: "bg-cyan-300",
        badge: "bg-cyan-400/10 text-cyan-100",
        bar: "from-cyan-300 to-violet-300",
      };
    case "cancelled":
      return {
        label: "cancelled",
        dot: "bg-slate-400",
        badge: "bg-slate-400/10 text-slate-100",
        bar: "from-slate-400 to-slate-500",
      };
    default:
      return {
        label: job.status,
        dot: "bg-amber-300",
        badge: "bg-amber-400/10 text-amber-100",
        bar: "from-amber-300 to-cyan-300",
      };
  }
}
