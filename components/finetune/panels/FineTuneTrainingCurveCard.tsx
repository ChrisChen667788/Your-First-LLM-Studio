"use client";

import type {
  AgentFineTuneCurvePoint,
  AgentFineTuneJob,
} from "@/lib/agent/types";
import type {
  TrainingChartHoverState,
  TrainingChartPoint,
  TrainingChartRangePreset,
  TrainingChartSmoothingMode,
} from "@/features/finetune/ui-cache-state";

type TrainingChartOverlaySeries = {
  jobId: string;
  label: string;
  status: AgentFineTuneJob["status"];
  latestStep?: number;
  trainPath: string;
  validPath: string;
  latestTrain?: TrainingChartPoint;
  latestValid?: TrainingChartPoint;
};

type TrainingChartMarker = {
  kind: "save" | "eval" | "best";
  step: number;
  x: number;
  y: number;
  label: string;
  value?: number | null;
  path?: string;
};

type FineTuneTrainingCurveCardProps = {
  job: AgentFineTuneJob;
  jobs: AgentFineTuneJob[];
  text: Record<string, string>;
  isEnglish: boolean;
  chartRange: TrainingChartRangePreset;
  smoothingMode: TrainingChartSmoothingMode;
  selectedOverlayJobIds: string[];
  hoverPoint: TrainingChartHoverState;
  formatNumber: (value?: number | null, digits?: number) => string;
  onChartRangeChange: (range: TrainingChartRangePreset) => void;
  onSmoothingModeChange: (mode: TrainingChartSmoothingMode) => void;
  onToggleOverlayJob: (jobId: string) => void;
  onHoverPointChange: (point: TrainingChartHoverState) => void;
};

const TRAINING_CHART_RANGE_PRESETS: TrainingChartRangePreset[] = [
  "all",
  "first-300",
  "last-300",
  "last-100",
];

