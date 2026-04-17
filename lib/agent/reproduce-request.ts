import { agentTargets } from "@/lib/agent/catalog";
import type {
  AgentChatRequest,
  AgentCompareRequest,
  AgentCompareOutputShape,
  AgentCompareResponse,
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode,
  AgentTarget
} from "@/lib/agent/types";

export type AgentReproduceMode = "chat" | "compare";
export type AgentReproduceLanguage = "curl" | "python" | "typescript" | "openai-sdk";

const DEFAULT_BASE_URL = "http://localhost:3011";

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function pythonValue(value: unknown, indent = 0): string {
  const space = " ".repeat(indent);
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[` + value.map((entry) => `\n${space}  ${pythonValue(entry, indent + 2)}`).join(",") + `\n${space}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "{}";
    return `{${entries
      .map(([key, entry]) => `\n${space}  ${JSON.stringify(key)}: ${pythonValue(entry, indent + 2)}`)
      .join(",")}\n${space}}`;
  }
  return "None";
}

function buildFetchSnippet(endpoint: string, body: unknown) {
  return `const response = await fetch(${JSON.stringify(endpoint)}, {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${pretty(body)})\n});\n\nif (!response.ok) {\n  throw new Error(\`Request failed with status \${response.status}\`);\n}\n\nconst payload = await response.json();\nconsole.log(payload);`;
}

function buildCurlSnippet(endpoint: string, body: unknown) {
  const escaped = pretty(body).replace(/'/g, `'"'"'`);
  return `curl -X POST ${JSON.stringify(endpoint)} \\\n  -H "Content-Type: application/json" \\\n  -d '${escaped}'`;
}

function buildPythonSnippet(endpoint: string, body: unknown) {
  return `import requests\n\npayload = ${pythonValue(body)}\nresponse = requests.post(${JSON.stringify(endpoint)}, json=payload, timeout=120)\nresponse.raise_for_status()\nprint(response.json())`;
}

function lookupTarget(targetId: string) {
  return agentTargets.find((target) => target.id === targetId) || null;
}

function resolveTargetModel(target: AgentTarget | null, thinkingMode: AgentThinkingMode) {
  if (!target) return "replace-with-model";
  return thinkingMode === "thinking"
    ? target.thinkingModelDefault || target.modelDefault
    : target.modelDefault;
}

function buildResponsesInput(historyMessages: AgentMessage[], input: string) {
  return [...historyMessages, { role: "user" as const, content: input }].map((message) => ({
    role: message.role,
    content: [{ type: "input_text", text: message.content }]
  }));
}

function buildResponsesTextBlock(compareOutputShape?: AgentCompareOutputShape) {
  if (compareOutputShape === "strict-json") {
    return `,
  text: {
    format: {
      type: "json_schema",
      strict: true,
      name: "studio_compare_output",
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          summary: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          recommendation: { type: "string" }
        },
        required: ["summary"]
      }
    }
  }`;
  }
  return "";
}

function buildResponsesToolsBlock(enableTools: boolean) {
  if (!enableTools) return "";
  return `,
  tools: [
    // Re-declare the same function tools your studio request exposes.
    // The web workbench flag is preserved here, but your server-side tool registry
    // is not serialized automatically into this export.
    // {
    //   type: "function",
    //   name: "lookup_repo_file",
    //   description: "Read a file from the repo before answering.",
    //   parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
    // }
  ],
  tool_choice: "auto"`;
}

function buildReasoningBlock(thinkingMode: AgentThinkingMode) {
  return thinkingMode === "thinking"
    ? `,
  reasoning: {
    effort: "medium"
  }`
    : "";
}

function buildOpenAiSdkChatSnippet(params: {
  targetId: string;
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
}) {
  const target = lookupTarget(params.targetId);
  const apiKeyExpr = target?.apiKeyEnv ? `process.env.${target.apiKeyEnv}` : 'process.env.LOCAL_OPENAI_COMPAT_KEY ?? "not-required-for-local-gateway"';
  const requestConfig = pretty({
    providerProfile: params.providerProfile,
    retrieval: params.enableRetrieval,
    targetId: params.targetId
  });
  const instructions = params.systemPrompt || [
    "You are reproducing a First LLM Studio chat request outside the UI.",
    `Keep the same provider profile: ${params.providerProfile}.`,
    params.enableRetrieval ? "Retrieval was enabled in the studio run." : "Retrieval was disabled in the studio run."
  ].join(" ");

  return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: ${apiKeyExpr},
  baseURL: ${JSON.stringify(target?.baseUrlDefault || "https://api.openai.com/v1")}
});

const response = await client.responses.create({
  model: ${JSON.stringify(resolveTargetModel(target, params.thinkingMode))},
  instructions: ${JSON.stringify(instructions)},
  input: ${pretty(buildResponsesInput(params.historyMessages, params.input))},
  metadata: ${requestConfig}${buildReasoningBlock(params.thinkingMode)}${buildResponsesToolsBlock(params.enableTools)}
});

console.log(response.output_text);
console.dir(response.output, { depth: null });`;
}

function buildOpenAiSdkCompareSnippet(params: {
  compareTargetIds: string[];
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  compareIntent: AgentCompareRequest["compareIntent"];
  compareOutputShape: AgentCompareOutputShape;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
}) {
  const targets = params.compareTargetIds.map((targetId) => {
    const target = lookupTarget(targetId);
    return {
      id: targetId,
      label: target?.label || targetId,
      baseURL: target?.baseUrlDefault || "https://api.openai.com/v1",
      apiKeyEnv: target?.apiKeyEnv || "LOCAL_OPENAI_COMPAT_KEY",
      model: resolveTargetModel(target, params.thinkingMode)
    };
  });
  const instructions = params.systemPrompt || [
    "You are reproducing a First LLM Studio compare run outside the UI.",
    `Compare intent: ${params.compareIntent}.`,
    `Output shape: ${params.compareOutputShape}.`,
    params.enableRetrieval ? "Retrieval was enabled in the studio run." : "Retrieval was disabled in the studio run."
  ].join(" ");

  return `import OpenAI from "openai";

