import { createHash } from "node:crypto";

import {
  readJsonFileDurably,
  replaceJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION =
  "competitive.official-source-registry.v1" as const;

export type CompetitiveSourceStability =
  | "stable"
  | "preview"
  | "mixed"
  | "deprecated";

export type CompetitiveSourceRecord = {
  id: string;
  owner: string;
  category: "product" | "provider-model" | "agent" | "training";
  url: string;
  reviewedAt: string;
  stability: CompetitiveSourceStability;
  claims: string[];
  modelIds: string[];
  contentDigest: string;
  fetchedAt: string | null;
  lastHttpStatus: number | null;
  lastFetchError: string | null;
};

export type CompetitiveSourceDecision = {
  sourceId: string;
  detectedAt: string;
  previousDigest: string;
  observedDigest: string;
  decision: "no-material-change" | "review-required" | "fetch-failed";
  reason: string;
};

type CompetitiveSourceStore = {
  schemaVersion: typeof COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION;
  records: CompetitiveSourceRecord[];
  decisions: CompetitiveSourceDecision[];
};

const STORE_PATH = getLocalAgentDataPath(
  "competitive",
  "official-source-registry.json",
);
const REVIEWED_AT = "2026-08-31T00:00:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function source(input: Omit<CompetitiveSourceRecord, "contentDigest" | "fetchedAt" | "lastHttpStatus" | "lastFetchError">): CompetitiveSourceRecord {
  return {
    ...input,
    contentDigest: digest({
      url: input.url,
      reviewedAt: input.reviewedAt,
      stability: input.stability,
      claims: input.claims,
      modelIds: input.modelIds,
    }),
    fetchedAt: null,
    lastHttpStatus: null,
    lastFetchError: null,
  };
}

