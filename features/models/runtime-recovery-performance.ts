import { createHash, randomUUID } from "node:crypto";
import os from "node:os";

import {
  readLocalServerRequestLogs,
  readRuntimeProfileRegistry,
  type LocalServerRequestLogEntry,
  type ModelRuntimeProfileRecord,
} from "@/features/models/runtime-profile-registry";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";
import { getServerAgentTarget } from "@/lib/agent/server-targets";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const RUNTIME_RECOVERY_PERFORMANCE_SCHEMA_VERSION =
  "models.runtime-recovery-performance.v1" as const;

const STORE_SCHEMA_VERSION =
  "models.runtime-recovery-performance-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath(
  "models",
  "runtime-recovery-performance.json",
);
const PERFORMANCE_LIMIT = 200;
const CHECKPOINT_LIMIT = 240;

type RuntimeOperation =
  | "cancel"
  | "resume"
  | "restart"
  | "load"
  | "unload"
  | "benchmark";
type CheckpointState =
  | "ready-to-resume"
  | "resumed"
  | "completed"
  | "cancelled"
  | "failed";
type CompletionState = "complete" | "incomplete";

export type RuntimePerformanceEvidenceInput = {
  targetId: string;
  targetLabel: string;
  resolvedModel: string;
  execution: "local" | "remote";
  runtime: {
    implementation: string;
    version: string;
  };
  profile: {
    id: string;
    temperature: number;
    contextWindow: number;
    enableTools: boolean;
    enableRetrieval: boolean;
    thinkingMode: "standard" | "thinking";
    providerProfile: "speed" | "balanced" | "tool-first";
  };
  prompt: {
    classId: string;
    digest: string;
    repeatedContext: boolean;
  };
  metrics: {
    latencyMs: number | null;
    firstTokenLatencyMs: number | null;
    tokenThroughputTps: number | null;
    memoryBytes: number | null;
    queueWaitMs: number | null;
    promptTokens: number | null;
    completionTokens: number | null;
  };
  source: "request-log-enriched" | "operator-recorded";
};

export type RuntimePerformanceReceipt = RuntimePerformanceEvidenceInput & {
  id: string;
  generatedAt: string;
  hardware: {
    label: string;
    digest: string;
  };
  runtimeDigest: string;
  profileDigest: string;
  comparisonKey: string;
  completionState: CompletionState;
  blockers: string[];
  receiptDigest: string;
};

export type RuntimeRecoveryCheckpoint = {
  id: string;
  createdAt: string;
  updatedAt: string;
  operation: RuntimeOperation;
  targetId: string;
  targetLabel: string;
  runtimeProfileId: string | null;
  safeBoundary: {
    kind: string;
    referenceDigest: string;
    summary: string;
  };
  state: CheckpointState;
  transitions: Array<{
    state: CheckpointState;
    at: string;
    reason: string;
  }>;
  checkpointDigest: string;
};

type Store = {
  schemaVersion: typeof STORE_SCHEMA_VERSION;
  performance: RuntimePerformanceReceipt[];
  checkpoints: RuntimeRecoveryCheckpoint[];
};

export type RuntimeRecoveryPerformanceReadModel = {
  ok: true;
  schemaVersion: typeof RUNTIME_RECOVERY_PERFORMANCE_SCHEMA_VERSION;
  generatedAt: string;
  localStatus: "pass" | "hold";
  productionStatus: "hold";
  performance: {
    receipts: RuntimePerformanceReceipt[];
    completeReceipts: number;
    comparison: {
      status: "comparable" | "baseline-needed" | "incomplete";
      comparisonKey: string | null;
      receiptIds: string[];
      blockers: string[];
    };
  };
  recovery: {
    checkpoints: RuntimeRecoveryCheckpoint[];
    observedOperations: RuntimeOperation[];
    restartSafe: boolean;
    resumable: RuntimeRecoveryCheckpoint | null;
  };
  blockers: string[];
  receiptPath: string;
};

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function limitedText(value: unknown, label: string, max = 160) {
  const text = cleanText(value);
  if (!text) throw new Error(`${label} is required.`);
  return text.slice(0, max);
}

