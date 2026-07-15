import crypto from "crypto";
import type {
  AgentFineTuneAdapterArtifact,
  AgentFineTuneAdapterExportPlan,
  AgentFineTuneAdapterLifecycleAction,
  AgentFineTuneAdapterLifecycleSummary,
  AgentFineTuneAdapterLifecycleVariant,
  AgentFineTuneAdapterVariantDiff,
  AgentFineTuneJob,
  AgentFineTuneOperation,
  AgentFineTuneRecipe,
} from "@/lib/agent/types";
import {
  ADAPTER_LIFECYCLE_FILE,
  readJsonFile,
  writeJsonFile,
} from "./store-internal";
import { buildFineTuneAdapterArtifacts } from "./bundle-service";
import { readJobs, readOperations, readRecipes } from "./repository";
import {
  attachFineTuneAdapterRuntime,
  detachFineTuneAdapterRuntime,
} from "./runtime-service";
import { listFineTuneTargetOptions } from "./target-service";

type LifecycleActionInput = Omit<
  AgentFineTuneAdapterLifecycleAction,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LifecycleStore = {
  actions: AgentFineTuneAdapterLifecycleAction[];
};

const DEFAULT_EXPORT_PLANS = [
  { exportFormat: "adapter-bundle", quantization: "none" },
  { exportFormat: "merged-mlx", quantization: "q8" },
  { exportFormat: "gguf", quantization: "q4" },
] satisfies Array<
  Pick<AgentFineTuneAdapterExportPlan, "exportFormat" | "quantization">
>;

