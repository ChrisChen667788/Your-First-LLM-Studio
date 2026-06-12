import type {
  AgentConnectionCheckResponse,
  AgentRuntimeStatus,
  AgentTarget,
} from "@/lib/agent/types";

export function describeRuntimePhase(
  runtime: AgentRuntimeStatus | null,
  locale: string,
) {
  const phase = runtime?.phase || "offline";
  switch (phase) {
    case "remote":
      return {
        label: locale.startsWith("en") ? "Remote" : "远端",
        className: "bg-violet-400/15 text-violet-200",
      };
    case "unloaded":
      return {
        label: locale.startsWith("en") ? "Unloaded" : "空载",
        className: "bg-slate-400/15 text-slate-200",
      };
    case "ready":
      return {
        label: locale.startsWith("en") ? "Ready" : "已就绪",
        className: "bg-emerald-400/15 text-emerald-200",
      };
    case "busy":
      return {
        label: locale.startsWith("en") ? "Busy" : "处理中",
        className: "bg-amber-400/15 text-amber-200",
      };
    case "loading":
      return {
        label: locale.startsWith("en") ? "Loading" : "加载中",
        className: "bg-amber-400/15 text-amber-200",
      };
    case "recovering":
      return {
        label: locale.startsWith("en") ? "Recovering" : "恢复中",
        className: "bg-cyan-400/15 text-cyan-200",
      };
    case "error":
      return {
        label: locale.startsWith("en") ? "Error" : "异常",
        className: "bg-rose-400/15 text-rose-200",
      };
    default:
      return {
        label: locale.startsWith("en") ? "Offline" : "离线",
        className: "bg-rose-400/15 text-rose-200",
      };
  }
}

export function buildRuntimeStageItems(
  runtime: AgentRuntimeStatus | null,
  locale: string,
) {
  const labels = locale.startsWith("en")
    ? {
        offline: "Offline",
        recovering: "Recovering",
        loading: "Loading",
        unloaded: "Unloaded",
        busy: "Busy",
        ready: "Ready",
      }
    : {
        offline: "离线",
        recovering: "恢复中",
        loading: "加载中",
        unloaded: "空载",
        busy: "处理中",
        ready: "已就绪",
      };
  const steps: Array<keyof typeof labels> = [
    "offline",
    "recovering",
    "loading",
    "unloaded",
    "busy",
    "ready",
  ];
  const phase = runtime?.phase || "offline";
  const phaseIndex = steps.indexOf(phase as keyof typeof labels);
  return steps.map((step, index) => ({
    key: step,
    label: labels[step],
    active: step === phase,
    completed: phase !== "error" && phaseIndex >= 0 && index < phaseIndex,
  }));
}

export function formatRuntimeDuration(ms: number | null | undefined) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatRuntimeTimestamp(
  timestamp: string | null | undefined,
  locale: string,
) {
  if (!timestamp) return "—";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

export function describeRuntimeAlias(
  alias: string | null | undefined,
  targets: AgentTarget[],
) {
  if (!alias) return "—";
  const matched = targets.find((target) => target.id === alias);
  return matched ? `${matched.label}` : alias;
}

export function formatTargetModelVersion(
  modelDefault: string,
  thinkingModelDefault?: string,
) {
  if (thinkingModelDefault && thinkingModelDefault !== modelDefault) {
    return `${modelDefault} · Thinking ${thinkingModelDefault}`;
  }
  return modelDefault;
}

export function getHealthBadge(check: AgentConnectionCheckResponse | null) {
  if (!check) {
    return {
      label: "unknown",
      className: "bg-white/5 text-slate-300",
    };
  }

  if (check.ok) {
    return {
      label: "healthy",
      className: "bg-emerald-400/15 text-emerald-200",
    };
  }

  const hasChatFailure = check.stages.some(
    (stage) => !stage.ok && stage.id !== "models",
  );
  return {
    label: hasChatFailure ? "degraded" : "warning",
    className: hasChatFailure
      ? "bg-rose-400/15 text-rose-200"
      : "bg-amber-400/15 text-amber-200",
  };
}

export function getLoadRiskBadge(target: AgentTarget, locale: string) {
  if (target.execution !== "local" || !target.loadGuardrailLevel) {
    return null;
  }

  if (target.loadGuardrailLevel === "blocked") {
    return {
      label: locale.startsWith("en") ? "Blocked load" : "阻止加载",
      className: "bg-rose-400/15 text-rose-200 border border-rose-400/20",
    };
  }

  if (target.loadGuardrailLevel === "caution") {
    return {
      label: locale.startsWith("en") ? "Use with care" : "谨慎加载",
      className: "bg-amber-400/15 text-amber-200 border border-amber-400/20",
    };
  }

  return {
    label: locale.startsWith("en") ? "Recommended" : "建议加载",
    className:
      "bg-emerald-400/15 text-emerald-200 border border-emerald-400/20",
  };
}