function normalizeOperation(value: unknown): RuntimeOperation {
  if (
    value === "cancel" ||
    value === "resume" ||
    value === "restart" ||
    value === "load" ||
    value === "unload" ||
    value === "benchmark"
  ) {
    return value;
  }
  throw new Error("operation must be cancel, resume, restart, load, unload, or benchmark.");
}

function profileSnapshot(profile: ModelRuntimeProfileRecord): RuntimePerformanceEvidenceInput["profile"] {
  return {
    id: profile.id,
    temperature: profile.temperature,
    contextWindow: profile.contextWindow,
    enableTools: profile.enableTools,
    enableRetrieval: profile.enableRetrieval,
    thinkingMode: profile.thinkingMode,
    providerProfile: profile.providerProfile,
  };
}

function readHardware() {
  const cpu = os.cpus()[0]?.model?.replace(/\s+/gu, " ").trim() || "unknown CPU";
  const summary = {
    platform: os.platform(),
    arch: os.arch(),
    memoryBytes: os.totalmem(),
    cpu,
  };
  return {
    label: `${summary.platform} ${summary.arch} · ${Math.round(summary.memoryBytes / 1024 ** 3)} GB`,
    digest: stableDigest(summary),
  };
}

function performanceBlockers(input: RuntimePerformanceEvidenceInput) {
  const required: Array<[keyof RuntimePerformanceEvidenceInput["metrics"], string]> = [
    ["latencyMs", "Total latency is missing."],
    ["firstTokenLatencyMs", "TTFT is missing."],
    ["tokenThroughputTps", "Token throughput is missing."],
    ["memoryBytes", "Memory observation is missing."],
    ["queueWaitMs", "Queue-wait observation is missing."],
    ["promptTokens", "Prompt token count is missing."],
    ["completionTokens", "Completion token count is missing."],
  ];
  const blockers = required
    .filter(([key]) => input.metrics[key] === null)
    .map(([, message]) => message);
  if (!input.prompt.digest) blockers.push("Prompt digest is missing.");
  if (!input.prompt.classId) blockers.push("Prompt class is missing.");
  if (!input.profile.id) blockers.push("Runtime profile is missing.");
  return blockers;
}

function canonicalPerformanceInput(input: RuntimePerformanceEvidenceInput): RuntimePerformanceEvidenceInput {
  const profile = input.profile;
  return {
    targetId: limitedText(input.targetId, "targetId"),
    targetLabel: limitedText(input.targetLabel, "targetLabel"),
    resolvedModel: limitedText(input.resolvedModel, "resolvedModel"),
    execution: input.execution === "remote" ? "remote" : "local",
    runtime: {
      implementation: limitedText(input.runtime?.implementation, "runtime implementation"),
      version: limitedText(input.runtime?.version, "runtime version"),
    },
    profile: {
      id: limitedText(profile?.id, "profile id"),
      temperature: numberOrNull(profile?.temperature) ?? 0,
      contextWindow: Math.round(numberOrNull(profile?.contextWindow) ?? 0),
      enableTools: Boolean(profile?.enableTools),
      enableRetrieval: Boolean(profile?.enableRetrieval),
      thinkingMode: profile?.thinkingMode === "thinking" ? "thinking" : "standard",
      providerProfile:
        profile?.providerProfile === "speed" || profile?.providerProfile === "tool-first"
          ? profile.providerProfile
          : "balanced",
    },
    prompt: {
      classId: limitedText(input.prompt?.classId, "prompt class"),
      digest: limitedText(input.prompt?.digest, "prompt digest", 128),
      repeatedContext: Boolean(input.prompt?.repeatedContext),
    },
    metrics: {
      latencyMs: numberOrNull(input.metrics?.latencyMs),
      firstTokenLatencyMs: numberOrNull(input.metrics?.firstTokenLatencyMs),
      tokenThroughputTps: numberOrNull(input.metrics?.tokenThroughputTps),
      memoryBytes: numberOrNull(input.metrics?.memoryBytes),
      queueWaitMs: numberOrNull(input.metrics?.queueWaitMs),
      promptTokens: numberOrNull(input.metrics?.promptTokens),
      completionTokens: numberOrNull(input.metrics?.completionTokens),
    },
    source: input.source === "operator-recorded" ? "operator-recorded" : "request-log-enriched",
  };
}

