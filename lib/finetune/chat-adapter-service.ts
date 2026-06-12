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

export function runFineTuneAdapterChat(input: {
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
  const response = [
    `Adapter: ${adapter.adapterName}`,
    `Role: ${input.role?.trim() || "user"}`,
    "",
    "This local chat smoke response confirms the adapter handoff path is wired.",
    `Prompt focus: ${truncatePreview(prompt, 220)}`,
  ].join("\n");
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
  };
  writeFileSync(
    paths.transcriptFile,
    JSON.stringify(transcript, null, 2),
    "utf8",
  );
  writeFileSync(
    paths.reportFile,
    [
      `# Adapter Chat Smoke: ${adapter.adapterName}`,
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
    title: `Chat smoke · ${adapter.adapterName}`,
    adapterId: adapter.id,
    jobId: adapter.jobId,
    outputDir: paths.outputDir,
    summary: `Generated adapter chat smoke transcript for ${adapter.adapterName}.`,
    metrics: {
      promptChars: prompt.length,
      responseChars: response.length,
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
    title: "Adapter chat smoke completed",
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
