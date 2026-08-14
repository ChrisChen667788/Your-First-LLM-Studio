import { existsSync, realpathSync, statSync } from "fs";
import path from "path";
import {
  listServerAgentTargets,
  removeDiscoveredLocalTarget,
  upsertDiscoveredLocalTarget,
} from "@/lib/agent/server-targets";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import type { AgentTarget } from "@/lib/agent/types";
import {
  LOCAL_GATEWAY_BASE_URL,
  normalizeRuntimeAliasSegment,
  toEnvKey,
  type FineTuneRuntimeAttachment,
} from "./store-internal";
import { buildFineTuneAdapterArtifacts } from "./bundle-service";
import {
  readJobs,
  readRecipes,
  readRuntimeAttachments,
  updateRuntimeAttachments,
} from "./repository";
import {
  listFineTuneTargetOptions,
  resolveBaseModelRef,
} from "./target-service";

function getFineTuneRuntimeContext(adapterId: string) {
  const localTargets = listFineTuneTargetOptions();
  const recipes = readRecipes();
  const jobs = readJobs();
  const adapters = buildFineTuneAdapterArtifacts(jobs, recipes, localTargets);
  const adapter = adapters.find((entry) => entry.id === adapterId);
  if (!adapter) {
    throw new Error("Fine-tune adapter not found.");
  }
  const job = jobs.find((entry) => entry.id === adapter.jobId);
  const recipe = job
    ? recipes.find((entry) => entry.id === job.recipeId)
    : null;
  const baseTargetOption = recipe
    ? localTargets.find((entry) => entry.id === recipe.baseTargetId)
    : null;
  const baseTarget = recipe
    ? listServerAgentTargets().find((entry) => entry.id === recipe.baseTargetId)
    : null;
  return { adapter, job, recipe, baseTargetOption, baseTarget };
}

export function buildFineTuneAdapterAlias(adapterName: string, jobId: string) {
  const suffix = jobId.replace(/^ft-job-/, "").slice(-8);
  const segment = normalizeRuntimeAliasSegment(adapterName) || "adapter";
  return `local-ft-${segment}-${suffix}`;
}

export function buildAttachedAdapterTarget(
  entry: FineTuneRuntimeAttachment,
): AgentTarget {
  const envKeyBase = toEnvKey(entry.alias);
  const recommendedContextLabel =
    typeof entry.baseRecommendedContextWindow === "number" &&
    Number.isFinite(entry.baseRecommendedContextWindow)
      ? `${Math.max(1, Math.round(entry.baseRecommendedContextWindow / 1024))}K`
      : "Inherited";

  return {
    id: entry.alias,
    label: entry.label,
    providerLabel: "Local MLX Gateway",
    transport: "openai-compatible",
    execution: "local",
    description:
      "Fine-tune adapter mounted on the local MLX gateway. Use it directly in chat, compare, runtime ops, and benchmark without leaving the current workflow.",
    modelEnv: `LOCAL_${envKeyBase}_MODEL`,
    modelDefault: entry.alias,
    baseUrlEnv: "LOCAL_AGENT_BASE_URL",
    baseUrlDefault: (
      process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:4000/v1"
    ).replace(/\/$/, ""),
    supportsTools: true,
    recommendedContext:
      entry.baseRecommendedContext ||
      `Adapter inherits the base model context. Recommended: ${recommendedContextLabel}.`,
    memoryProfile: `${entry.baseMemoryProfile} Adapter weights still sit on top of the base model, so keep an eye on shared memory pressure.`,
    notes: [
      "This target was mounted from a fine-tune adapter artifact.",
      `Base target: ${entry.baseTargetLabel}`,
      `Adapter path: ${entry.adapterPath}`,
      `Base model ref: ${entry.baseModelRef}`,
    ],
    launchHints: [
      "Run compare to measure the adapter against its base lane immediately.",
      "Run benchmark to validate whether the adapter improves the intended behavior before keeping it mounted.",
    ],
    parameterScale: entry.baseParameterScale,
    quantizationLabel: entry.baseQuantizationLabel,
    sourceKind: "adapter-runtime",
    sourceLabel: "Fine-tune adapter runtime",
    sourcePath: entry.baseSourcePath,
    sourceRepoId: entry.baseSourceRepoId,
    recommendedContextWindow: entry.baseRecommendedContextWindow,
  };
}