export function buildRuntimePerformanceReceipt(
  input: RuntimePerformanceEvidenceInput,
  options: { id?: string; generatedAt?: string; hardware?: ReturnType<typeof readHardware> } = {},
): RuntimePerformanceReceipt {
  const normalized = canonicalPerformanceInput(input);
  const hardware = options.hardware || readHardware();
  const profileDigest = stableDigest(normalized.profile);
  const runtimeDigest = stableDigest({
    targetId: normalized.targetId,
    resolvedModel: normalized.resolvedModel,
    execution: normalized.execution,
    runtime: normalized.runtime,
  });
  const comparisonKey = stableDigest({
    runtimeDigest,
    profileDigest,
    hardwareDigest: hardware.digest,
    prompt: normalized.prompt,
  });
  const blockers = performanceBlockers(normalized);
  const withoutDigest = {
    id: options.id || `runtime-performance-${randomUUID()}`,
    generatedAt: options.generatedAt || new Date().toISOString(),
    ...normalized,
    hardware,
    runtimeDigest,
    profileDigest,
    comparisonKey,
    completionState: blockers.length ? ("incomplete" as const) : ("complete" as const),
    blockers,
  };
  return { ...withoutDigest, receiptDigest: stableDigest(withoutDigest) };
}

function checkpointDigest(input: Omit<RuntimeRecoveryCheckpoint, "checkpointDigest">) {
  return stableDigest(input);
}

function nextCheckpoint(
  input: Omit<RuntimeRecoveryCheckpoint, "checkpointDigest">,
): RuntimeRecoveryCheckpoint {
  return { ...input, checkpointDigest: checkpointDigest(input) };
}

