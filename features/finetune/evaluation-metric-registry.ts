import { evaluateMathEquivalence } from "@/features/benchmark/math-evaluator-port";
import { scoreTokenOverlap } from "@/lib/finetune/operation-shared";

export const FINETUNE_EVALUATION_METRIC_SCHEMA_VERSION =
  "finetune.evaluation-metrics.v1" as const;

export type FineTuneMetricId =
  | "loss"
  | "rouge-l"
  | "bleu-1"
  | "exact-match"
  | "token-overlap-f1"
  | "latency-ms"
  | "math-equivalence"
  | "json-validity";

export type FineTuneMetricResult = {
  id: FineTuneMetricId;
  status: "scored" | "unavailable";
  value: number | null;
  evaluatorId: string;
  evaluatorVersion: string;
  rationale?: string;
};

const METRIC_ALIASES: Record<string, FineTuneMetricId> = {
  bleu: "bleu-1",
  latency: "latency-ms",
};

const METRIC_IDS: FineTuneMetricId[] = [
  "loss",
  "rouge-l",
  "bleu-1",
  "exact-match",
  "token-overlap-f1",
  "latency-ms",
  "math-equivalence",
  "json-validity",
];

function tokenize(value: string) {
  return value.toLowerCase().match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) || [];
}

function lcsLength(left: string[], right: string[]) {
  const row = new Array<number>(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = 0;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? diagonal + 1
          : Math.max(row[rightIndex], row[rightIndex - 1]);
      diagonal = previous;
    }
  }
  return row[right.length];
}

function rougeL(reference: string, prediction: string) {
  const gold = tokenize(reference);
  const candidate = tokenize(prediction);
  if (!gold.length || !candidate.length) return 0;
  const overlap = lcsLength(gold, candidate);
  const precision = overlap / candidate.length;
  const recall = overlap / gold.length;
  return precision && recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function bleu1(reference: string, prediction: string) {
  const gold = tokenize(reference);
  const candidate = tokenize(prediction);
  if (!gold.length || !candidate.length) return 0;
  const remaining = new Map<string, number>();
  gold.forEach((token) => remaining.set(token, (remaining.get(token) || 0) + 1));
  let matched = 0;
  candidate.forEach((token) => {
    const count = remaining.get(token) || 0;
    if (count > 0) {
      matched += 1;
      remaining.set(token, count - 1);
    }
  });
  const precision = matched / candidate.length;
  const brevityPenalty =
    candidate.length >= gold.length
      ? 1
      : Math.exp(1 - gold.length / candidate.length);
  return precision * brevityPenalty;
}

export function normalizeFineTuneMetricIds(metrics?: string[]) {
  const requested = metrics?.length
    ? metrics
    : ["rouge-l", "exact-match", "token-overlap-f1", "latency-ms"];
  return Array.from(
    new Set(
      requested
        .map((metric) => METRIC_ALIASES[metric] || metric)
        .filter((metric): metric is FineTuneMetricId =>
          METRIC_IDS.includes(metric as FineTuneMetricId),
        ),
    ),
  );
}

export async function evaluateFineTuneMetricSet(input: {
  reference: string;
  prediction: string;
  latencyMs: number;
  metrics?: string[];
}): Promise<FineTuneMetricResult[]> {
  const ids = normalizeFineTuneMetricIds(input.metrics);
  return Promise.all(
    ids.map(async (id): Promise<FineTuneMetricResult> => {
      if (id === "loss") {
        return {
          id,
          status: "unavailable",
          value: null,
          evaluatorId: "generation-no-logits",
          evaluatorVersion: "1",
          rationale:
            "Loss requires token logits and labels; the Provider inference port returns generated text only.",
        };
      }
      if (id === "math-equivalence") {
        const result = await evaluateMathEquivalence(
          input.reference,
          input.prediction,
        );
        const evaluation = result.evaluation;
        return {
          id,
          status:
            evaluation?.status === "scored" ? "scored" : "unavailable",
          value: result.score,
          evaluatorId: evaluation?.evaluatorId || "huggingface-math-verify",
          evaluatorVersion: evaluation?.evaluatorVersion || "unavailable",
          rationale: result.rationale,
        };
      }
      let value: number;
      if (id === "rouge-l") value = rougeL(input.reference, input.prediction);
      else if (id === "bleu-1") value = bleu1(input.reference, input.prediction);
      else if (id === "exact-match") {
        value = Number(input.reference.trim() === input.prediction.trim());
      } else if (id === "token-overlap-f1") {
        value = scoreTokenOverlap(input.reference, input.prediction);
      } else if (id === "latency-ms") value = input.latencyMs;
      else {
        try {
          JSON.parse(input.prediction);
          value = 1;
        } catch {
          value = 0;
        }
      }
      return {
        id,
        status: "scored",
        value: Number(value.toFixed(6)),
        evaluatorId: `first-llm-${id}`,
        evaluatorVersion: "1",
      };
    }),
  );
}

export function summarizeFineTuneMetricResults(rows: FineTuneMetricResult[][]) {
  return normalizeFineTuneMetricIds(rows.flat().map((metric) => metric.id)).map(
    (id) => {
      const matching = rows.flat().filter((metric) => metric.id === id);
      const scored = matching.filter(
        (metric): metric is FineTuneMetricResult & { value: number } =>
          metric.status === "scored" && typeof metric.value === "number",
      );
      return {
        id,
        status: scored.length ? ("scored" as const) : ("unavailable" as const),
        value: scored.length
          ? Number(
              (
                scored.reduce((sum, metric) => sum + metric.value, 0) /
                scored.length
              ).toFixed(6),
            )
          : null,
        scoredSamples: scored.length,
        unavailableSamples: matching.length - scored.length,
        evaluatorIds: Array.from(new Set(matching.map((metric) => metric.evaluatorId))),
      };
    },
  );
}