const targets = ${pretty(targets)};
const sharedRequest = {
  instructions: ${JSON.stringify(instructions)},
  input: ${pretty(buildResponsesInput(params.historyMessages, params.input))},
  metadata: ${pretty({
    providerProfile: params.providerProfile,
    contextWindow: params.contextWindow,
    compareIntent: params.compareIntent,
    outputShape: params.compareOutputShape,
    retrieval: params.enableRetrieval
  })}${buildReasoningBlock(params.thinkingMode)}${buildResponsesToolsBlock(params.enableTools)}${buildResponsesTextBlock(
    params.compareOutputShape
  )}
};

const results = await Promise.all(
  targets.map(async (target) => {
    const client = new OpenAI({
      apiKey: process.env[target.apiKeyEnv] ?? "not-required-for-local-gateway",
      baseURL: target.baseURL
    });

    const response = await client.responses.create({
      model: target.model,
      ...sharedRequest
    });

    return {
      targetId: target.id,
      label: target.label,
      outputText: response.output_text,
      output: response.output,
      usage: response.usage ?? null
    };
  })
);

console.dir(results, { depth: null });`;
}

function buildChatPayload(params: {
  targetId: string;
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
}): AgentChatRequest {
  return {
    targetId: params.targetId,
    input: params.input,
    messages: params.historyMessages,
    systemPrompt: params.systemPrompt || undefined,
    contextWindow: params.contextWindow,
    enableTools: params.enableTools,
    enableRetrieval: params.enableRetrieval,
    providerProfile: params.providerProfile,
    thinkingMode: params.thinkingMode
  };
}

function buildComparePayload(params: {
  compareTargetIds: string[];
  input: string;
  historyMessages: AgentMessage[];
  systemPrompt: string;
  compareIntent: AgentCompareRequest["compareIntent"];
  compareOutputShape: AgentCompareOutputShape;
  contextWindow: number;
  enableTools: boolean;
  enableRetrieval: boolean;
  providerProfile: AgentProviderProfile;
  thinkingMode: AgentThinkingMode;
}): AgentCompareRequest {
  return {
    requestId: "replace-with-uuid-if-needed",
    targetIds: params.compareTargetIds,
    input: params.input,
    messages: params.historyMessages,
    systemPrompt: params.systemPrompt || undefined,
    compareIntent: params.compareIntent,
    compareOutputShape: params.compareOutputShape,
    contextWindow: params.contextWindow,
    enableTools: params.enableTools,
    enableRetrieval: params.enableRetrieval,
    providerProfile: params.providerProfile,
    thinkingMode: params.thinkingMode
  };
}

export function buildReproduceRequestArtifacts(
  params:
    | {
        mode: "chat";
        baseUrl?: string;
        targetId: string;
        input: string;
        historyMessages: AgentMessage[];
        systemPrompt: string;
        contextWindow: number;
        enableTools: boolean;
        enableRetrieval: boolean;
        providerProfile: AgentProviderProfile;
        thinkingMode: AgentThinkingMode;
      }
    | {
        mode: "compare";
        baseUrl?: string;
        compareTargetIds: string[];
        input: string;
        historyMessages: AgentMessage[];
        systemPrompt: string;
        compareIntent: AgentCompareRequest["compareIntent"];
        compareOutputShape: AgentCompareOutputShape;
        contextWindow: number;
        enableTools: boolean;
        enableRetrieval: boolean;
        providerProfile: AgentProviderProfile;
        thinkingMode: AgentThinkingMode;
        compareResult?: AgentCompareResponse | null;
      }
) {
  const baseUrl = params.baseUrl || DEFAULT_BASE_URL;
  const endpoint = `${baseUrl}${params.mode === "chat" ? "/api/agent/chat" : "/api/agent/compare"}`;
  const body = params.mode === "chat" ? buildChatPayload(params) : buildComparePayload(params);

  const summary =
    params.mode === "chat"
      ? {
          mode: "chat" as const,
          targetCount: 1,
          targetIds: [params.targetId],
          providerProfile: params.providerProfile,
          thinkingMode: params.thinkingMode,
          tools: params.enableTools,
          retrieval: params.enableRetrieval,
          contextWindow: params.contextWindow
        }
      : {
          mode: "compare" as const,
          targetCount: params.compareTargetIds.length,
          targetIds: params.compareTargetIds,
          providerProfile: params.providerProfile,
          thinkingMode: params.thinkingMode,
          tools: params.enableTools,
          retrieval: params.enableRetrieval,
          contextWindow: params.contextWindow,
          compareIntent: params.compareIntent,
          compareOutputShape: params.compareOutputShape,
          runId: params.compareResult?.runId || null
        };

  return {
    endpoint,
    body,
    summary,
    snippets: {
      curl: buildCurlSnippet(endpoint, body),
      python: buildPythonSnippet(endpoint, body),
      typescript: buildFetchSnippet(endpoint, body),
      "openai-sdk":
        params.mode === "chat"
          ? buildOpenAiSdkChatSnippet(params)
          : buildOpenAiSdkCompareSnippet(params)
    }
  };
}