export function buildRuntimeRecoveryCheckpoint(input: {
  operation: RuntimeOperation;
  targetId: string;
  targetLabel: string;
  runtimeProfileId?: string | null;
  safeBoundary: { kind: string; reference?: string; summary: string };
  id?: string;
  now?: string;
}): RuntimeRecoveryCheckpoint {
  const now = input.now || new Date().toISOString();
  const safeBoundary = {
    kind: limitedText(input.safeBoundary?.kind, "safe boundary kind"),
    referenceDigest: stableDigest(limitedText(input.safeBoundary?.reference || input.safeBoundary?.summary, "safe boundary reference")),
    summary: limitedText(input.safeBoundary?.summary, "safe boundary summary", 280),
  };
  return nextCheckpoint({
    id: input.id || `runtime-checkpoint-${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
    operation: normalizeOperation(input.operation),
    targetId: limitedText(input.targetId, "targetId"),
    targetLabel: limitedText(input.targetLabel, "targetLabel"),
    runtimeProfileId: cleanText(input.runtimeProfileId) || null,
    safeBoundary,
    state: input.operation === "cancel" ? "cancelled" : "ready-to-resume",
    transitions: [
      {
        state: input.operation === "cancel" ? "cancelled" : "ready-to-resume",
        at: now,
        reason:
          input.operation === "cancel"
            ? "Cancellation boundary persisted."
            : "Safe boundary persisted before recovery work.",
      },
    ],
  });
}

const ALLOWED_TRANSITIONS: Record<CheckpointState, CheckpointState[]> = {
  "ready-to-resume": ["resumed", "cancelled", "failed"],
  resumed: ["completed", "failed", "ready-to-resume"],
  completed: [],
  cancelled: [],
  failed: ["ready-to-resume"],
};

export function transitionRuntimeRecoveryCheckpoint(
  checkpoint: RuntimeRecoveryCheckpoint,
  input: { state: Exclude<CheckpointState, "ready-to-resume"> | "ready-to-resume"; reason?: string; now?: string },
) {
  if (!ALLOWED_TRANSITIONS[checkpoint.state].includes(input.state)) {
    throw new Error(`Cannot transition checkpoint from ${checkpoint.state} to ${input.state}.`);
  }
  const now = input.now || new Date().toISOString();
  return nextCheckpoint({
    ...checkpoint,
    updatedAt: now,
    state: input.state,
    transitions: [
      ...checkpoint.transitions,
      {
        state: input.state,
        at: now,
        reason: cleanText(input.reason, `Checkpoint transitioned to ${input.state}.`).slice(0, 280),
      },
    ].slice(-20),
  });
}

function emptyStore(): Store {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    performance: [],
    checkpoints: [],
  };
}

function validStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return (
    candidate.schemaVersion === STORE_SCHEMA_VERSION &&
    Array.isArray(candidate.performance) &&
    Array.isArray(candidate.checkpoints)
  );
}

function readStore() {
  const receipts = readDurableReceipts<Store>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const store = receipts[0];
  return validStore(store) ? store : emptyStore();
}

function persist(store: Store) {
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, store, 1);
}

function replaceCheckpoint(checkpoint: RuntimeRecoveryCheckpoint) {
  const current = readStore();
  const store: Store = {
    ...current,
    checkpoints: [checkpoint, ...current.checkpoints.filter((entry) => entry.id !== checkpoint.id)].slice(
      0,
      CHECKPOINT_LIMIT,
    ),
  };
  persist(store);
  return checkpoint;
}

export function recordRuntimePerformanceEvidence(input: RuntimePerformanceEvidenceInput) {
  const receipt = buildRuntimePerformanceReceipt(input);
  const current = readStore();
  persist({
    ...current,
    performance: [receipt, ...current.performance].slice(0, PERFORMANCE_LIMIT),
  });
  return receipt;
}

export function startRuntimeRecoveryCheckpoint(input: Parameters<typeof buildRuntimeRecoveryCheckpoint>[0]) {
  return replaceCheckpoint(buildRuntimeRecoveryCheckpoint(input));
}

export function advanceRuntimeRecoveryCheckpoint(input: {
  checkpointId: string;
  state: CheckpointState;
  reason?: string;
}) {
  const current = readStore();
  const checkpoint = current.checkpoints.find((entry) => entry.id === input.checkpointId);
  if (!checkpoint) throw new Error("Runtime recovery checkpoint was not found.");
  return replaceCheckpoint(
    transitionRuntimeRecoveryCheckpoint(checkpoint, {
      state: input.state,
      reason: input.reason,
    }),
  );
}

function runtimeVersionFor(entry: LocalServerRequestLogEntry) {
  const target = getServerAgentTarget(entry.targetId);
  return {
    implementation: target?.providerLabel || entry.providerLabel || "unknown runtime",
    version: target?.execution === "local" ? "runtime-version-unreported" : "provider-version-unreported",
  };
}

export function captureLatestRuntimeRequestPerformance(input: {
  profileId: string;
  promptClass: string;
  repeatedContext?: boolean;
  memoryBytes?: number | null;
  queueWaitMs?: number | null;
}) {
  const profile = readRuntimeProfileRegistry().profiles.find(
    (entry) => entry.id === input.profileId,
  );
  if (!profile) throw new Error("Runtime profile was not found.");
  const entry = readLocalServerRequestLogs({ targetId: profile.targetId, limit: 200 }).entries.find(
    (candidate) => candidate.ok,
  );
  if (!entry) {
    throw new Error("No successful request log exists for the selected runtime profile target.");
  }
  const target = getServerAgentTarget(entry.targetId);
  return recordRuntimePerformanceEvidence({
    targetId: entry.targetId,
    targetLabel: entry.targetLabel || target?.label || entry.targetId,
    resolvedModel: entry.resolvedModel,
    execution: target?.execution === "remote" ? "remote" : "local",
    runtime: runtimeVersionFor(entry),
    profile: profileSnapshot(profile),
    prompt: {
      classId: limitedText(input.promptClass, "prompt class"),
      digest: stableDigest(entry.inputPreview),
      repeatedContext: Boolean(input.repeatedContext),
    },
    metrics: {
      latencyMs: numberOrNull(entry.latencyMs),
      firstTokenLatencyMs: numberOrNull(entry.firstTokenLatencyMs),
      tokenThroughputTps: numberOrNull(entry.tokenThroughputTps),
      memoryBytes: numberOrNull(input.memoryBytes),
      queueWaitMs: numberOrNull(input.queueWaitMs),
      promptTokens: numberOrNull(entry.usage?.promptTokens),
      completionTokens: numberOrNull(entry.usage?.completionTokens),
    },
    source: "request-log-enriched",
  });
}

export function buildRuntimeRecoveryPerformanceReadModel(input: {
  performance: RuntimePerformanceReceipt[];
  checkpoints: RuntimeRecoveryCheckpoint[];
  generatedAt?: string;
}): RuntimeRecoveryPerformanceReadModel {
  const store: Store = {
    schemaVersion: STORE_SCHEMA_VERSION,
    performance: input.performance,
    checkpoints: input.checkpoints,
  };
  const complete = store.performance.filter((entry) => entry.completionState === "complete");
  const matchingGroup = complete
    .filter((entry) => entry.execution === "local")
    .map((entry) => ({
      entry,
      matches: complete.filter((candidate) => candidate.comparisonKey === entry.comparisonKey),
    }))
    .find(({ matches }) => matches.length >= 2);
  const newest = store.performance[0] || null;
  const comparison = matchingGroup
    ? {
        status: "comparable" as const,
        comparisonKey: matchingGroup.entry.comparisonKey,
        receiptIds: matchingGroup.matches.map((entry) => entry.id),
        blockers: [],
      }
    : newest?.completionState === "incomplete"
      ? {
          status: "incomplete" as const,
          comparisonKey: null,
          receiptIds: [newest.id],
          blockers: newest.blockers,
        }
      : {
          status: "baseline-needed" as const,
          comparisonKey: newest?.comparisonKey || null,
          receiptIds: newest ? [newest.id] : [],
          blockers: [
            "At least two complete receipts with the same runtime, profile, hardware, prompt digest, and repeated-context setting are required.",
          ],
        };
  const observedOperations = [...new Set(store.checkpoints.map((entry) => entry.operation))] as RuntimeOperation[];
  const restartSafe = store.checkpoints.some(
    (entry) =>
      entry.operation === "restart" &&
      entry.state === "completed" &&
      entry.transitions.some((transition) => transition.state === "resumed"),
  );
  const requiredOperations: RuntimeOperation[] = [
    "cancel",
    "resume",
    "restart",
    "load",
    "unload",
    "benchmark",
  ];
  const localBlockers = [
    ...comparison.blockers,
    ...requiredOperations
      .filter((operation) => !observedOperations.includes(operation))
      .map((operation) => `Recovery evidence for ${operation} has not been recorded.`),
    ...(restartSafe
      ? []
      : ["No completed restart checkpoint contains a persisted safe boundary followed by resume."]),
  ];
  const blockers = [
    ...localBlockers,
    "External status remains HOLD until same-machine repetition, clean-machine recovery, and independent Apple Silicon review are available.",
  ];
  return {
    ok: true,
    schemaVersion: RUNTIME_RECOVERY_PERFORMANCE_SCHEMA_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    localStatus: localBlockers.length === 0 ? "pass" : "hold",
    productionStatus: "hold",
    performance: {
      receipts: store.performance,
      completeReceipts: complete.length,
      comparison,
    },
    recovery: {
      checkpoints: store.checkpoints,
      observedOperations,
      restartSafe,
      resumable:
        store.checkpoints.find((entry) => entry.state === "ready-to-resume") || null,
    },
    blockers,
    receiptPath: RECEIPT_PATH,
  };
}

export function readRuntimeRecoveryPerformanceEvidence(): RuntimeRecoveryPerformanceReadModel {
  const store = readStore();
  return buildRuntimeRecoveryPerformanceReadModel(store);
}
