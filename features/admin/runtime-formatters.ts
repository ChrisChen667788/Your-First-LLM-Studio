import type { AgentRuntimeStatus, AgentTarget } from "@/lib/agent/types";

export function describeAdminRuntimePhase(
  runtime: AgentRuntimeStatus | null,
  locale: string,
) {
  const phase = runtime?.phase || "offline";
  const isEnglish = locale.startsWith("en");
  const values = {
    remote: [isEnglish ? "Remote" : "远端", "border-violet-400/20 bg-violet-400/10 text-violet-100"],
    unloaded: [isEnglish ? "Unloaded" : "空载", "border-white/10 bg-white/5 text-slate-200"],
    ready: [isEnglish ? "Ready" : "已就绪", "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"],
    busy: [isEnglish ? "Busy" : "处理中", "border-amber-400/20 bg-amber-400/10 text-amber-100"],
    loading: [isEnglish ? "Loading" : "加载中", "border-amber-400/20 bg-amber-400/10 text-amber-100"],
    recovering: [isEnglish ? "Recovering" : "恢复中", "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"],
    error: [isEnglish ? "Error" : "异常", "border-rose-400/20 bg-rose-400/10 text-rose-100"],
    offline: [isEnglish ? "Offline" : "离线", "border-white/10 bg-white/5 text-slate-300"],
  } satisfies Record<string, [string, string]>;
  const [label, className] = values[phase] || values.offline;
  return { label, className };
}

export function formatAdminRuntimeDuration(ms: number | null | undefined) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatAdminRuntimeTimestamp(
  timestamp: string | null | undefined,
  locale: string,
) {
  if (!timestamp) return "—";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

export function describeAdminRuntimeAlias(
  alias: string | null | undefined,
  targets: AgentTarget[],
) {
  if (!alias) return "—";
  const matched = targets.find((target) => target.id === alias);
  return matched ? matched.label : alias;
}
