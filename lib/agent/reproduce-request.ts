import type {
  AgentChatRequest,
  AgentCompareRequest,
  AgentCompareOutputShape,
  AgentCompareResponse,
  AgentMessage,
  AgentProviderProfile,
  AgentThinkingMode
} from "@/lib/agent/types";

export type AgentReproduceMode = "chat" | "compare";
export type AgentReproduceLanguage = "curl" | "python" | "typescript";

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
  return `curl -X POST ${JSON.stringify(endpoint)} \\
  -H "Content-Type: application/json" \\
  -d '${escaped}'`;
}

function buildPythonSnippet(endpoint: string, body: unknown) {
  return `import requests\n\npayload = ${pythonValue(body)}\nresponse = requests.post(${JSON.stringify(endpoint)}, json=payload, timeout=120)\nresponse.raise_for_status()\nprint(response.json())`;
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

export function buildReproduceRequestArtifacts(params:
  | ({
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
    })
  | ({
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
    })) {
  const baseUrl = params.baseUrl || DEFAULT_BASE_URL;
  const endpoint = `${baseUrl}${params.mode === "chat" ? "/api/agent/chat" : "/api/agent/compare"}`;
  const body =
    params.mode === "chat"
      ? buildChatPayload(params)
      : buildComparePayload(params);

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
      typescript: buildFetchSnippet(endpoint, body)
    }
  };
}