function isPathWithin(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function containsMlxAdapterWeights(directory: string) {
  return ["adapters.safetensors", "adapter_model.safetensors"].some((name) =>
    existsSync(path.join(directory, name)),
  );
}

export function resolveFineTuneCheckpointDirectory(input: {
  outputDir: string;
  requestedPath?: string;
  fallbackPath?: string;
}) {
  const candidate = path.resolve(
    input.requestedPath?.trim() || input.fallbackPath || input.outputDir,
  );
  const outputRoot = realpathSync(input.outputDir);
  if (!existsSync(candidate)) {
    throw new Error(`Adapter checkpoint does not exist: ${candidate}`);
  }
  const resolvedCandidate = realpathSync(candidate);
  if (!isPathWithin(outputRoot, resolvedCandidate)) {
    throw new Error("Adapter checkpoint must stay inside the job output directory.");
  }
  const checkpointDirectory = statSync(resolvedCandidate).isFile()
    ? path.dirname(resolvedCandidate)
    : resolvedCandidate;
  if (!statSync(checkpointDirectory).isDirectory()) {
    throw new Error("Adapter checkpoint path must resolve to a directory.");
  }
  if (!containsMlxAdapterWeights(checkpointDirectory)) {
    throw new Error(
      `Adapter checkpoint has no MLX adapter weights: ${checkpointDirectory}`,
    );
  }
  return checkpointDirectory;
}

export function resolveFineTuneCheckpointPath(input: {
  adapterId: string;
  checkpointPath?: string;
}) {
  const { adapter, job, recipe, baseTargetOption, baseTarget } =
    getFineTuneRuntimeContext(input.adapterId);
  if (adapter.status !== "ready" || adapter.checkpointCount <= 0) {
    throw new Error("Adapter is not ready for runtime attach yet.");
  }
  if (!existsSync(adapter.outputDir)) {
    throw new Error(`Adapter output dir does not exist: ${adapter.outputDir}`);
  }

  if (!job || !recipe || !baseTargetOption || !baseTarget) {
    throw new Error("Adapter is missing its base target context.");
  }

  const requested = input.checkpointPath?.trim();
  const fallback =
    adapter.bestCheckpoint?.loadBestCheckpointAtEnd &&
    adapter.bestCheckpoint.path &&
    existsSync(adapter.bestCheckpoint.path)
      ? adapter.bestCheckpoint.path
      : adapter.outputDir;
  const outputRoot = realpathSync(adapter.outputDir);
  const resolvedCandidate = resolveFineTuneCheckpointDirectory({
    outputDir: adapter.outputDir,
    requestedPath: requested,
    fallbackPath: fallback,
  });
  return {
    adapter,
    job,
    recipe,
    baseTargetOption,
    baseTarget,
    selectedAdapterPath: resolvedCandidate,
    selectionSource: requested
      ? ("requested" as const)
      : resolvedCandidate === outputRoot
        ? ("output" as const)
        : ("best" as const),
  };
}

export async function attachFineTuneAdapterRuntime(input: {
  adapterId: string;
  checkpointPath?: string;
}) {
  const {
    adapter,
    job,
    baseTargetOption,
    baseTarget,
    selectedAdapterPath,
    selectionSource,
  } = resolveFineTuneCheckpointPath(input);

  const current = readRuntimeAttachments();
  const existing = current.find((entry) => entry.adapterId === adapter.id);
  const now = new Date().toISOString();
  const alias =
    existing?.alias ||
    buildFineTuneAdapterAlias(adapter.adapterName, adapter.jobId);
  const label =
    existing?.label || `${baseTarget.label} · ${adapter.adapterName}`;
  if (existing && existing.adapterPath !== selectedAdapterPath) {
    const release = await detachLoadedRuntimeAlias(existing.alias);
    if (!release.released && release.releasedAlias === existing.alias) {
      throw new Error(
        `Loaded runtime ${existing.alias} could not be released before checkpoint switch.`,
      );
    }
  }
  const attachment: FineTuneRuntimeAttachment = {
    adapterId: adapter.id,
    jobId: adapter.jobId,
    alias,
    label,
    baseTargetId: baseTarget.id,
    baseTargetLabel: baseTarget.label,
    baseModelRef: job.baseModelRef || resolveBaseModelRef(baseTargetOption),
    baseSourcePath: baseTarget.sourcePath,
    baseSourceRepoId: baseTarget.sourceRepoId,
    baseParameterScale: baseTarget.parameterScale,
    baseQuantizationLabel: baseTarget.quantizationLabel,
    baseRecommendedContextWindow: baseTarget.recommendedContextWindow,
    baseRecommendedContext: baseTarget.recommendedContext,
    baseMemoryProfile: baseTarget.memoryProfile,
    adapterPath: selectedAdapterPath,
    attachedAt: existing?.attachedAt || now,
    updatedAt: now,
  };

  updateRuntimeAttachments((entries) =>
    [
      attachment,
      ...entries.filter((entry) => entry.adapterId !== adapter.id),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  const target = buildAttachedAdapterTarget(attachment);
  upsertDiscoveredLocalTarget(target);

  appendExperimentEvent({
    kind: "finetune",
    status: "saved",
    title: "Adapter mounted to local runtime",
    summary: `${adapter.adapterName} -> ${target.label}`,
    relatedId: adapter.id,
    targetIds: [baseTarget.id, target.id],
    artifacts: [
      {
        kind: "directory",
        role: "adapter",
        label: adapter.adapterName,
        uri: selectedAdapterPath,
      },
    ],
    links: [
      { relation: "attaches", entityType: "adapter", id: adapter.id, label: adapter.adapterName },
      { relation: "derived-from", entityType: "job", id: adapter.jobId },
      { relation: "uses", entityType: "target", id: baseTarget.id, label: baseTarget.label },
    ],
    metadata: {
      checkpointSelectionSource: selectionSource,
      checkpointPath: selectedAdapterPath,
    },
  });

  return {
    attachment,
    target,
    selectionSource,
  };
}

async function detachLoadedRuntimeAlias(alias: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const baseUrl = LOCAL_GATEWAY_BASE_URL.replace(/\/v1$/, "");
    const healthResponse = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!healthResponse.ok) {
      return { released: false, releasedAlias: null as string | null };
    }
    const health = (await healthResponse.json()) as {
      loaded_alias?: string | null;
    };
    if (health.loaded_alias !== alias) {
      return { released: false, releasedAlias: health.loaded_alias ?? null };
    }

    const releaseResponse = await fetch(`${baseUrl}/v1/models/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!releaseResponse.ok) {
      return { released: false, releasedAlias: alias };
    }
    const payload = (await releaseResponse.json().catch(() => ({}))) as {
      released_alias?: string | null;
    };
    return {
      released: true,
      releasedAlias: payload.released_alias ?? null,
    };
  } catch {
    return { released: false, releasedAlias: null as string | null };
  } finally {
    clearTimeout(timer);
  }
}

export async function detachFineTuneAdapterRuntime(input: {
  adapterId: string;
}) {
  const current = readRuntimeAttachments();
  const existing = current.find((entry) => entry.adapterId === input.adapterId);
  if (!existing) {
    throw new Error("Adapter runtime is not attached.");
  }

  const releaseResult = await detachLoadedRuntimeAlias(existing.alias);
  updateRuntimeAttachments((entries) =>
    entries.filter((entry) => entry.adapterId !== input.adapterId),
  );
  removeDiscoveredLocalTarget(existing.alias);

  appendExperimentEvent({
    kind: "finetune",
    status: "saved",
    title: releaseResult.released
      ? "Adapter detached and runtime released"
      : "Adapter detached from local runtime",
    summary: releaseResult.released
      ? `${existing.label} was detached and the loaded local runtime was released.`
      : `${existing.label} was detached from the local target catalog.`,
    relatedId: input.adapterId,
    targetIds: [existing.baseTargetId, existing.alias],
    artifacts: [
      {
        kind: "directory",
        role: "adapter",
        label: existing.label,
        uri: existing.adapterPath,
      },
    ],
    links: [
      { relation: "source", entityType: "adapter", id: input.adapterId, label: existing.label },
      { relation: "derived-from", entityType: "job", id: existing.jobId },
    ],
  });

  return {
    attachment: existing,
    releasedRuntime: releaseResult.released,
    releasedAlias: releaseResult.releasedAlias,
  };
}
