import type { AgentStudioRecipe } from "@/lib/agent/types";

const now = () => new Date().toISOString();

export const defaultStudioRecipes: AgentStudioRecipe[] = [
  {
    id: "repo-evidence-compare",
    kind: "compare",
    source: "builtin",
    label: "Repo Evidence Compare / 仓库证据对比",
    description:
      "Compare a local lane and a flagship remote lane on repo-grounded answers with cited file evidence and concise action points.",
    tags: ["repo", "grounded", "compare"],
    targetIds: ["local-qwen35-4b-4bit", "openai-gpt54"],
    input:
      "Review the current repository and explain the three most important functional areas. Cite the relevant files inline and end with one concrete implementation risk.",
    systemPrompt:
      "Act like a careful engineering reviewer. Stay grounded in repository evidence, cite concrete file paths, and avoid unsupported claims.",
    compareIntent: "template-vs-template",
    compareOutputShape: "bullet-list",
    contextWindow: 32768,
    enableTools: true,
    enableRetrieval: true,
    providerProfile: "balanced",
    thinkingMode: "standard",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "strict-json-extraction",
    kind: "compare",
    source: "builtin",
    label: "Strict JSON Extraction / 严格 JSON 抽取",
    description:
      "Stress-test structured output and schema discipline across multiple providers under the same extraction prompt.",
    tags: ["json", "schema", "regression"],
    targetIds: ["deepseek-api", "openai-gpt54"],
    input:
      "Return a JSON object with keys summary, risks, and next_steps for the following release note text: Compare Lab now supports markdown export, benchmark handoff, and local runtime recovery.",
    systemPrompt:
      "Return valid JSON only. Keep strings concise, preserve exact key names, and do not wrap the object in markdown fences.",
    compareIntent: "preset-vs-preset",
    compareOutputShape: "strict-json",
    contextWindow: 8192,
    enableTools: false,
    enableRetrieval: false,
    providerProfile: "tool-first",
    thinkingMode: "standard",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "local-vs-remote-latency-check",
    kind: "compare",
    source: "builtin",
    label: "Local vs Remote Latency Check / 本地远端延时对照",
    description:
      "Use one short task to compare local-first responsiveness against a strong remote API without changing any other fairness controls.",
    tags: ["latency", "smoke", "local-first"],
    targetIds: ["local-qwen3-4b-4bit", "openai-gpt54"],
    input:
      "In one short paragraph, explain what changed in this release and list exactly two reasons a local-first studio is useful for engineers.",
    systemPrompt:
      "Respond in one short paragraph and then a two-item bullet list. Keep the answer under 120 words.",
    compareIntent: "model-vs-model",
    compareOutputShape: "bullet-list",
    contextWindow: 4096,
    enableTools: false,
    enableRetrieval: false,
    providerProfile: "speed",
    thinkingMode: "standard",
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "tool-first-grounded-agent",
    kind: "compare",
    source: "builtin",
    label: "Tool-first Grounded Agent / 工具优先检索代理",
    description:
      "Benchmark tool use, retrieval, and reasoning discipline together on a grounded analysis task.",
    tags: ["tools", "retrieval", "agent"],
    targetIds: ["anthropic-claude", "deepseek-api"],
    input:
      "Inspect the available project context, summarize what the Compare workflow can export today, and propose the best next validation step.",
    systemPrompt:
      "Use tools when they reduce ambiguity. Prefer grounded evidence, concise summaries, and a clear next action.",
    compareIntent: "model-vs-model",
    compareOutputShape: "freeform",
    contextWindow: 16384,
    enableTools: true,
    enableRetrieval: true,
    providerProfile: "tool-first",
    thinkingMode: "thinking",
    createdAt: now(),
    updatedAt: now()
  }
];
