import type { AgentFineTuneDataset } from "@/lib/agent/types";
import { buildFineTuneAdapterArtifacts } from "./bundle-service";
import {
  coerceChatMessages,
  readLocalTextFile,
  readStringField,
} from "./dataset-service";
import { readJobs, readRecipes } from "./repository";
import { listFineTuneTargetOptions } from "./target-service";

export type FineTuneNormalizedSample = {
  prompt: string;
  reference: string;
};

function normalizeInstructionSample(line: string) {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  const prompt = readStringField(parsed, [
    "prompt",
    "instruction",
    "query",
    "question",
    "input",
  ]);
  const completion = readStringField(parsed, [
    "completion",
    "response",
    "output",
    "answer",
    "target",
  ]);
  return {
    prompt: prompt.trim(),
    completion: completion.trim(),
  };
}

function normalizeChatSample(line: string) {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  return { messages: coerceChatMessages(parsed) };
}

export function readFineTuneSamples(
  dataset: AgentFineTuneDataset,
  maxSamples: number,
): FineTuneNormalizedSample[] {
  if (!dataset.sourcePath) {
    throw new Error("Dataset source path is missing.");
  }
  const limit = Math.max(1, Math.min(Math.round(maxSamples), 500));
  return readLocalTextFile(dataset.sourcePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => {
      if (dataset.format === "chat-jsonl") {
        const { messages } = normalizeChatSample(line);
        const lastUser = [...messages]
          .reverse()
          .find((message) => message.role === "user");
        const lastAssistant = [...messages]
          .reverse()
          .find((message) => message.role === "assistant");
        return {
          prompt: lastUser?.content || messages.at(0)?.content || "",
          reference: lastAssistant?.content || messages.at(-1)?.content || "",
        };
      }
      const sample = normalizeInstructionSample(line);
      return {
        prompt: sample.prompt,
        reference: sample.completion,
      };
    })
    .filter((sample) => sample.prompt || sample.reference);
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

export function scoreTokenOverlap(reference: string, prediction: string) {
  const referenceTokens = tokenSet(reference);
  const predictionTokens = tokenSet(prediction);
  if (!referenceTokens.size || !predictionTokens.size) return 0;
  let overlap = 0;
  predictionTokens.forEach((token) => {
    if (referenceTokens.has(token)) overlap += 1;
  });
  const precision = overlap / predictionTokens.size;
  const recall = overlap / referenceTokens.size;
  if (!precision || !recall) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function resolveFineTuneAdapter(adapterId: string) {
  const jobs = readJobs();
  const recipes = readRecipes();
  const localTargets = listFineTuneTargetOptions();
  const adapters = buildFineTuneAdapterArtifacts(jobs, recipes, localTargets);
  const summary = { adapters, jobs };
  const adapter = summary.adapters.find((entry) => entry.id === adapterId);
  if (!adapter) {
    throw new Error("Adapter artifact not found.");
  }
  const job = jobs.find((entry) => entry.id === adapter.jobId);
  return { adapter, job, summary };
}
