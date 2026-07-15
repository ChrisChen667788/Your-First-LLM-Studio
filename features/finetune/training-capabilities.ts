export const TRAINING_CAPABILITY_SCHEMA_VERSION =
  "finetune.training-capabilities.v1" as const;

export type TrainingMethod =
  | "lora"
  | "qlora"
  | "dora"
  | "rslora"
  | "full"
  | "dpo"
  | "orpo";

export type TrainingBackendCapability = {
  id: "mlx-lm" | "llama-factory" | "transformers-peft";
  status: "implemented" | "preview" | "planned";
  platforms: string[];
  modelFamilies: string[];
  methods: TrainingMethod[];
  quantizationBits: number[];
  distributed: boolean;
  bestCheckpoint: boolean;
  supportedSchedulers: string[];
};

const BACKENDS: TrainingBackendCapability[] = [
  {
    id: "mlx-lm",
    status: "implemented",
    platforms: ["darwin-arm64"],
    modelFamilies: ["qwen", "llama", "mistral", "gemma", "phi"],
    methods: ["lora", "qlora", "dora"],
    quantizationBits: [4, 8, 16],
    distributed: false,
    bestCheckpoint: true,
    supportedSchedulers: ["linear", "cosine", "constant", "constant_with_warmup"],
  },
  {
    id: "llama-factory",
    status: "planned",
    platforms: ["linux-x64-nvidia", "linux-x64-amd"],
    modelFamilies: ["qwen", "llama", "mistral", "gemma", "phi", "deepseek", "glm"],
    methods: ["lora", "qlora", "dora", "rslora", "full", "dpo", "orpo"],
    quantizationBits: [2, 3, 4, 5, 6, 8, 16],
    distributed: true,
    bestCheckpoint: true,
    supportedSchedulers: ["linear", "cosine", "cosine_with_restarts", "polynomial", "constant", "constant_with_warmup"],
  },
  {
    id: "transformers-peft",
    status: "planned",
    platforms: ["linux-x64-nvidia", "windows-x64-nvidia"],
    modelFamilies: ["qwen", "llama", "mistral", "gemma", "phi"],
    methods: ["lora", "qlora", "dora", "rslora"],
    quantizationBits: [4, 8, 16],
    distributed: true,
    bestCheckpoint: true,
    supportedSchedulers: ["linear", "cosine", "constant", "constant_with_warmup"],
  },
];

export function evaluateTrainingCompatibility(input: {
  backendId: TrainingBackendCapability["id"];
  modelFamily: string;
  method: TrainingMethod;
  quantizationBits: number;
  scheduler: string;
  distributed?: boolean;
}) {
  const backend = BACKENDS.find((candidate) => candidate.id === input.backendId);
  if (!backend) return { supported: false, reasons: ["Unknown training backend."] };
  const reasons = [
    ...(!backend.modelFamilies.includes(input.modelFamily.toLowerCase())
      ? [`${input.modelFamily} is not declared by ${backend.id}.`]
      : []),
    ...(!backend.methods.includes(input.method)
      ? [`${input.method} is not supported by ${backend.id}.`]
      : []),
    ...(!backend.quantizationBits.includes(input.quantizationBits)
      ? [`${input.quantizationBits}-bit training is not supported by ${backend.id}.`]
      : []),
    ...(!backend.supportedSchedulers.includes(input.scheduler)
      ? [`${input.scheduler} is not supported by ${backend.id}.`]
      : []),
    ...(input.distributed && !backend.distributed
      ? [`${backend.id} does not support distributed execution.`]
      : []),
    ...(backend.status !== "implemented"
      ? [`${backend.id} is ${backend.status} and cannot execute from this checkout yet.`]
      : []),
  ];
  return { supported: reasons.length === 0, reasons, backend };
}

export function readTrainingCapabilityRegistry() {
  return {
    ok: true as const,
    schemaVersion: TRAINING_CAPABILITY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    backends: BACKENDS,
    sampleCompatibility: evaluateTrainingCompatibility({
      backendId: "mlx-lm",
      modelFamily: "qwen",
      method: "lora",
      quantizationBits: 4,
      scheduler: "cosine",
    }),
    totals: {
      backends: BACKENDS.length,
      implemented: BACKENDS.filter((backend) => backend.status === "implemented").length,
      planned: BACKENDS.filter((backend) => backend.status === "planned").length,
      methods: new Set(BACKENDS.flatMap((backend) => backend.methods)).size,
    },
  };
}