const BUILTIN_SOURCES: CompetitiveSourceRecord[] = [
  source({ id: "lm-studio-runtime", owner: "LM Studio", category: "product", url: "https://lmstudio.ai/docs/app/basics/lmstudio-vs-llmster-vs-lms", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["desktop and headless local runtime", "model load, unload, idle TTL, parallel requests and remote devices"], modelIds: [] }),
  source({ id: "ollama-runtime", owner: "Ollama", category: "product", url: "https://docs.ollama.com/", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["local model lifecycle and API", "tool calling and structured output"], modelIds: [] }),
  source({ id: "open-webui", owner: "Open WebUI", category: "product", url: "https://docs.openwebui.com/features/", reviewedAt: REVIEWED_AT, stability: "mixed", claims: ["team workspace, hybrid RAG, tools, MCP and evaluation"], modelIds: [] }),
  source({ id: "jan", owner: "Jan", category: "product", url: "https://www.jan.ai/docs", reviewedAt: REVIEWED_AT, stability: "mixed", claims: ["desktop local runtime, API server, projects, Agent and MCP"], modelIds: [] }),
  source({ id: "anythingllm", owner: "AnythingLLM", category: "product", url: "https://docs.anythingllm.com/", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["workspace RAG, agents, flows, skills and scheduled jobs"], modelIds: [] }),
  source({ id: "dify", owner: "Dify", category: "product", url: "https://docs.dify.ai/en/develop-plugin/getting-started/choose-plugin-type", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["visual AI applications, workflows, agents, knowledge and plugins"], modelIds: [] }),
  source({ id: "cherry-studio", owner: "Cherry Studio", category: "product", url: "https://docs.cherry-ai.com/en-us/knowledge-base/knowledge-base-tutorial", reviewedAt: REVIEWED_AT, stability: "mixed", claims: ["multi-provider desktop workspace and citation-aware knowledge bases"], modelIds: [] }),
  source({ id: "localai", owner: "LocalAI", category: "product", url: "https://localai.io/", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["multi-backend private runtime, workers, agents, MCP and RAG"], modelIds: [] }),
  source({ id: "llama-factory", owner: "LLaMA-Factory", category: "training", url: "https://llamafactory.readthedocs.io/en/latest/getting_started/webui.html", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["LoRA, QLoRA, preference training, evaluation and export"], modelIds: [] }),
  source({ id: "modelscope-swift", owner: "ModelScope SWIFT", category: "training", url: "https://swift.readthedocs.io/en/v3.7/Instruction/Evaluation.html", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["multi-backend training and multimodal evaluator adapters"], modelIds: [] }),
  source({ id: "openai-models", owner: "OpenAI", category: "provider-model", url: "https://developers.openai.com/api/docs/models", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["flagship, balanced and high-volume GPT-5.6 tiers", "Responses and tool support"], modelIds: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] }),
  source({ id: "anthropic-models", owner: "Anthropic", category: "provider-model", url: "https://platform.claude.com/docs/en/models/overview", reviewedAt: REVIEWED_AT, stability: "mixed", claims: ["Fable, Opus and Sonnet model tiers", "vision, tool use and adaptive thinking"], modelIds: ["claude-fable-5", "claude-opus-5", "claude-sonnet-5"] }),
  source({ id: "gemini-models", owner: "Google", category: "provider-model", url: "https://ai.google.dev/gemini-api/docs/models", reviewedAt: REVIEWED_AT, stability: "mixed", claims: ["stable and preview Gemini models", "native multimodal and managed Agent support"], modelIds: ["gemini-3.7-flash", "gemini-3.1-pro-preview"] }),
  source({ id: "deepseek-models", owner: "DeepSeek", category: "provider-model", url: "https://api-docs.deepseek.com/quick_start/pricing", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["V4 Pro and V4 Flash", "thinking, tools and structured output"], modelIds: ["deepseek-v4-pro", "deepseek-v4-flash"] }),
  source({ id: "minimax-models", owner: "MiniMax", category: "provider-model", url: "https://platform.minimax.io/docs/guides/models-intro", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["M2.7 standard and high-speed text routes"], modelIds: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"] }),
  source({ id: "kimi-models", owner: "Kimi", category: "provider-model", url: "https://platform.kimi.com/docs/models", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["K2.6 native multimodal and Agent tasks"], modelIds: ["kimi-k2.6"] }),
  source({ id: "glm-models", owner: "Zhipu GLM", category: "provider-model", url: "https://docs.bigmodel.cn/cn/guide/models/text/glm-5.2", reviewedAt: REVIEWED_AT, stability: "stable", claims: ["GLM-5.2 long-context Agentic Engineering"], modelIds: ["glm-5.2"] }),
  source({ id: "qwen-agent", owner: "Qwen", category: "agent", url: "https://qwenlm.github.io/qwen-code-docs/en/blog/updates/weekly-update-2026-06-18/", reviewedAt: REVIEWED_AT, stability: "preview", claims: ["Agent Team parallel collaboration and durable loops"], modelIds: ["qwen3-coder"] }),
];

function initialStore(): CompetitiveSourceStore {
  return {
    schemaVersion: COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION,
    records: BUILTIN_SOURCES,
    decisions: [],
  };
}

function validStore(value: unknown): value is CompetitiveSourceStore {
  const candidate = value as CompetitiveSourceStore;
  return Boolean(
    candidate &&
      candidate.schemaVersion === COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION &&
      Array.isArray(candidate.records) &&
      Array.isArray(candidate.decisions),
  );
}

function readStore() {
  const stored = readJsonFileDurably(STORE_PATH, initialStore, validStore);
  const byId = new Map(stored.records.map((entry) => [entry.id, entry]));
  for (const builtin of BUILTIN_SOURCES) {
    if (!byId.has(builtin.id)) byId.set(builtin.id, builtin);
  }
  return { ...stored, records: [...byId.values()] };
}

function freshness(record: CompetitiveSourceRecord, now: number) {
  const reviewedAt = Date.parse(record.reviewedAt);
  const ageDays = Number.isFinite(reviewedAt)
    ? Math.max(0, Math.floor((now - reviewedAt) / DAY_MS))
    : Number.POSITIVE_INFINITY;
  return { ageDays, fresh: ageDays <= 14 };
}

export function readCompetitiveSourceRegistry(options?: { now?: number }) {
  const now = options?.now ?? Date.now();
  const store = readStore();
  const records = store.records.map((record) => ({ ...record, freshness: freshness(record, now) }));
  return {
    ok: true as const,
    schemaVersion: COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    records,
    decisions: store.decisions,
    totals: {
      sources: records.length,
      fresh: records.filter((record) => record.freshness.fresh).length,
      stale: records.filter((record) => !record.freshness.fresh).length,
      providerModels: records.filter((record) => record.category === "provider-model").length,
      reviewRequired: store.decisions.filter((entry) => entry.decision === "review-required").length,
    },
    policy: {
      maxAgeDays: 14,
      firstPartyOnly: true,
      vendorBenchmarksAreProductEvidence: false,
      contentChangeAutoUpdatesClaims: false,
    },
    path: STORE_PATH,
  };
}

export async function refreshCompetitiveSourceRegistry(input?: {
  sourceIds?: string[];
  fetchImpl?: typeof fetch;
  now?: number;
}) {
  const fetchImpl = input?.fetchImpl || fetch;
  const now = input?.now ?? Date.now();
  const selectedIds = new Set(input?.sourceIds || []);
  const store = readStore();
  const decisions: CompetitiveSourceDecision[] = [];
  const records: CompetitiveSourceRecord[] = [];

  for (const record of store.records) {
    if (selectedIds.size && !selectedIds.has(record.id)) {
      records.push(record);
      continue;
    }
    try {
      const response = await fetchImpl(record.url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`official source returned ${response.status}`);
      const observedDigest = createHash("sha256").update(await response.text()).digest("hex");
      const changed = Boolean(record.fetchedAt && record.contentDigest !== observedDigest);
      records.push({
        ...record,
        contentDigest: observedDigest,
        fetchedAt: new Date(now).toISOString(),
        lastHttpStatus: response.status,
        lastFetchError: null,
      });
      decisions.push({
        sourceId: record.id,
        detectedAt: new Date(now).toISOString(),
        previousDigest: record.contentDigest,
        observedDigest,
        decision: changed ? "review-required" : "no-material-change",
        reason: changed
          ? "Official content digest changed. Claims and roadmap remain frozen pending review."
          : "No previously fetched content change requires product review.",
      });
    } catch (error) {
      records.push({
        ...record,
        fetchedAt: new Date(now).toISOString(),
        lastHttpStatus: null,
        lastFetchError: error instanceof Error ? error.message : String(error),
      });
      decisions.push({
        sourceId: record.id,
        detectedAt: new Date(now).toISOString(),
        previousDigest: record.contentDigest,
        observedDigest: record.contentDigest,
        decision: "fetch-failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  replaceJsonFileDurably(
    STORE_PATH,
    {
      schemaVersion: COMPETITIVE_SOURCE_REGISTRY_SCHEMA_VERSION,
      records,
      decisions: [...decisions, ...store.decisions].slice(0, 200),
    },
    validStore,
  );
  return readCompetitiveSourceRegistry({ now });
}
