import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetValidation,
  AgentFineTuneOperation,
  AgentFineTuneReportExport,
  AgentFineTuneSourceSurface,
  AgentFineTuneSummary,
  AgentTarget,
} from "@/lib/agent/types";

export type FineTuneActionRequest = Record<string, unknown> & {
  sourceSurface?: AgentFineTuneSourceSurface;
};

export type FineTuneActionResponse = {
  ok?: boolean;
  error?: string;
  summary?: AgentFineTuneSummary;
  dataset?: AgentFineTuneDataset;
  validation?: AgentFineTuneDatasetValidation;
  targets?: AgentTarget[];
  attached?: {
    target?: {
      id: string;
      label: string;
    };
  };
  detached?: {
    attachment?: {
      alias: string;
      label: string;
    };
    releasedRuntime?: boolean;
    releasedAlias?: string | null;
  };
  opened?: {
    opened: boolean;
    path?: string;
    sourceUrl?: string;
  };
  report?: AgentFineTuneReportExport;
  operation?: AgentFineTuneOperation;
};

export function normalizeFineTuneSummary(
  summary: AgentFineTuneSummary | null | undefined,
): AgentFineTuneSummary | undefined {
  if (!summary || typeof summary !== "object") return undefined;
  const input = summary as Partial<AgentFineTuneSummary>;

  return {
    generatedAt:
      typeof input.generatedAt === "string"
        ? input.generatedAt
        : new Date().toISOString(),
    dataDir: typeof input.dataDir === "string" ? input.dataDir : "",
    localTargets: Array.isArray(input.localTargets) ? input.localTargets : [],
    datasets: Array.isArray(input.datasets) ? input.datasets : [],
    recipes: Array.isArray(input.recipes) ? input.recipes : [],
    jobs: Array.isArray(input.jobs) ? input.jobs : [],
    adapters: Array.isArray(input.adapters) ? input.adapters : [],
    operations: Array.isArray(input.operations) ? input.operations : [],
  };
}

export function normalizeFineTuneActionResponse(
  payload: FineTuneActionResponse,
): FineTuneActionResponse {
  return {
    ...payload,
    summary: normalizeFineTuneSummary(payload.summary),
  };
}

export async function postFineTuneAction(
  input: FineTuneActionRequest,
): Promise<FineTuneActionResponse> {
  const response = await fetch("/api/finetune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as FineTuneActionResponse;
  if (!response.ok) {
    throw new Error(payload.error || "Fine-tune request failed.");
  }
  return normalizeFineTuneActionResponse(payload);
}
