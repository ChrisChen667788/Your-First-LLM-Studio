import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  discoverOllamaModels,
  normalizeOllamaError,
  requestOllama,
  runOllamaRuntimeAction,
} from "@/features/runtime/ollama-adapter";

export const OLLAMA_CONFORMANCE_SCHEMA_VERSION = "runtime.ollama-conformance.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const REPORT_FILE = path.join(DATA_DIR, "ollama-conformance-reports.json");

type OllamaConformanceReport = {
  schemaVersion: typeof OLLAMA_CONFORMANCE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  model: string;
  ok: boolean;
  checks: Record<string, boolean>;
  metrics: Record<string, number | null>;
  responsePreview: string;
  error: { code: string; message: string } | null;
};

function readReports(): OllamaConformanceReport[] {
  if (!existsSync(REPORT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(REPORT_FILE, "utf8")) as { reports?: OllamaConformanceReport[] };
    return Array.isArray(parsed.reports) ? parsed.reports : [];
  } catch {
    return [];
  }
}

function persist(report: OllamaConformanceReport) {
  mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, `${JSON.stringify({ schemaVersion: OLLAMA_CONFORMANCE_SCHEMA_VERSION, reports: [report, ...readReports()].slice(0, 50) }, null, 2)}\n`, "utf8");
}

export function readOllamaConformanceEvidence() {
  const reports = readReports();
  return {
    ok: true as const,
    schemaVersion: OLLAMA_CONFORMANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    reports,
    latestPassing: reports.find((report) => report.ok) || null,
    path: REPORT_FILE,
  };
}

export async function runOllamaModelConformance(modelInput?: string) {
  const model = modelInput?.trim() || "qwen3:0.6b";
  const checks = { reachable: false, discovered: false, prewarmed: false, generated: false, unloaded: false };
  const metrics: Record<string, number | null> = {
    totalDurationMs: null,
    loadDurationMs: null,
    promptTokens: null,
    generatedTokens: null,
    tokensPerSecond: null,
  };
  let responsePreview = "";
  let error: { code: string; message: string } | null = null;
  const started = Date.now();
  try {
    const discovery = await discoverOllamaModels();
    checks.reachable = discovery.available;
    checks.discovered = discovery.models.some((candidate) => candidate.name === model || candidate.model === model);
    if (!checks.discovered) throw new Error(`Ollama model ${model} is not installed.`);
    const prewarm = await runOllamaRuntimeAction({ action: "prewarm", model, keepAlive: "5m" });
    checks.prewarmed = prewarm.ok;
    if (!prewarm.ok) throw new Error(prewarm.error.message);
    const result = await requestOllama<{
      response?: string;
      thinking?: string;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_count?: number;
      eval_count?: number;
      eval_duration?: number;
    }>("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt: "Reply with exactly OLLAMA_OK and no other text.",
        think: false,
        stream: false,
        keep_alive: "5m",
        options: { temperature: 0, seed: 7, num_predict: 64 },
      }),
    }, 180_000);
    responsePreview = (result.response || result.thinking || "").trim().slice(0, 500);
    checks.generated = responsePreview.length > 0;
    metrics.totalDurationMs = typeof result.total_duration === "number" ? result.total_duration / 1_000_000 : Date.now() - started;
    metrics.loadDurationMs = typeof result.load_duration === "number" ? result.load_duration / 1_000_000 : null;
    metrics.promptTokens = result.prompt_eval_count ?? null;
    metrics.generatedTokens = result.eval_count ?? null;
    metrics.tokensPerSecond = result.eval_count && result.eval_duration
      ? result.eval_count / (result.eval_duration / 1_000_000_000)
      : null;
    const unload = await runOllamaRuntimeAction({ action: "unload", model });
    checks.unloaded = unload.ok;
  } catch (caught) {
    error = normalizeOllamaError(caught);
  }
  const report: OllamaConformanceReport = {
    schemaVersion: OLLAMA_CONFORMANCE_SCHEMA_VERSION,
    id: `ollama-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    model,
    ok: Object.values(checks).every(Boolean),
    checks,
    metrics,
    responsePreview,
    error,
  };
  persist(report);
  return report;
}
