import type {
  AgentBenchmarkMediaAsset,
  AgentBenchmarkModality,
  AgentTarget,
} from "@/lib/agent/types";

export const BENCHMARK_CAPABILITY_SCHEMA_VERSION =
  "benchmark.model-capability.v1" as const;

export type BenchmarkTargetCapability = {
  schemaVersion: typeof BENCHMARK_CAPABILITY_SCHEMA_VERSION;
  targetId: string;
  targetLabel: string;
  evidenceStatus: "verified" | "runtime-limited" | "unverified";
  officialDocsUrl?: string;
  reviewedAt: string;
  modelModalities: AgentBenchmarkModality[];
  transportModalities: AgentBenchmarkModality[];
  effectiveModalities: AgentBenchmarkModality[];
  reason: string;
};

export type BenchmarkModalityAssessment = {
  supported: boolean;
  modality: AgentBenchmarkModality;
  capability: BenchmarkTargetCapability;
  reason: string;
  officialDocsUrl?: string;
};

const REVIEWED_AT = "2026-08-07";

const PROVIDER_DOCS: Record<string, string> = {
  "openai-codex": "https://platform.openai.com/docs/models",
  "openai-gpt54": "https://platform.openai.com/docs/models",
  "anthropic-claude":
    "https://docs.anthropic.com/en/docs/about-claude/models/overview",
  "deepseek-api": "https://api-docs.deepseek.com/quick_start/pricing",
  "kimi-api": "https://platform.moonshot.cn/docs/intro",
  "glm-api": "https://docs.bigmodel.cn/cn/guide/models/text/glm-4.5",
  "qwen-api":
    "https://help.aliyun.com/zh/model-studio/getting-started/models",
};

function uniqueModalities(values: AgentBenchmarkModality[]) {
  return [...new Set(values)];
}

export function getBenchmarkTargetCapability(
  target: AgentTarget,
): BenchmarkTargetCapability {
  if (target.id === "minimax-m3" || /minimax-m3/i.test(target.modelDefault)) {
    return {
      schemaVersion: BENCHMARK_CAPABILITY_SCHEMA_VERSION,
      targetId: target.id,
      targetLabel: target.label,
      evidenceStatus: "verified",
      officialDocsUrl:
        "https://platform.minimaxi.com/docs/api-reference/text-chat-openai",
      reviewedAt: REVIEWED_AT,
      modelModalities: ["text", "image", "video"],
      transportModalities: ["text", "image", "video"],
      effectiveModalities: ["text", "image", "video"],
      reason:
        "MiniMax M3 official OpenAI-compatible documentation declares native text, image, and video message content.",
    };
  }

  if (target.execution === "local") {
    const modelModalities: AgentBenchmarkModality[] = /gemma[-_. ]?3/i.test(
      `${target.id} ${target.modelDefault} ${target.sourceRepoId || ""}`,
    )
      ? ["text", "image"]
      : ["text"];
    return {
      schemaVersion: BENCHMARK_CAPABILITY_SCHEMA_VERSION,
      targetId: target.id,
      targetLabel: target.label,
      evidenceStatus:
        modelModalities.length > 1 ? "runtime-limited" : "verified",
      officialDocsUrl: target.sourceRepoId
        ? `https://huggingface.co/${target.sourceRepoId}`
        : undefined,
      reviewedAt: REVIEWED_AT,
      modelModalities,
      transportModalities: ["text"],
      effectiveModalities: ["text"],
      reason:
        modelModalities.length > 1
          ? "The base model may accept images, but the current local MLX gateway benchmark adapter is text-only."
          : "The current local model and MLX benchmark transport are registered as text-only.",
    };
  }

  return {
    schemaVersion: BENCHMARK_CAPABILITY_SCHEMA_VERSION,
    targetId: target.id,
    targetLabel: target.label,
    evidenceStatus: "unverified",
    officialDocsUrl: PROVIDER_DOCS[target.id],
    reviewedAt: REVIEWED_AT,
    modelModalities: ["text"],
    transportModalities: ["text", "image", "video"],
    effectiveModalities: ["text"],
    reason:
      "This configured model id has not passed a model-specific native multimodal contract check, so non-text tasks fail closed.",
  };
}

export function assessBenchmarkTargetModality(
  target: AgentTarget,
  modality: AgentBenchmarkModality,
): BenchmarkModalityAssessment {
  const capability = getBenchmarkTargetCapability(target);
  const supported = capability.effectiveModalities.includes(modality);
  return {
    supported,
    modality,
    capability,
    officialDocsUrl: capability.officialDocsUrl,
    reason: supported
      ? `${target.label} is verified for ${modality} benchmark input.`
      : `${target.label} cannot run ${modality} input: ${capability.reason}`,
  };
}

export function assessBenchmarkTargetModalities(
  target: AgentTarget,
  modalities: AgentBenchmarkModality[],
) {
  return uniqueModalities(modalities).map((modality) =>
    assessBenchmarkTargetModality(target, modality),
  );
}

export function validateBenchmarkMediaAssets(
  media: AgentBenchmarkMediaAsset[] | undefined,
): { media: AgentBenchmarkMediaAsset[] } | { error: string } {
  if (!media?.length) return { media: [] };
  if (media.length > 4) {
    return { error: "A benchmark task can attach at most four media assets." };
  }

  const normalized: AgentBenchmarkMediaAsset[] = [];
  for (const asset of media) {
    if (!asset || !["image", "video", "audio", "document"].includes(asset.type)) {
      return {
        error: "Benchmark media type must be image, video, audio, or document.",
      };
    }
    const url = typeof asset.url === "string" ? asset.url.trim() : "";
    if (!url) return { error: `A ${asset.type} media URL is required.` };
    const isDataUrl = /^data:(?:image|video)\//i.test(url);
    let isRemoteUrl = false;
    try {
      const parsed = new URL(url);
      isRemoteUrl = parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      isRemoteUrl = false;
    }
    if (!isDataUrl && !isRemoteUrl) {
      return {
        error:
          "Benchmark media must use an HTTP(S) URL or an image/video data URL; local file paths are not sent to remote providers.",
      };
    }
    normalized.push({
      ...asset,
      url,
      detail: asset.detail || "auto",
      ...(typeof asset.fps === "number"
        ? { fps: Math.max(0.1, Math.min(asset.fps, 8)) }
        : {}),
      ...(typeof asset.maxLongSidePixel === "number"
        ? {
            maxLongSidePixel: Math.max(
              256,
              Math.min(Math.trunc(asset.maxLongSidePixel), 4096),
            ),
          }
        : {}),
    });
  }
  return { media: normalized };
}
