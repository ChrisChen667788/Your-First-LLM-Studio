import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { appendServerRequestEntry } from "@/features/models/server-request-ledger";

export const OPENAI_CONFORMANCE_SCHEMA_VERSION = "runtime.openai-compatible-conformance.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REPORT_FILE = path.join(DATA_DIR, "openai-compatible-conformance.json");

type ConformanceReport = { id: string; generatedAt: string; serverId: string; baseUrl: string; model: string; ok: boolean; checks: Record<string, boolean>; metrics: Record<string, number>; error?: string };

function readReports(): ConformanceReport[] {
  if (!existsSync(REPORT_FILE)) return [];
  try { const parsed = JSON.parse(readFileSync(REPORT_FILE, "utf8")) as { reports?: ConformanceReport[] }; return Array.isArray(parsed.reports) ? parsed.reports : []; }
  catch { return []; }
}

function persist(report: ConformanceReport) {
  mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  writeFileSync(REPORT_FILE, `${JSON.stringify({ schemaVersion: OPENAI_CONFORMANCE_SCHEMA_VERSION, reports: [report, ...readReports()].slice(0, 100) }, null, 2)}\n`, "utf8");
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("baseUrl must use http or https.");
  return url.toString().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function readOpenAiCompatibleConformance() {
  const reports = readReports();
  return { ok: true as const, schemaVersion: OPENAI_CONFORMANCE_SCHEMA_VERSION, generatedAt: new Date().toISOString(), reports, latestPassing: reports.find((report) => report.ok) || null, path: REPORT_FILE };
}

export async function runOpenAiCompatibleConformance(input: { serverId?: string; baseUrl?: string; model?: string; apiKey?: string }) {
  const serverId = input.serverId?.trim() || "manual-openai-compatible";
  const baseUrl = normalizeBaseUrl(input.baseUrl?.trim() || "http://127.0.0.1:11434");
  const model = input.model?.trim() || "qwen3:0.6b";
  const headers = { "content-type": "application/json", ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {}) };
  const checks = { modelsEndpoint: false, modelDiscovered: false, chatEndpoint: false, responseNonEmpty: false, usageShape: false };
  const metrics = { modelsLatencyMs: 0, chatLatencyMs: 0, promptTokens: 0, completionTokens: 0 };
  let error: string | undefined;
  try {
    let started = Date.now();
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    metrics.modelsLatencyMs = Date.now() - started;
    const modelsPayload = await modelsResponse.json() as { data?: Array<{ id?: string }> };
    checks.modelsEndpoint = modelsResponse.ok && Array.isArray(modelsPayload.data);
    checks.modelDiscovered = Boolean(modelsPayload.data?.some((entry) => entry.id === model));
    appendServerRequestEntry({ serverId, modelId: model, operation: "models", status: modelsResponse.ok ? "success" : "error", statusCode: modelsResponse.status, latencyMs: metrics.modelsLatencyMs, promptTokens: 0, completionTokens: 0 });
    started = Date.now();
    const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model, messages: [{ role: "user", content: "/no_think\nReply with exactly CONFORMANCE_OK." }], temperature: 0, max_tokens: 256, stream: false }), cache: "no-store", signal: AbortSignal.timeout(120_000) });
    metrics.chatLatencyMs = Date.now() - started;
    const chatPayload = await chatResponse.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number }; error?: { message?: string } };
    checks.chatEndpoint = chatResponse.ok && Array.isArray(chatPayload.choices);
    checks.responseNonEmpty = Boolean(chatPayload.choices?.[0]?.message?.content?.trim());
    metrics.promptTokens = chatPayload.usage?.prompt_tokens || 0;
    metrics.completionTokens = chatPayload.usage?.completion_tokens || 0;
    checks.usageShape = metrics.promptTokens >= 0 && metrics.completionTokens > 0;
    appendServerRequestEntry({ serverId, modelId: model, operation: "chat", status: chatResponse.ok ? "success" : "error", statusCode: chatResponse.status, latencyMs: metrics.chatLatencyMs, promptTokens: metrics.promptTokens, completionTokens: metrics.completionTokens, errorCode: chatResponse.ok ? undefined : "upstream_error" });
    if (!chatResponse.ok) error = chatPayload.error?.message || `Chat endpoint returned HTTP ${chatResponse.status}.`;
  } catch (caught) { error = caught instanceof Error ? caught.message : "Conformance request failed."; }
  const report: ConformanceReport = { id: `openai-${Date.now()}`, generatedAt: new Date().toISOString(), serverId, baseUrl, model, ok: Object.values(checks).every(Boolean), checks, metrics, error };
  persist(report);
  return report;
}
