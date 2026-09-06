import { createHash } from "node:crypto";

import type { EvidenceCollectionJob } from "@/features/evidence/collection-contracts";
import { OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION, operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { resolveProviderCapabilityRoute } from "@/lib/agent/provider-capabilities";
import {
  buildOpenAICompatibleRequestShape,
  buildOpenAICompatibleTokenLimit,
  resolveTargetWithMode,
} from "@/lib/agent/providers";
import type { ResolvedTarget } from "@/lib/agent/types";

const COHORT_SIZE = 20;
const REQUEST_TIMEOUT_MS = 45_000;

type SampleResult = {
  index: number;
  targetId: string;
  model: string;
  ok: boolean;
  scored: boolean;
  status: number | null;
  latencyMs: number;
  outputDigest: string | null;
  errorClass: string | null;
};

function samplePrompt(index: number) {
  const token = `FIRST_LLM_ROUTING_${String(index + 1).padStart(2, "0")}`;
  return {
    token,
    input: `Reply with exactly this token and no other text: ${token}`,
  };
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (!part || typeof part !== "object") return "";
    const item = part as { type?: unknown; text?: unknown };
    return item.type === "text" && typeof item.text === "string" ? item.text : "";
  }).join("\n");
}

async function runSample(
  target: ResolvedTarget,
  index: number,
  fetchImpl: typeof fetch,
): Promise<SampleResult> {
  const prompt = samplePrompt(index);
  const shape = buildOpenAICompatibleRequestShape({ target, input: prompt.input, enableTools: false, thinkingMode: "standard" });
  const body = {
    model: shape.model,
    messages: [
      { role: "system", content: "Return only the requested token. Do not add punctuation or explanation." },
      { role: "user", content: prompt.input },
    ],
    temperature: 0,
    ...buildOpenAICompatibleTokenLimit(target, 32),
    ...shape.bodyExtras,
  } as Record<string, unknown>;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${target.resolvedBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(target.resolvedApiKey ? { authorization: `Bearer ${target.resolvedApiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const output = contentText(payload?.choices?.[0]?.message?.content).trim();
    return {
      index,
      targetId: target.id,
      model: target.resolvedModel,
      ok: response.ok && Boolean(output),
      scored: response.ok && output === prompt.token,
      status: response.status,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      outputDigest: output ? createHash("sha256").update(output).digest("hex") : null,
      errorClass: response.ok && output ? null : response.ok ? "empty-output" : `http-${response.status}`,
    };
  } catch (error) {
    return {
      index,
      targetId: target.id,
      model: target.resolvedModel,
      ok: false,
      scored: false,
      status: null,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      outputDigest: null,
      errorClass: error instanceof Error && error.name === "AbortError" ? "timeout" : "network-error",
    };
  } finally {
    clearTimeout(timer);
  }
}

function stats(samples: SampleResult[]) {
  const successful = samples.filter((sample) => sample.ok);
  return {
    sampleCount: samples.length,
    successRatePct: Number(((successful.length / Math.max(1, samples.length)) * 100).toFixed(2)),
    qualityScore: Number(((samples.filter((sample) => sample.scored).length / Math.max(1, samples.length)) * 100).toFixed(2)),
    p95LatencyMs: samples.map((sample) => sample.latencyMs).sort((left, right) => left - right)[Math.max(0, Math.ceil(samples.length * 0.95) - 1)] || 0,
  };
}

export async function collectProviderRoutingEvidence(
  job: EvidenceCollectionJob,
  fetchImpl: typeof fetch = fetch,
) {
  const primary = resolveTargetWithMode(job.subjectId, "standard");
  const route = await resolveProviderCapabilityRoute({
    target: primary,
    thinkingMode: "standard",
    fetchImpl,
    freshProbe: true,
  });
  const selected = route.target;
  const fallback = route.fallbackTargets[0];
  if (!route.probed || !fallback) {
    throw new Error("Routing quality collection requires a fresh advertised catalog with at least one distinct fallback model.");
  }
  const startedAt = new Date().toISOString();
  const primarySamples: SampleResult[] = [];
  const fallbackSamples: SampleResult[] = [];
  for (let index = 0; index < COHORT_SIZE; index += 1) {
    primarySamples.push(await runSample(selected, index, fetchImpl));
    fallbackSamples.push(await runSample(fallback, index, fetchImpl));
  }
  const primaryStats = stats(primarySamples);
  const fallbackStats = stats(fallbackSamples);
  const artifact = {
    schemaVersion: "providers.routing-quality-collection-artifact.v1",
    jobId: job.id,
    sourceMilestone: job.sourceMilestone,
    cohort: { revision: "routing-token-cohort.v1", size: COHORT_SIZE, promptDigest: operationalEvidenceDigest(Array.from({ length: COHORT_SIZE }, (_, index) => samplePrompt(index))) },
    selected: { targetId: selected.id, model: selected.resolvedModel, stats: primaryStats },
    fallback: { targetId: fallback.id, model: fallback.resolvedModel, stats: fallbackStats },
    primarySamples,
    fallbackSamples,
    shadow: {
      requests: COHORT_SIZE,
      fallbackReplays: fallbackSamples.filter((sample) => sample.ok).length,
      decisionMatches: primarySamples.filter((sample, index) => sample.ok === fallbackSamples[index]?.ok && sample.scored === fallbackSamples[index]?.scored).length,
    },
    startedAt,
    completedAt: new Date().toISOString(),
  };
  const artifactDigest = operationalEvidenceDigest(artifact);
  const metrics = job.sourceMilestone === "v4.0.2"
    ? {
        shadowRequests: artifact.shadow.requests,
        fallbackReplays: artifact.shadow.fallbackReplays,
        decisionMatches: artifact.shadow.decisionMatches,
      }
    : {
        sampleCount: primaryStats.sampleCount,
        qualityScore: primaryStats.qualityScore,
        successRatePct: primaryStats.successRatePct,
      };
  return {
    artifact,
    artifactDigest,
    receipt: {
      schemaVersion: OPERATIONAL_EVIDENCE_RECEIPT_SCHEMA_VERSION,
      milestone: job.sourceMilestone,
      subjectId: job.subjectId,
      environment: "local" as const,
      workloadDigest: artifact.cohort.promptDigest,
      artifactDigests: [artifactDigest],
      startedAt,
      completedAt: artifact.completedAt,
      outcome: "pass" as const,
      metrics,
      operator: { organizationId: job.organizationId, operatorId: job.operatorId },
    },
  };
}