function formatRatio(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2)}x`;
}

function getLossBaseline(loss?: number) {
  if (typeof loss === "number" && Number.isFinite(loss) && loss > 0) {
    return loss;
  }
  return 1;
}

function chartClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function getChartRangeLabel(
  range: TrainingChartRangePreset,
  isEnglish: boolean,
) {
  if (isEnglish) {
    if (range === "all") return "All";
    if (range === "first-300") return "First 300";
    if (range === "last-300") return "Last 300";
    return "Last 100";
  }
  if (range === "all") return "全量";
  if (range === "first-300") return "前 300";
  if (range === "last-300") return "后 300";
  return "后 100";
}

function getFineTuneOverlayJobs(
  job: AgentFineTuneJob,
  jobs: AgentFineTuneJob[],
) {
  const adapterName = job.adapterName.trim();
  const recipeId = job.recipeId.trim();
  const datasetId = job.datasetId.trim();
  const baseModelRef = job.baseModelRef?.trim() || "";
  return jobs
    .filter((candidate) => {
      if (candidate.id === job.id || !candidate.curve?.length) return false;
      const sameAdapter = Boolean(
        adapterName && candidate.adapterName.trim() === adapterName,
      );
      const sameRecipeDataset = Boolean(
        !sameAdapter &&
        recipeId &&
        datasetId &&
        candidate.recipeId.trim() === recipeId &&
        candidate.datasetId.trim() === datasetId,
      );
      const sameBaseDataset = Boolean(
        !sameAdapter &&
        !sameRecipeDataset &&
        baseModelRef &&
        datasetId &&
        candidate.baseModelRef?.trim() === baseModelRef &&
        candidate.datasetId.trim() === datasetId,
      );
      return sameAdapter || sameRecipeDataset || sameBaseDataset;
    })
    .sort((left, right) => {
      const leftTime = new Date(
        left.completedAt || left.startedAt || 0,
      ).getTime();
      const rightTime = new Date(
        right.completedAt || right.startedAt || 0,
      ).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 4);
}

function smoothTrainingPoints(points: TrainingChartPoint[], windowSize = 5) {
  if (points.length < windowSize) return points;
  const halfWindow = Math.floor(windowSize / 2);
  return points.map((point, index) => {
    const window = points.slice(
      Math.max(0, index - halfWindow),
      Math.min(points.length, index + halfWindow + 1),
    );
    const normalizedLoss =
      window.reduce((total, item) => total + item.normalizedLoss, 0) /
      Math.max(1, window.length);
    return {
      ...point,
      normalizedLoss,
    };
  });
}

function buildTrainingChart(
  job: AgentFineTuneJob,
  range: TrainingChartRangePreset = "all",
  overlayJobs: AgentFineTuneJob[] = [],
  smoothingMode: TrainingChartSmoothingMode = "raw",
) {
  const width = 360;
  const height = 180;
  const plot = { left: 42, right: 14, top: 18, bottom: 34 };
  const points = (job.curve || []).filter(
    (point): point is AgentFineTuneCurvePoint =>
      (point.split === "train" || point.split === "valid") &&
      Number.isFinite(point.step) &&
      Number.isFinite(point.loss),
  );

  if (points.length < 2) return null;

  const sortedPoints = [...points].sort(
    (left, right) => left.step - right.step,
  );
  const minStep = sortedPoints[0]?.step ?? 0;
  const maxStep = sortedPoints.at(-1)?.step ?? 0;
  const stepWindow = (() => {
    if (range === "first-300") {
      return {
        visibleStartStep: minStep,
        visibleEndStep: Math.min(maxStep, minStep + 300),
      };
    }
    if (range === "last-300") {
      return {
        visibleStartStep: Math.max(minStep, maxStep - 300),
        visibleEndStep: maxStep,
      };
    }
    if (range === "last-100") {
      return {
        visibleStartStep: Math.max(minStep, maxStep - 100),
        visibleEndStep: maxStep,
      };
    }
    return { visibleStartStep: minStep, visibleEndStep: maxStep };
  })();
  const visiblePoints = sortedPoints.filter(
    (point) =>
      point.step >= stepWindow.visibleStartStep &&
      point.step <= stepWindow.visibleEndStep,
  );
  const effectivePoints =
    visiblePoints.length >= 2 ? visiblePoints : sortedPoints;
  const effectiveMinStep = effectivePoints[0]?.step ?? minStep;
  const effectiveMaxStep = effectivePoints.at(-1)?.step ?? maxStep;
  const domainMinStep = Math.floor(effectiveMinStep / 100) * 100;
  const domainMaxStep = Math.max(
    domainMinStep + 100,
    Math.ceil(effectiveMaxStep / 100) * 100,
  );
  const buildBaseline = (chartPoints: AgentFineTuneCurvePoint[]) => {
    const train = getLossBaseline(
      chartPoints.find((point) => point.split === "train")?.loss ??
        chartPoints[0]?.loss,
    );
    const valid = getLossBaseline(
      chartPoints.find((point) => point.split === "valid")?.loss ?? train,
    );
    return { train, valid };
  };
  const baselineBySplit = buildBaseline(sortedPoints);
  const overlayInputs = overlayJobs
    .map((overlayJob) => {
      const overlayPoints = (overlayJob.curve || [])
        .filter(
          (point): point is AgentFineTuneCurvePoint =>
            (point.split === "train" || point.split === "valid") &&
            Number.isFinite(point.step) &&
            Number.isFinite(point.loss),
        )
        .sort((left, right) => left.step - right.step);
      if (overlayPoints.length < 2) return null;
      return {
        job: overlayJob,
        points: overlayPoints,
        baselineBySplit: buildBaseline(overlayPoints),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        job: AgentFineTuneJob;
        points: AgentFineTuneCurvePoint[];
        baselineBySplit: { train: number; valid: number };
      } => Boolean(entry),
    );
  const normalizeLoss = (
    point: AgentFineTuneCurvePoint,
    baseline: { train: number; valid: number },
  ) => point.loss / baseline[point.split];
  const normalizedValues = [
    ...effectivePoints.map((point) => normalizeLoss(point, baselineBySplit)),
    ...overlayInputs.flatMap((overlay) =>
      overlay.points
        .filter(
          (point) => point.step >= domainMinStep && point.step <= domainMaxStep,
        )
        .map((point) => normalizeLoss(point, overlay.baselineBySplit)),
    ),
  ];
  const minNormalizedLoss = Math.min(...normalizedValues);
  const maxNormalizedLoss = Math.max(
    ...normalizedValues,
    minNormalizedLoss + 0.001,
  );
  const padding = Math.max(
    0.04,
    (maxNormalizedLoss - minNormalizedLoss) * 0.12,
  );
  const minLoss = Math.max(0, minNormalizedLoss - padding);
  const maxLoss = Math.max(1, maxNormalizedLoss + padding);
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const stepDomainSpan = Math.max(100, domainMaxStep - domainMinStep);
  const toX = (step: number) =>
    plot.left +
    ((Math.max(domainMinStep, Math.min(step, domainMaxStep)) - domainMinStep) /
      stepDomainSpan) *
      plotWidth;
  const toY = (normalizedLoss: number) =>
    plot.top +
    (1 - (normalizedLoss - minLoss) / Math.max(0.001, maxLoss - minLoss)) *
      plotHeight;
  const toChartPoint = (
    point: AgentFineTuneCurvePoint,
    baseline: { train: number; valid: number } = baselineBySplit,
  ): TrainingChartPoint => ({
    ...point,
    rawLoss: point.loss,
    normalizedLoss: normalizeLoss(point, baseline),
    x: toX(point.step),
    y: toY(normalizeLoss(point, baseline)),
  });
  const toSmoothedChartPoints = (chartPoints: TrainingChartPoint[]) =>
    smoothingMode === "smooth-5"
      ? smoothTrainingPoints(chartPoints).map((point) => ({
          ...point,
          y: toY(point.normalizedLoss),
        }))
      : chartPoints;
  const trainPoints = effectivePoints
    .filter((point) => point.split === "train")
    .map((point) => toChartPoint(point));
  const validPoints = effectivePoints
    .filter((point) => point.split === "valid")
    .map((point) => toChartPoint(point));
  const trainPathPoints = toSmoothedChartPoints(trainPoints);
  const validPathPoints = toSmoothedChartPoints(validPoints);
  const toPath = (chartPoints: TrainingChartPoint[]) =>
    chartPoints
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" ");
  const overlaySeries: TrainingChartOverlaySeries[] = overlayInputs
    .map((overlay) => {
      const overlayEffectivePoints = overlay.points.filter(
        (point) => point.step >= domainMinStep && point.step <= domainMaxStep,
      );
      const trainOverlayPoints = overlayEffectivePoints
        .filter((point) => point.split === "train")
        .map((point) => toChartPoint(point, overlay.baselineBySplit));
      const validOverlayPoints = overlayEffectivePoints
        .filter((point) => point.split === "valid")
        .map((point) => toChartPoint(point, overlay.baselineBySplit));
      const trainOverlayPathPoints = toSmoothedChartPoints(trainOverlayPoints);
      const validOverlayPathPoints = toSmoothedChartPoints(validOverlayPoints);
      return {
        jobId: overlay.job.id,
        label: overlay.job.adapterName || overlay.job.id,
        status: overlay.job.status,
        latestStep: overlayEffectivePoints.at(-1)?.step,
        trainPath: toPath(trainOverlayPathPoints),
        validPath: toPath(validOverlayPathPoints),
        latestTrain: trainOverlayPoints.at(-1),
        latestValid: validOverlayPoints.at(-1),
      };
    })
    .filter((series) => series.trainPath || series.validPath);
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = maxLoss - (maxLoss - minLoss) * ratio;
    return { value, y: plot.top + plotHeight * ratio };
  });
  const xTicks = Array.from(
    { length: Math.floor((domainMaxStep - domainMinStep) / 100) + 1 },
    (_, index) => domainMinStep + index * 100,
  ).map((step) => ({ step, x: toX(step) }));
  const saveMarkers = (job.checkpointEvents || [])
    .filter(
      (event) => event.step >= domainMinStep && event.step <= domainMaxStep,
    )
    .map((event): TrainingChartMarker => ({
      kind: "save",
      step: event.step,
      x: toX(event.step),
      y: plot.top + 12,
      label: `save ${event.step}`,
      value: event.value,
      path: event.path,
    }));
  const evalMarkers = validPoints.map(
    (point): TrainingChartMarker => ({
      kind: "eval",
      step: point.step,
      x: point.x,
      y: chartClamp(point.y - 10, plot.top + 8, plot.top + plotHeight - 8),
      label: `eval ${point.step}`,
      value: point.rawLoss,
    }),
  );
  const bestPoint =
    job.bestCheckpoint &&
    job.bestCheckpoint.step >= domainMinStep &&
    job.bestCheckpoint.step <= domainMaxStep
      ? validPoints.find((point) => point.step === job.bestCheckpoint?.step) ||
        trainPoints.find((point) => point.step === job.bestCheckpoint?.step)
      : undefined;
  const bestMarker =
    job.bestCheckpoint &&
    job.bestCheckpoint.step >= domainMinStep &&
    job.bestCheckpoint.step <= domainMaxStep
      ? ({
          kind: "best",
          step: job.bestCheckpoint.step,
          x: toX(job.bestCheckpoint.step),
          y: bestPoint?.y ?? plot.top + 20,
          label: `best ${job.bestCheckpoint.step}`,
          value: job.bestCheckpoint.value,
          path: job.bestCheckpoint.path,
        } satisfies TrainingChartMarker)
      : null;

  return {
    width,
    height,
    plot,
    plotWidth,
    plotHeight,
    visibleStartStep: effectiveMinStep,
    visibleEndStep: effectiveMaxStep,
    trainPath: toPath(trainPathPoints),
    validPath: toPath(validPathPoints),
    overlaySeries,
    trainPoints,
    validPoints,
    trainPathPoints,
    validPathPoints,
    saveMarkers,
    evalMarkers,
    bestMarker,
    yTicks,
    xTicks,
    latestTrain: trainPoints.at(-1),
    latestValid: validPoints.at(-1),
    firstTrain: trainPoints[0],
    firstValid: validPoints[0],
  };
}

export function FineTuneTrainingCurveCard({
  job,
  jobs,
  text,
  isEnglish,
  chartRange,
  smoothingMode,
  selectedOverlayJobIds,
  hoverPoint,
  formatNumber,
  onChartRangeChange,
  onSmoothingModeChange,
  onToggleOverlayJob,
  onHoverPointChange,
}: FineTuneTrainingCurveCardProps) {
  if (!job.curve?.length) return null;

  const overlayCandidates = getFineTuneOverlayJobs(job, jobs);
  const selectedOverlayJobs = selectedOverlayJobIds.length
    ? overlayCandidates.filter((candidate) =>
        selectedOverlayJobIds.includes(candidate.id),
      )
    : overlayCandidates.slice(0, 4);
  const chart = buildTrainingChart(
    job,
    chartRange,
    selectedOverlayJobs,
    smoothingMode,
  );
  if (!chart) return null;

  const visibleHoverPoint =
    hoverPoint &&
    hoverPoint.step >= chart.visibleStartStep &&
    hoverPoint.step <= chart.visibleEndStep
      ? hoverPoint
      : null;
  const overlayRows = [
    {
      id: job.id,
      label: text.currentRun,
      status: job.status,
      latestStep: chart.latestTrain?.step ?? chart.latestValid?.step,
      train: chart.latestTrain,
      valid: chart.latestValid,
      current: true,
    },
    ...chart.overlaySeries.slice(0, 4).map((series) => ({
      id: series.jobId,
      label: series.label,
      status: series.status,
      latestStep: series.latestStep,
      train: series.latestTrain,
      valid: series.latestValid,
      current: false,
    })),
  ];
  const exportChartEvidence = () => {
    const payload = {
      kind: "first-llm-studio-finetune-chart-evidence",
      exportedAt: new Date().toISOString(),
      jobId: job.id,
      adapterName: job.adapterName,
      range: chartRange,
      smoothingMode,
      visibleWindow: {
        startStep: chart.visibleStartStep,
        endStep: chart.visibleEndStep,
      },
      bestCheckpoint: job.bestCheckpoint || null,
      checkpointEvents: job.checkpointEvents || [],
      overlayJobIds: selectedOverlayJobs.map((entry) => entry.id),
      curve: job.curve || [],
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${job.id}-chart-evidence.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            {text.trainingCurve}
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            {text.normalizedLossHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-slate-500">
          <span>
            {text.rawLoss}: train {formatNumber(job.progress?.latestTrainLoss)}{" "}
            · val {formatNumber(job.progress?.latestValLoss)}
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {text.chartRange}
            </span>
            <div className="inline-flex flex-wrap rounded-full border border-white/10 bg-white/[0.04] p-1">
              {TRAINING_CHART_RANGE_PRESETS.map((range) => (
                <button
                  key={`${job.id}:${range}`}
                  type="button"
                  onClick={() => onChartRangeChange(range)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    chartRange === range
                      ? "bg-cyan-400/15 text-cyan-100"
                      : "text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {getChartRangeLabel(range, isEnglish)}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
            {text.chartWindow}: {chart.visibleStartStep} -{" "}
            {chart.visibleEndStep}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {isEnglish ? "Trend" : "趋势"}
            </span>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["raw", "smooth-5"] as const).map((mode) => (
                <button
                  key={`${job.id}:smooth:${mode}`}
                  type="button"
                  onClick={() => onSmoothingModeChange(mode)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    smoothingMode === mode
                      ? "bg-violet-400/15 text-violet-100"
                      : "text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {mode === "raw"
                    ? isEnglish
                      ? "Raw"
                      : "原始"
                    : isEnglish
                      ? "Smooth 5"
                      : "平滑 5"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportChartEvidence}
              className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
            >
              {isEnglish ? "Export chart evidence" : "导出图表证据"}
            </button>
          </div>
        </div>

        {overlayCandidates.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-200">
              {text.overlayRuns}: {chart.overlaySeries.length}
            </span>
            {overlayCandidates.slice(0, 6).map((candidate) => (
              <label
                key={`overlay-choice:${candidate.id}`}
                className={`inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 ${
                  selectedOverlayJobs.some((entry) => entry.id === candidate.id)
                    ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100"
                    : "border-white/10 bg-black/20 text-slate-300"
                }`}
                title={candidate.adapterName || candidate.id}
              >
                <input
                  type="checkbox"
                  checked={selectedOverlayJobs.some(
                    (entry) => entry.id === candidate.id,
                  )}
                  onChange={() => onToggleOverlayJob(candidate.id)}
                />
                <span className="truncate">
                  {candidate.adapterName || candidate.id}
                </span>
              </label>
            ))}
            <span>{text.overlayRunsHint}</span>
          </div>
        ) : null}

        <div className="relative mt-3 rounded-2xl border border-white/10 bg-slate-950/90 p-3">
          {visibleHoverPoint ? (
            <div
              className="pointer-events-none absolute z-20 min-w-[160px] rounded-2xl border border-white/10 bg-slate-950/96 px-3 py-3 text-[11px] leading-5 text-slate-100 shadow-[0_18px_48px_rgba(2,6,23,0.45)]"
              style={{
                left: `${(visibleHoverPoint.x / chart.width) * 100}%`,
                top: `${(visibleHoverPoint.y / chart.height) * 100}%`,
                transform:
                  visibleHoverPoint.x > chart.width * 0.72
                    ? "translate(-104%, -112%)"
                    : "translate(10px, -112%)",
              }}
            >
              <p
                className={`font-semibold ${
                  visibleHoverPoint.split === "train"
                    ? "text-cyan-100"
                    : "text-violet-100"
                }`}
              >
                {visibleHoverPoint.split === "train"
                  ? text.chartSplitTrain
                  : text.chartSplitValid}
              </p>
              <div className="mt-2 space-y-1 text-slate-300">
                <p>
                  {text.chartStep}: {visibleHoverPoint.step}
                </p>
                <p>
                  {text.lossAxis}:{" "}
                  {formatRatio(visibleHoverPoint.normalizedLoss)}
                </p>
                <p>
                  {text.rawLoss}: {formatNumber(visibleHoverPoint.rawLoss)}
                </p>
              </div>
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-52 w-full"
          >
            <rect
              x={chart.plot.left}
              y={chart.plot.top}
              width={chart.plotWidth}
              height={chart.plotHeight}
              rx="10"
              fill="rgba(2,6,23,0.72)"
              stroke="rgba(255,255,255,0.08)"
            />
            {chart.yTicks.map((tick) => (
              <g key={`y:${tick.value}`}>
                <line
                  x1={chart.plot.left}
                  x2={chart.width - chart.plot.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeDasharray="3 5"
                />
                <text
                  x={chart.plot.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[9px]"
                >
                  {formatRatio(tick.value)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((tick) => (
              <g key={`x:${tick.step}`}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={chart.plot.top}
                  y2={chart.plot.top + chart.plotHeight}
                  stroke="rgba(148,163,184,0.1)"
                />
                <text
                  x={tick.x}
                  y={chart.plot.top + chart.plotHeight + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px]"
                >
                  {tick.step}
                </text>
              </g>
            ))}
            <text
              x={chart.plot.left}
              y={chart.height - 4}
              className="fill-slate-500 text-[9px]"
            >
              {text.stepAxis}
            </text>
            <text
              x="9"
              y={chart.plot.top + 6}
              transform={`rotate(-90 9 ${chart.plot.top + 6})`}
              className="fill-slate-500 text-[9px]"
            >
              {text.lossAxis}
            </text>
            {visibleHoverPoint ? (
              <line
                x1={visibleHoverPoint.x}
                x2={visibleHoverPoint.x}
                y1={chart.plot.top}
                y2={chart.plot.top + chart.plotHeight}
                stroke="rgba(148,163,184,0.35)"
                strokeDasharray="4 4"
              />
            ) : null}
            {chart.saveMarkers.map((marker) => (
              <g key={`save-marker:${marker.step}`}>
                <line
                  x1={marker.x}
                  x2={marker.x}
                  y1={chart.plot.top}
                  y2={chart.plot.top + chart.plotHeight}
                  stroke="rgba(250,204,21,0.34)"
                  strokeDasharray="2 5"
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r="3"
                  fill="rgb(250 204 21)"
                />
              </g>
            ))}
            {chart.evalMarkers.map((marker) => (
              <circle
                key={`eval-marker:${marker.step}`}
                cx={marker.x}
                cy={marker.y}
                r="2.4"
                fill="rgb(167 139 250)"
                opacity="0.75"
              />
            ))}
            {chart.overlaySeries.map((series, index) => (
              <g key={`overlay:${series.jobId}`} opacity={0.34 - index * 0.06}>
                {series.trainPath ? (
                  <path
                    d={series.trainPath}
                    fill="none"
                    stroke="rgb(34 211 238)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="5 6"
                  />
                ) : null}
                {series.validPath ? (
                  <path
                    d={series.validPath}
                    fill="none"
                    stroke="rgb(167 139 250)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="2 6"
                  />
                ) : null}
                {series.latestTrain ? (
                  <circle
                    cx={series.latestTrain.x}
                    cy={series.latestTrain.y}
                    r="2.6"
                    fill="rgb(34 211 238)"
                  />
                ) : null}
                {series.latestValid ? (
                  <circle
                    cx={series.latestValid.x}
                    cy={series.latestValid.y}
                    r="2.6"
                    fill="rgb(167 139 250)"
                  />
                ) : null}
              </g>
            ))}
            <path
              d={chart.trainPath}
              fill="none"
              stroke="rgb(34 211 238)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={chart.validPath}
              fill="none"
              stroke="rgb(167 139 250)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chart.bestMarker ? (
              <g>
                <line
                  x1={chart.bestMarker.x}
                  x2={chart.bestMarker.x}
                  y1={chart.plot.top}
                  y2={chart.plot.top + chart.plotHeight}
                  stroke="rgba(16,185,129,0.55)"
                  strokeDasharray="5 4"
                />
                <path
                  d={`M ${chart.bestMarker.x.toFixed(1)} ${(chart.bestMarker.y - 6).toFixed(1)} L ${(chart.bestMarker.x + 6).toFixed(1)} ${chart.bestMarker.y.toFixed(1)} L ${chart.bestMarker.x.toFixed(1)} ${(chart.bestMarker.y + 6).toFixed(1)} L ${(chart.bestMarker.x - 6).toFixed(1)} ${chart.bestMarker.y.toFixed(1)} Z`}
                  fill="rgb(16 185 129)"
                  stroke="rgba(209,250,229,0.9)"
                  strokeWidth="1"
                />
                <text
                  x={Math.min(chart.bestMarker.x + 8, chart.width - 80)}
                  y={Math.max(chart.plot.top + 12, chart.bestMarker.y - 8)}
                  className="fill-emerald-100 text-[9px]"
                >
                  best {formatNumber(chart.bestMarker.value)}
                </text>
              </g>
            ) : null}
            {chart.trainPoints.map((point) => (
              <g key={`train:${point.step}:${point.loss}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.2"
                  fill="rgb(34 211 238)"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  fill="transparent"
                  tabIndex={0}
                  onMouseEnter={() => onHoverPointChange(point)}
                  onFocus={() => onHoverPointChange(point)}
                  onMouseLeave={() => onHoverPointChange(null)}
                  onBlur={() => onHoverPointChange(null)}
                />
              </g>
            ))}
            {chart.validPoints.map((point) => (
              <g key={`valid:${point.step}:${point.loss}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.2"
                  fill="rgb(167 139 250)"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="10"
                  fill="transparent"
                  tabIndex={0}
                  onMouseEnter={() => onHoverPointChange(point)}
                  onFocus={() => onHoverPointChange(point)}
                  onMouseLeave={() => onHoverPointChange(null)}
                  onBlur={() => onHoverPointChange(null)}
                />
              </g>
            ))}
            {chart.latestTrain ? (
              <text
                x={Math.min(chart.latestTrain.x + 6, chart.width - 74)}
                y={chart.latestTrain.y - 6}
                className="fill-cyan-100 text-[9px]"
              >
                train {formatRatio(chart.latestTrain.normalizedLoss)}
              </text>
            ) : null}
            {chart.latestValid ? (
              <text
                x={Math.min(chart.latestValid.x + 6, chart.width - 66)}
                y={chart.latestValid.y + 14}
                className="fill-violet-100 text-[9px]"
              >
                val {formatRatio(chart.latestValid.normalizedLoss)}
              </text>
            ) : null}
          </svg>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-300/[0.08] px-2 py-0.5 text-yellow-100">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {isEnglish ? "save" : "保存"} {chart.saveMarkers.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-2 py-0.5 text-violet-100">
              <span className="h-2 w-2 rounded-full bg-violet-300" />
              eval {chart.evalMarkers.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2 py-0.5 text-emerald-100">
              <span className="h-2 w-2 rotate-45 bg-emerald-300" />
              {chart.bestMarker
                ? `${isEnglish ? "best" : "最佳"} ${chart.bestMarker.step}`
                : isEnglish
                  ? "best --"
                  : "最佳 --"}
            </span>
            {job.bestCheckpoint?.path ? (
              <span
                className="max-w-full truncate rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-slate-300"
                title={job.bestCheckpoint.path}
              >
                {job.bestCheckpoint.path}
              </span>
            ) : null}
          </div>

          <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
            <p>
              train {text.lossDelta}:{" "}
              <span className="text-cyan-100">
                {chart.firstTrain && chart.latestTrain
                  ? `${formatRatio(chart.firstTrain.normalizedLoss)} -> ${formatRatio(chart.latestTrain.normalizedLoss)}`
                  : "--"}
              </span>
              <span className="ml-2 text-slate-500">
                ({text.rawLoss}:{" "}
                {chart.firstTrain && chart.latestTrain
                  ? `${formatNumber(chart.firstTrain.rawLoss)} -> ${formatNumber(chart.latestTrain.rawLoss)}`
                  : "--"}
                )
              </span>
            </p>
            <p>
              val {text.lossDelta}:{" "}
              <span className="text-violet-100">
                {chart.firstValid && chart.latestValid
                  ? `${formatRatio(chart.firstValid.normalizedLoss)} -> ${formatRatio(chart.latestValid.normalizedLoss)}`
                  : "--"}
              </span>
              <span className="ml-2 text-slate-500">
                ({text.rawLoss}:{" "}
                {chart.firstValid && chart.latestValid
                  ? `${formatNumber(chart.firstValid.rawLoss)} -> ${formatNumber(chart.latestValid.rawLoss)}`
                  : "--"}
                )
              </span>
            </p>
          </div>

          {chart.overlaySeries.length ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {text.overlayRunTable}
                </p>
                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2 py-0.5 text-[10px] text-cyan-100">
                  {overlayRows.length} {isEnglish ? "runs" : "次 run"}
                </span>
              </div>
              <div className="mt-2 overflow-x-auto">
                <div className="min-w-[520px] space-y-1 text-[11px]">
                  {overlayRows.map((row) => (
                    <div
                      key={`overlay-row:${row.id}`}
                      className={`grid grid-cols-[1.4fr_.8fr_.8fr_.8fr_.8fr] items-center gap-2 rounded-xl border px-2.5 py-2 ${
                        row.current
                          ? "border-cyan-300/18 bg-cyan-300/[0.07] text-cyan-50"
                          : "border-white/10 bg-black/20 text-slate-300"
                      }`}
                    >
                      <span
                        className="truncate font-semibold"
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-center text-[10px] uppercase tracking-[0.12em] text-slate-400">
                        {row.status}
                      </span>
                      <span className="text-slate-400">
                        {text.chartStep}: {row.latestStep ?? "--"}
                      </span>
                      <span className="text-cyan-100">
                        train{" "}
                        {row.train
                          ? formatRatio(row.train.normalizedLoss)
                          : "--"}
                      </span>
                      <span className="text-violet-100">
                        val{" "}
                        {row.valid
                          ? formatRatio(row.valid.normalizedLoss)
                          : "--"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