function readLifecycleStore(): LifecycleStore {
  const store = readJsonFile<LifecycleStore>(ADAPTER_LIFECYCLE_FILE, {
    actions: [],
  });
  return {
    actions: Array.isArray(store.actions)
      ? store.actions
          .filter(
            (action) =>
              action &&
              typeof action.id === "string" &&
              typeof action.adapterId === "string" &&
              typeof action.kind === "string",
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      : [],
  };
}

function writeLifecycleStore(store: LifecycleStore) {
  writeJsonFile(ADAPTER_LIFECYCLE_FILE, {
    actions: store.actions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  });
}

function saveLifecycleAction(input: LifecycleActionInput) {
  const now = new Date().toISOString();
  const action: AgentFineTuneAdapterLifecycleAction = {
    ...input,
    id: input.id || `ft-life-${crypto.randomUUID()}`,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
  const current = readLifecycleStore();
  writeLifecycleStore({
    actions: [
      action,
      ...current.actions.filter((entry) => entry.id !== action.id),
    ],
  });
  return action;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function classifyMetricDelta(delta: number | null | undefined) {
  if (delta === null || delta === undefined) return "insufficient-data";
  if (Math.abs(delta) < 0.0001) return "stable";
  return delta < 0 ? "improved" : "regressed";
}

function buildVariantDiff(input: {
  adapter: AgentFineTuneAdapterArtifact;
  previous?: AgentFineTuneAdapterArtifact;
  exportCount: number;
  previousExportCount: number;
}): AgentFineTuneAdapterVariantDiff {
  const { adapter, previous, exportCount, previousExportCount } = input;
  if (!previous) {
    return { conclusion: "insufficient-data" };
  }
  const currentMetric = numberOrNull(adapter.bestCheckpoint?.value);
  const previousMetric = numberOrNull(previous.bestCheckpoint?.value);
  const bestMetricDelta =
    currentMetric !== null && previousMetric !== null
      ? currentMetric - previousMetric
      : null;
  const checkpointDelta = adapter.checkpointCount - previous.checkpointCount;
  const exportDelta = exportCount - previousExportCount;
  const metricConclusion = classifyMetricDelta(bestMetricDelta);
  const conclusion =
    metricConclusion === "insufficient-data"
      ? checkpointDelta === 0 && exportDelta === 0
        ? "stable"
        : "mixed"
      : metricConclusion;
  return {
    previousAdapterId: previous.id,
    previousJobId: previous.jobId,
    checkpointDelta,
    bestMetricDelta,
    exportDelta,
    conclusion,
  };
}

function lifecycleVariantGroup(adapter: AgentFineTuneAdapterArtifact) {
  return [
    adapter.baseTargetId || "unknown-base",
    adapter.adapterName.trim().toLowerCase() || "unnamed-adapter",
  ].join(":");
}

function exportOperationPlan(
  operation: AgentFineTuneOperation,
  adapter: AgentFineTuneAdapterArtifact,
): AgentFineTuneAdapterExportPlan {
  const metadata = operation.metadata || {};
  const exportFormat =
    metadata.exportFormat === "merged-mlx" || metadata.exportFormat === "gguf"
      ? metadata.exportFormat
      : "adapter-bundle";
  const quantization =
    metadata.quantization === "q8" || metadata.quantization === "q4"
      ? metadata.quantization
      : "none";
  return {
    id: `operation:${operation.id}`,
    adapterId: adapter.id,
    adapterName: adapter.adapterName,
    exportFormat,
    quantization,
    status: "completed",
    operationId: operation.id,
    outputDir:
      typeof metadata.exportDir === "string" ? metadata.exportDir : undefined,
    publishTarget:
      typeof metadata.publishTarget === "string"
        ? metadata.publishTarget
        : undefined,
    publishChecklistStatus:
      typeof metadata.publishChecklistStatus === "string"
        ? metadata.publishChecklistStatus
        : undefined,
    generatedAt: operation.updatedAt,
  };
}

function lifecycleActionPlan(
  action: AgentFineTuneAdapterLifecycleAction,
  adapter: AgentFineTuneAdapterArtifact,
): AgentFineTuneAdapterExportPlan | null {
  if (action.kind !== "export-plan") return null;
  const exportFormat =
    action.metadata?.exportFormat === "adapter-bundle" ||
    action.metadata?.exportFormat === "merged-mlx" ||
    action.metadata?.exportFormat === "gguf"
      ? action.metadata.exportFormat
      : "adapter-bundle";
  const quantization =
    action.metadata?.quantization === "q8" ||
    action.metadata?.quantization === "q4"
      ? action.metadata.quantization
      : "none";
  return {
    id: `action:${action.id}`,
    adapterId: adapter.id,
    adapterName: adapter.adapterName,
    exportFormat,
    quantization,
    status: "planned",
    actionId: action.id,
    generatedAt: action.updatedAt,
  };
}

export function buildFineTuneAdapterLifecycleSummary(input: {
  jobs: AgentFineTuneJob[];
  recipes: AgentFineTuneRecipe[];
  adapters: AgentFineTuneAdapterArtifact[];
  operations: AgentFineTuneOperation[];
}): AgentFineTuneAdapterLifecycleSummary {
  const { jobs, recipes, adapters, operations } = input;
  const actionStore = readLifecycleStore();
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const completedExports = operations.filter(
    (operation) =>
      operation.kind === "export-adapter" && operation.status === "completed",
  );
  const exportsByAdapterId = new Map<string, AgentFineTuneOperation[]>();
  completedExports.forEach((operation) => {
    if (!operation.adapterId) return;
    const current = exportsByAdapterId.get(operation.adapterId) || [];
    current.push(operation);
    exportsByAdapterId.set(operation.adapterId, current);
  });
  const actionPlansByAdapterId = new Map<
    string,
    AgentFineTuneAdapterLifecycleAction[]
  >();
  actionStore.actions.forEach((action) => {
    if (action.kind !== "export-plan") return;
    const current = actionPlansByAdapterId.get(action.adapterId) || [];
    current.push(action);
    actionPlansByAdapterId.set(action.adapterId, current);
  });
  const adaptersByGroup = new Map<string, AgentFineTuneAdapterArtifact[]>();
  adapters.forEach((adapter) => {
    const group = lifecycleVariantGroup(adapter);
    const current = adaptersByGroup.get(group) || [];
    current.push(adapter);
    adaptersByGroup.set(group, current);
  });
  adaptersByGroup.forEach((groupAdapters, group) => {
    adaptersByGroup.set(
      group,
      groupAdapters.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    );
  });

  const exportPlans: AgentFineTuneAdapterExportPlan[] = [];
  const variants: AgentFineTuneAdapterLifecycleVariant[] = adapters.map(
    (adapter) => {
      const job = jobById.get(adapter.jobId);
      const recipe = job ? recipeById.get(job.recipeId) : undefined;
      const operationExports = exportsByAdapterId.get(adapter.id) || [];
      operationExports.forEach((operation) => {
        exportPlans.push(exportOperationPlan(operation, adapter));
      });
      (actionPlansByAdapterId.get(adapter.id) || []).forEach((action) => {
        const plan = lifecycleActionPlan(action, adapter);
        if (plan) exportPlans.push(plan);
      });
      DEFAULT_EXPORT_PLANS.forEach((plan) => {
        const alreadyCovered = exportPlans.some(
          (entry) =>
            entry.adapterId === adapter.id &&
            entry.exportFormat === plan.exportFormat &&
            entry.quantization === plan.quantization,
        );
        if (!alreadyCovered && adapter.status === "ready") {
          exportPlans.push({
            id: `suggested:${adapter.id}:${plan.exportFormat}:${plan.quantization}`,
            adapterId: adapter.id,
            adapterName: adapter.adapterName,
            exportFormat: plan.exportFormat,
            quantization: plan.quantization,
            status: "planned",
            generatedAt: adapter.updatedAt,
          });
        }
      });

      const group = lifecycleVariantGroup(adapter);
      const groupAdapters = adaptersByGroup.get(group) || [];
      const index = groupAdapters.findIndex((entry) => entry.id === adapter.id);
      const previous = index > 0 ? groupAdapters[index - 1] : undefined;
      const previousExportCount = previous
        ? (exportsByAdapterId.get(previous.id) || []).length
        : 0;

      return {
        id: `variant:${adapter.id}`,
        adapterId: adapter.id,
        adapterName: adapter.adapterName,
        jobId: adapter.jobId,
        recipeId: job?.recipeId,
        datasetId: job?.datasetId,
        baseTargetId: adapter.baseTargetId,
        baseTargetLabel: adapter.baseTargetLabel,
        status: adapter.status,
        bestCheckpoint: adapter.bestCheckpoint,
        checkpointCount: adapter.checkpointCount,
        exportOperationIds: operationExports.map((operation) => operation.id),
        attachedTargetId: adapter.attachedTargetId,
        variantGroup: group,
        diff: buildVariantDiff({
          adapter,
          previous,
          exportCount: operationExports.length,
          previousExportCount,
        }),
        updatedAt: adapter.updatedAt,
      };
    },
  );

  const rollbackProofs = actionStore.actions.filter(
    (action) => action.kind === "rollback-proof",
  );
  return {
    generatedAt: new Date().toISOString(),
    registryPath: ADAPTER_LIFECYCLE_FILE,
    totals: {
      variants: variants.length,
      readyVariants: variants.filter((variant) => variant.status === "ready")
        .length,
      variantDiffs: variants.filter(
        (variant) => variant.diff.conclusion !== "insufficient-data",
      ).length,
      exportPlans: exportPlans.length,
      completedExports: exportPlans.filter((plan) => plan.status === "completed")
        .length,
      plannedExports: exportPlans.filter((plan) => plan.status === "planned")
        .length,
      rollbackProofs: rollbackProofs.filter(
        (proof) => proof.status === "completed",
      ).length,
      lifecycleActions: actionStore.actions.length,
    },
    variants: variants.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    exportPlans: exportPlans.sort((a, b) =>
      b.generatedAt.localeCompare(a.generatedAt),
    ),
    rollbackProofs,
    actions: actionStore.actions,
  };
}

function resolveLifecycleAdapter(adapterId: string) {
  const recipes = readRecipes();
  const jobs = readJobs();
  const operations = readOperations();
  const adapters = buildFineTuneAdapterArtifacts(
    jobs,
    recipes,
    listFineTuneTargetOptions(),
  );
  const lifecycle = buildFineTuneAdapterLifecycleSummary({
    jobs,
    recipes,
    adapters,
    operations,
  });
  const adapter = adapters.find((entry) => entry.id === adapterId);
  if (!adapter) throw new Error("Fine-tune adapter not found.");
  return { lifecycle, adapter };
}

export function recordFineTuneAdapterExportPlan(input: {
  adapterId: string;
  exportFormat?: string;
  quantization?: string;
}) {
  const { adapter } = resolveLifecycleAdapter(input.adapterId);
  const exportFormat =
    input.exportFormat === "merged-mlx" || input.exportFormat === "gguf"
      ? input.exportFormat
      : "adapter-bundle";
  const quantization =
    input.quantization === "q8" || input.quantization === "q4"
      ? input.quantization
      : "none";
  const action = saveLifecycleAction({
    kind: "export-plan",
    status: "planned",
    adapterId: adapter.id,
    adapterName: adapter.adapterName,
    summary: `Planned ${exportFormat} export with ${quantization} quantization.`,
    metadata: {
      exportFormat,
      quantization,
    },
  });
  return { action, lifecycle: resolveLifecycleAdapter(input.adapterId).lifecycle };
}

export async function runFineTuneAdapterRollbackProof(input: {
  adapterId: string;
}) {
  const { adapter } = resolveLifecycleAdapter(input.adapterId);
  const startedAt = new Date().toISOString();
  const wasAttached = Boolean(adapter.attachedTargetId);
  try {
    let detachedReleasedRuntime = false;
    let finalAttachedAlias: string | null = null;
    if (wasAttached) {
      const detached = await detachFineTuneAdapterRuntime({
        adapterId: adapter.id,
      });
      detachedReleasedRuntime = Boolean(detached.releasedRuntime);
      const restored = attachFineTuneAdapterRuntime({ adapterId: adapter.id });
      finalAttachedAlias = restored.attachment.alias;
    } else {
      const attached = attachFineTuneAdapterRuntime({ adapterId: adapter.id });
      finalAttachedAlias = attached.attachment.alias;
      const detached = await detachFineTuneAdapterRuntime({
        adapterId: adapter.id,
      });
      detachedReleasedRuntime = Boolean(detached.releasedRuntime);
      finalAttachedAlias = null;
    }
    const action = saveLifecycleAction({
      kind: "rollback-proof",
      status: "completed",
      adapterId: adapter.id,
      adapterName: adapter.adapterName,
      summary: wasAttached
        ? "Rollback proof detached the adapter and restored the previous attachment."
        : "Rollback proof attached the adapter, then rolled back to a detached state.",
      createdAt: startedAt,
      metadata: {
        wasAttached,
        detachedReleasedRuntime,
        finalAttachedAlias,
      },
    });
    return { action, lifecycle: resolveLifecycleAdapter(input.adapterId).lifecycle };
  } catch (error) {
    const action = saveLifecycleAction({
      kind: "rollback-proof",
      status: "failed",
      adapterId: adapter.id,
      adapterName: adapter.adapterName,
      summary:
        error instanceof Error
          ? error.message
          : "Rollback proof failed for an unknown reason.",
      createdAt: startedAt,
    });
    return { action, lifecycle: resolveLifecycleAdapter(input.adapterId).lifecycle };
  }
}
