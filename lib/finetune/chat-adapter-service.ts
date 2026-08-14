import crypto from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import { buildFineTuneOperationEventReferences } from "@/features/finetune/experiment-references";
import {
  artifactFor,
  getOperationPaths,
  saveFineTuneOperation,
} from "./repository";
import { truncatePreview } from "./store-internal";
import { resolveFineTuneAdapter } from "./operation-shared";
import { runFineTuneAdapterInference } from "./inference-service";

export async function runFineTuneAdapterChat(input: {
  adapterId: string;
  role?: string;
  systemPrompt?: string;
  prompt: string;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
  skipSpecialTokens?: boolean;
  renderHtmlTags?: boolean;
}) {
  const { adapter } = resolveFineTuneAdapter(input.adapterId);
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Chat prompt is required.");
  }
  const id = `ft-op-chat-${crypto.randomUUID()}`;
  const paths = getOperationPaths("chat-adapter", id);
  mkdirSync(paths.outputDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const inference = await runFineTuneAdapterInference({
    adapterId: adapter.id,
    prompt,
    options: {
      systemPrompt: input.systemPrompt,
      maxNewTokens: input.maxNewTokens,
      temperature: input.temperature,
      topP: input.topP,
    },
  });
  const response = inference.content.trim();
  if (!response) throw new Error("Attached adapter returned an empty response.");
  const transcript = {
    generatedAt,
    adapter,
    generation: {
      maxNewTokens: Math.max(16, Math.min(input.maxNewTokens || 512, 4096)),
      temperature: Math.max(0, Math.min(input.temperature ?? 0.7, 2)),
      topP: Math.max(0.01, Math.min(input.topP ?? 0.9, 1)),
      skipSpecialTokens: Boolean(input.skipSpecialTokens),
      renderHtmlTags: Boolean(input.renderHtmlTags),
    },
    messages: [
      input.systemPrompt?.trim()
        ? { role: "system", content: input.systemPrompt.trim() }
        : null,
      { role: input.role?.trim() || "user", content: prompt },
      { role: "assistant", content: response },
    ].filter(Boolean),
    provider: {
      targetId: adapter.attachedTargetId,
      resolvedModel: inference.resolvedModel,
      usage: inference.usage || null,
      warning: inference.warning || null,
    },
  };
  writeFileSync(
    paths.transcriptFile,
    JSON.stringify(transcript, null, 2),
    "utf8",
  );
  writeFileSync(
    paths.reportFile,
    [
      `# Adapter Chat: ${adapter.adapterName}`,
      "",
      `Generated: ${generatedAt}`,
      "",
      "## Prompt",
      "",
      prompt,
      "",
      "## Response",
      "",
      response,
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    paths.manifestFile,
    JSON.stringify(
      {
        kind: "first-llm-studio-finetune-operation",
        operationKind: "chat-adapter",
        generatedAt,
        adapter,
        transcriptFile: paths.transcriptFile,
      },
      null,
      2,
    ),
    "utf8",
  );
  const operation = saveFineTuneOperation({
    id,
    kind: "chat-adapter",
    status: "completed",
    title: `Adapter chat · ${adapter.adapterName}`,
    adapterId: adapter.id,
    jobId: adapter.jobId,
    outputDir: paths.outputDir,
    summary: `Generated a real adapter response with ${inference.resolvedModel}.`,
    metrics: {
      promptChars: prompt.length,
      responseChars: response.length,
      totalTokens: inference.usage?.totalTokens || 0,
    },
    artifacts: [
      artifactFor(paths.reportFile, "Chat report", "text/markdown"),
      artifactFor(paths.transcriptFile, "Transcript JSON", "application/json"),
      artifactFor(paths.manifestFile, "Operation manifest", "application/json"),
    ],
    metadata: {
      role: input.role?.trim() || "user",
    },
  });
  appendExperimentEvent({
    kind: "finetune",
    status: "completed",
    title: "Adapter chat inference completed",
    summary: operation.summary,
    relatedId: operation.id,
    ...buildFineTuneOperationEventReferences(operation),
    metadata: {
      adapterId: adapter.id,
      outputDir: paths.outputDir,
    },
  });
  return operation;
}
