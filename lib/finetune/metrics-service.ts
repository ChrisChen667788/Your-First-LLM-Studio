import type {
  AgentFineTuneCurvePoint,
  AgentFineTuneLossSummary,
  AgentFineTuneReportMetricsSummary,
  AgentFineTuneRunComparisonSummary,
} from "@/lib/agent/types";

export type FineTuneCurveSplitSummary = {
  count: number;
  firstStep: number | null;
  latestStep: number | null;
  firstLoss: number | null;
  latestLoss: number | null;
  minLoss: number | null;
  maxLoss: number | null;
};

function summarizeSplit(
  points: AgentFineTuneCurvePoint[],
  split: AgentFineTuneCurvePoint["split"],
): FineTuneCurveSplitSummary {
  const splitPoints = points
    .filter((point) => point.split === split && Number.isFinite(point.loss))
    .sort((left, right) => left.step - right.step);
  const first = splitPoints[0] ?? null;
  const latest = splitPoints.at(-1) ?? null;
  const losses = splitPoints.map((point) => point.loss);

  return {
    count: splitPoints.length,
    firstStep: first?.step ?? null,
    latestStep: latest?.step ?? null,
    firstLoss: first?.loss ?? null,
    latestLoss: latest?.loss ?? null,
    minLoss: losses.length ? Math.min(...losses) : null,
    maxLoss: losses.length ? Math.max(...losses) : null,
  };
}

export function summarizeFineTuneCurves(points: AgentFineTuneCurvePoint[]) {
  return {
    train: summarizeSplit(points, "train"),
    validation: summarizeSplit(points, "valid"),
  };
}

export function summarizeLoss(
  points: AgentFineTuneCurvePoint[],
): AgentFineTuneLossSummary {
  if (!points.length) {
    return {};
  }
  const sorted = [...points].sort((a, b) => a.step - b.step);
  const first = sorted[0]?.loss ?? null;
  const latest = sorted.at(-1)?.loss ?? null;
  const best = Math.min(...sorted.map((point) => point.loss));
  const delta =
    typeof first === "number" && typeof latest === "number"
      ? latest - first
      : null;
  const relativeDeltaPct =
    typeof delta === "number" && typeof first === "number" && first > 0
      ? (delta / first) * 100
      : null;
  return {
    first,
    latest,
    best,
    delta,
    relativeDeltaPct,
  };
}

export function summarizeFineTuneMetrics(
  points: AgentFineTuneCurvePoint[],
): AgentFineTuneReportMetricsSummary {
  const sorted = [...points].sort((a, b) => a.step - b.step);
  return {
    pointCount: sorted.length,
    firstStep: sorted[0]?.step ?? null,
    latestStep: sorted.at(-1)?.step ?? null,
    train: summarizeLoss(sorted.filter((point) => point.split === "train")),
    valid: summarizeLoss(sorted.filter((point) => point.split === "valid")),
  };
}

export function finiteDelta(
  latest?: number | null,
  previous?: number | null,
): number | null {
  return typeof latest === "number" &&
    Number.isFinite(latest) &&
    typeof previous === "number" &&
    Number.isFinite(previous)
    ? latest - previous
    : null;
}

export function classifyFineTuneRunDelta(
  deltas: Array<number | null | undefined>,
): NonNullable<
  AgentFineTuneRunComparisonSummary["deltaToPrevious"]
>["conclusion"] {
  const threshold = 0.0001;
  const comparable = deltas.filter(
    (delta): delta is number =>
      typeof delta === "number" && Number.isFinite(delta),
  );
  if (!comparable.length) return "insufficient-data";
  const improved = comparable.filter((delta) => delta < -threshold).length;
  const regressed = comparable.filter((delta) => delta > threshold).length;
  if (!improved && !regressed) return "stable";
  if (improved && !regressed) return "improved";
  if (regressed && !improved) return "regressed";
  return "mixed";
}

export function formatReportNumber(value?: number | null, digits = 4) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "--";
}

export function formatReportSignedNumber(value?: number | null, digits = 4) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`
    : "--";
}

export function formatReportSignedInteger(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${Math.round(value)}`
    : "--";
}

export function formatReportDurationDelta(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${Math.round(value / 1000)}s`
    : "--";
}

export function formatFineTuneRunDeltaConclusion(
  conclusion?: NonNullable<
    AgentFineTuneRunComparisonSummary["deltaToPrevious"]
  >["conclusion"],
) {
  switch (conclusion) {
    case "improved":
      return "Improved versus the previous run on every comparable loss signal.";
    case "regressed":
      return "Regressed versus the previous run on every comparable loss signal.";
    case "mixed":
      return "Mixed result: at least one loss signal improved and another regressed.";
    case "stable":
      return "Stable result: comparable loss changes are within the noise threshold.";
    case "insufficient-data":
      return "Not enough comparable loss points to judge the direction.";
    default:
      return "--";
  }
}

export function formatReportPct(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
    : "--";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildFineTuneMetricsCsv(points: AgentFineTuneCurvePoint[]) {
  const rows = [
    [
      "step",
      "split",
      "loss",
      "learningRate",
      "tokensPerSecond",
      "peakMemoryGb",
      "trainedTokens",
      "durationSec",
      "at",
    ],
    ...points.map((point) => [
      point.step,
      point.split,
      point.loss,
      point.learningRate ?? "",
      point.tokensPerSecond ?? "",
      point.peakMemoryGb ?? "",
      point.trainedTokens ?? "",
      point.durationSec ?? "",
      point.at,
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function averageFinite(values: Array<number | null | undefined>) {
  const finite = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}
