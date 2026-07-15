import type { AgentMetricPercentiles } from "@/lib/agent/types";

type TelemetryTone = "cyan" | "amber" | "emerald" | "violet";

const STROKE_BY_TONE: Record<TelemetryTone, string> = {
  cyan: "#22d3ee",
  amber: "#f59e0b",
  emerald: "#34d399",
  violet: "#a78bfa",
};

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatBytes(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

export function formatRecommendedContextBadge(value?: number | null) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }
  return `${Math.round(value / 1024)}K`;
}

function buildPolyline(values: number[], maxValue?: number) {
  if (!values.length) return "";
  const max = maxValue ?? Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export function RuntimeMetricSparkline({
  title,
  latest,
  values,
  tone,
  helper,
}: {
  title: string;
  latest: string;
  values: number[];
  tone: TelemetryTone;
  helper: string;
}) {
  const hasValues = values.length > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3.5 py-3.5 text-sm text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-base font-semibold text-white">{latest}</p>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {hasValues ? `${values.length} pts` : "No data"}
        </span>
      </div>
      <div
        className={`mt-3 rounded-2xl border border-white/10 bg-black/20 p-2.5 ${hasValues ? "h-14" : "h-10"}`}
      >
        {hasValues ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <polyline
              fill="none"
              stroke={STROKE_BY_TONE[tone]}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={buildPolyline(values)}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
            待采样
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-400">{helper}</p>
    </div>
  );
}

export function SeriesCard({
  title,
  values,
  tone = "cyan",
}: {
  title: string;
  values: number[];
  tone?: TelemetryTone;
}) {
  const latest = values.length ? values[values.length - 1] : 0;
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-300">{title}</p>
        <span className="text-sm font-semibold text-white">
          {formatCompactNumber(latest)}
        </span>
      </div>
      <div className="mt-4 h-28 rounded-2xl border border-white/10 bg-black/20 p-3">
        {values.length ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <polyline
              fill="none"
              stroke={STROKE_BY_TONE[tone]}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={buildPolyline(values)}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">--</div>
        )}
      </div>
    </div>
  );
}

export function MultiSeriesCard({
  title,
  lines,
}: {
  title: string;
  lines: Array<{ label: string; values: number[]; tone: TelemetryTone }>;
}) {
  const allValues = lines.flatMap((line) => line.values);
  const max = Math.max(...allValues, 1);
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3.5">
      <p className="text-xs font-medium text-slate-400">{title}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {lines.map((line) => (
          <span key={line.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STROKE_BY_TONE[line.tone] }} />
            {line.label}
          </span>
        ))}
      </div>
      <div className="mt-3 h-28 rounded-2xl border border-white/10 bg-black/20 p-2.5">
        {allValues.length ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            {lines.map((line) =>
              line.values.length ? (
                <polyline
                  key={line.label}
                  fill="none"
                  stroke={STROKE_BY_TONE[line.tone]}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildPolyline(line.values, max)}
                />
              ) : null,
            )}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">--</div>
        )}
      </div>
    </div>
  );
}

export function PercentileRow({
  label,
  metrics,
  unit,
  disabled = false,
}: {
  label: string;
  metrics: AgentMetricPercentiles;
  unit?: string;
  disabled?: boolean;
}) {
  const suffix = unit ? ` ${unit}` : "";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-200">
        <span>P50 {disabled ? "--" : `${metrics.p50.toFixed(2)}${suffix}`}</span>
        <span>P95 {disabled ? "--" : `${metrics.p95.toFixed(2)}${suffix}`}</span>
        <span>P99 {disabled ? "--" : `${metrics.p99.toFixed(2)}${suffix}`}</span>
      </div>
    </div>
  );
}
