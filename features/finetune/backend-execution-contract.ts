import type { AgentFineTuneRecipe } from "@/lib/agent/types";

export const FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION =
  "finetune.backend-execution.v1" as const;

export type MlxLearningRateSchedule = {
  name: "cosine_decay" | "linear_schedule";
  arguments: [number, number] | [number, number, number];
  warmup: number;
  warmup_init: number;
};

type MlxExecutionInput = Pick<
  AgentFineTuneRecipe,
  | "scheduler"
  | "warmupRatio"
  | "packingPolicy"
  | "targetModules"
  | "bestCheckpointMetric"
  | "loadBestCheckpointAtEnd"
  | "learningRate"
  | "loraRank"
  | "loraAlpha"
> & {
  totalSteps: number;
  validSamples: number;
};

export function toMlxTargetModuleKey(moduleName: string) {
  if (moduleName.includes(".")) return moduleName;
  if (["q_proj", "k_proj", "v_proj", "o_proj"].includes(moduleName)) {
    return `self_attn.${moduleName}`;
  }
  if (["gate_proj", "up_proj", "down_proj"].includes(moduleName)) {
    return `mlp.${moduleName}`;
  }
  return moduleName;
}

export function buildMlxLearningRateSchedule(input: {
  scheduler: AgentFineTuneRecipe["scheduler"];
  learningRate: number;
  warmupRatio: number;
  totalSteps: number;
}): MlxLearningRateSchedule {
  const totalSteps = Math.max(1, Math.round(input.totalSteps));
  const warmup = Math.min(
    Math.max(0, totalSteps - 1),
    Math.max(0, Math.round(totalSteps * input.warmupRatio)),
  );
  const decaySteps = Math.max(1, totalSteps - warmup);
  if (input.scheduler === "cosine") {
    return {
      name: "cosine_decay",
      arguments: [input.learningRate, decaySteps, 0],
      warmup,
      warmup_init: 0,
    };
  }
  if (input.scheduler === "linear") {
    return {
      name: "linear_schedule",
      arguments: [input.learningRate, 0, decaySteps],
      warmup,
      warmup_init: 0,
    };
  }
  return {
    name: "linear_schedule",
    arguments: [input.learningRate, input.learningRate, decaySteps],
    warmup,
    warmup_init: 0,
  };
}

export function buildMlxBackendExecutionContract(input: MlxExecutionInput) {
  const blockers = [
    ...(input.packingPolicy !== "disabled"
      ? [
          `MLX-LM does not expose a verified ${input.packingPolicy} packing contract; select disabled or use a backend that implements packing.`,
        ]
      : []),
    ...(!input.targetModules.length
      ? ["MLX-LM requires at least one explicit target module key."]
      : []),
    ...(input.bestCheckpointMetric !== "eval_loss"
      ? [
          `MLX-LM training logs cannot select ${input.bestCheckpointMetric}; use eval_loss and run task metrics after training.`,
        ]
      : []),
    ...(input.loadBestCheckpointAtEnd && input.validSamples <= 0
      ? [
          "loadBestCheckpointAtEnd requires a non-empty validation split for MLX-LM.",
        ]
      : []),
  ];
  const targetModules = Array.from(
    new Set(input.targetModules.map(toMlxTargetModuleKey)),
  );
  return {
    schemaVersion: FINETUNE_BACKEND_EXECUTION_SCHEMA_VERSION,
    backend: "mlx-lm" as const,
    executable: blockers.length === 0,
    blockers,
    applied: {
      scheduler: buildMlxLearningRateSchedule(input),
      packingPolicy: "disabled" as const,
      targetModules,
      bestCheckpointMetric: input.bestCheckpointMetric,
      loadBestCheckpointAtEnd: input.loadBestCheckpointAtEnd,
      lora: {
        rank: input.loraRank,
        alpha: input.loraAlpha,
        scale: input.loraAlpha / Math.max(1, input.loraRank),
      },
    },
    postTrainingMetrics: [
      "exact-match",
      "token-overlap-f1",
      "rouge-l",
      "bleu-1",
      "latency-ms",
      "math-equivalence",
      "json-validity",
    ],
  };
}

export function assertMlxBackendExecutionContract(input: MlxExecutionInput) {
  const contract = buildMlxBackendExecutionContract(input);
  if (!contract.executable) {
    throw new Error(contract.blockers.join(" "));
  }
  return contract;
}
