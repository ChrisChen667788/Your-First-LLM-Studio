import {
  searchEnterpriseRetrieval,
} from "@/features/retrieval/enterprise-service";
import {
  encodeWorkflowNodeOutput,
  findLatestWorkflowNodeEnvelope,
  findLatestWorkflowNodeEvent,
  type WorkflowNodeExecutionInput,
  type WorkflowNodeExecutionResult,
  type WorkflowNodeExecutor,
  type WorkflowNodeExecutorRegistry,
} from "@/features/workflows/node-execution-contract";
import { executeWorkflowModelNode } from "@/features/workflows/model-provider-port";
import {
  searchKnowledgeBase,
  verifyGroundedAnswer,
} from "@/lib/agent/retrieval-store";
import { runWorkspaceTool } from "@/lib/agent/server-tools";
import type {
  AgentKnowledgeHit,
  AgentRetrievalSummary,
} from "@/lib/agent/types";

export const WORKFLOW_NODE_EXECUTOR_REGISTRY_SCHEMA_VERSION =
  "workflows.node-executor-registry.v1" as const;

type RegistryDependencies = {
  runModelNode?: (
    input: WorkflowNodeExecutionInput,
  ) => Promise<{ output: string }>;
  searchLocal?: typeof searchKnowledgeBase;
  searchEnterprise?: typeof searchEnterpriseRetrieval;
  runTool?: typeof runWorkspaceTool;
};

function stringConfig(
  input: WorkflowNodeExecutionInput,
  key: string,
  fallback = "",
) {
  const value = input.node.config[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberConfig(
  input: WorkflowNodeExecutionInput,
  key: string,
  fallback: number,
) {
  const value = input.node.config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanConfig(
  input: WorkflowNodeExecutionInput,
  key: string,
  fallback = false,
) {
  const value = input.node.config[key];
  return typeof value === "boolean" ? value : fallback;
}

function result(
  input: WorkflowNodeExecutionInput,
  executorId: string,
  value: {
    ok: boolean;
    summary: string;
    data?: Record<string, unknown>;
    condition?: string;
  },
): WorkflowNodeExecutionResult {
  return {
    executorId,
    condition: value.condition,
    output: encodeWorkflowNodeOutput({
      nodeId: input.node.id,
      kind: input.node.kind,
      ok: value.ok,
      summary: value.summary,
      data: value.data || {},
    }),
  };
}

function resolveEnterprisePrincipal(input: WorkflowNodeExecutionInput) {
  const workspaceId =
    stringConfig(input, "workspaceId") ||
    process.env.WORKFLOW_ENTERPRISE_WORKSPACE_ID?.trim() ||
    "";
  const subjectId =
    stringConfig(input, "subjectId") ||
    process.env.WORKFLOW_ENTERPRISE_SUBJECT_ID?.trim() ||
    "";
  const groupValue =
    stringConfig(input, "groupIds") ||
    process.env.WORKFLOW_ENTERPRISE_GROUP_IDS?.trim() ||
    "";
  if (!workspaceId || !subjectId) {
    throw new Error(
      `Workflow retrieval node ${input.node.id} requires workspace and subject identity because aclRequired=true.`,
    );
  }
  return {
    workspaceId,
    subjectId,
    groupIds: groupValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function enterpriseResultToSummary(
  query: string,
  value: Awaited<ReturnType<typeof searchEnterpriseRetrieval>>,
): AgentRetrievalSummary {
  const results: AgentKnowledgeHit[] = value.results.map((entry, index) => ({
    chunkId: entry.id,
    documentId: entry.documentId,
    title: entry.title,
    source: entry.source || undefined,
    sectionPath: [],
    order: index,
    content: entry.content,
    citationLabel: `[${entry.citation}]`,
    score: entry.rerankScore,
    confidence: Math.max(0, Math.min(1, entry.rerankScore)),
    scoring: {
      lexical: entry.lexicalScore,
      structural: 0,
      vector: entry.vectorScore,
      rerank: entry.rerankScore,
      final: entry.rerankScore,
    },
  }));
  return {
    query,
    scope: "knowledge-base",
    sourcePreference: "knowledge-first",
    evidenceMode: "expanded",
    hitCount: results.length,
    lowConfidence: results.length === 0,
    topScore: results[0]?.score || 0,
    usedInPrompt: results.length > 0,
    strategy: "hybrid-rerank",
    candidateCount: results.length,
    vectorCandidateCount: results.length,
    reranked: true,
    embeddingModel: "enterprise-configured-embedding",
    stageNotes: ["pgvector", "storage-acl", "cross-encoder"],
    results,
  };
}

function createRetrievalExecutor(
  dependencies: Required<Pick<RegistryDependencies, "searchLocal" | "searchEnterprise">>,
): WorkflowNodeExecutor {
  return async (input) => {
    const topK = Math.max(1, Math.min(20, Math.round(numberConfig(input, "topK", 6))));
    const aclRequired = booleanConfig(input, "aclRequired");
    const query = stringConfig(input, "query", input.state.input);
    const retrieval = aclRequired
      ? enterpriseResultToSummary(
          query,
          await dependencies.searchEnterprise({
            principal: resolveEnterprisePrincipal(input),
            query,
            topK,
          }),
        )
      : dependencies.searchLocal(query, topK, {
          scope: "all",
          sourcePreference: "balanced",
          evidenceMode: "expanded",
        });
    return result(input, aclRequired ? "enterprise-retrieval" : "local-retrieval", {
      ok: true,
      summary: `${retrieval.hitCount} evidence hit${retrieval.hitCount === 1 ? "" : "s"} retrieved.`,
      data: {
        backend: aclRequired ? "pgvector-hybrid-cross-encoder" : "local-hybrid-rerank",
        aclEnforced: aclRequired,
        retrieval,
      },
    });
  };
}

function createReadOnlyToolExecutor(
  runTool: NonNullable<RegistryDependencies["runTool"]>,
): WorkflowNodeExecutor {
  return async (input) => {
    if (input.node.sideEffect !== "read") {
      throw new Error(
        `Workflow tool node ${input.node.id} is not read-only and requires protected execution.`,
      );
    }
    const toolName = stringConfig(input, "toolName");
    if (!new Set(["read_file", "list_files"]).has(toolName)) {
      throw new Error(
        `Workflow read-only tool ${toolName || "<missing>"} is not allowlisted.`,
      );
    }
    const toolInput: Record<string, unknown> = {};
    const path = stringConfig(input, "path");
    if (path) toolInput.path = path;
    if (toolName === "read_file") {
      toolInput.startLine = Math.max(1, Math.round(numberConfig(input, "startLine", 1)));
      toolInput.endLine = Math.max(
        Number(toolInput.startLine),
        Math.round(numberConfig(input, "endLine", 120)),
      );
    } else {
      toolInput.limit = Math.max(1, Math.min(200, Math.round(numberConfig(input, "limit", 50))));
    }
    const tool = await runTool(toolName, toolInput);
    return result(input, `workspace-tool:${toolName}`, {
      ok: true,
      summary: `${toolName} completed through the read-only workspace tool port.`,
      data: { toolName, input: toolInput, output: tool.output },
    });
  };
}

function resolveGuardValue(input: WorkflowNodeExecutionInput) {
  const expression = stringConfig(input, "expression", "result.ok == true");
  const previous = findLatestWorkflowNodeEvent(input.state, input.graph);
  const previousEnvelope = previous?.output
    ? findLatestWorkflowNodeEnvelope(
        input.state,
        input.graph,
        input.graph.nodes.find((node) => node.id === previous.nodeId)?.kind || "input",
      )
    : null;
  if (expression === "tool.protected == true") {
    return input.graph.nodes.some(
      (node) =>
        node.kind === "tool" &&
        (node.config.protected === true ||
          node.sideEffect === "write" ||
          node.sideEffect === "external"),
    );
  }
  if (expression === "result.ok == true") return previousEnvelope?.ok === true;
  if (expression === "retrieval.hitCount > 0") {
    const retrieval = findLatestWorkflowNodeEnvelope(
      input.state,
      input.graph,
      "retrieval",
    )?.data.retrieval as AgentRetrievalSummary | undefined;
    return (retrieval?.hitCount || 0) > 0;
  }
  if (expression === "evaluation.passed == true") {
    const evaluation = findLatestWorkflowNodeEnvelope(
      input.state,
      input.graph,
      "evaluator",
    );
    return evaluation?.data.passed === true;
  }
  if (expression === "input.contains") {
    const contains = stringConfig(input, "contains");
    if (!contains) throw new Error(`Workflow guard ${input.node.id} requires config.contains.`);
    return input.state.input.includes(contains);
  }
  throw new Error(
    `Workflow guard ${input.node.id} uses unsupported expression: ${expression}`,
  );
}

const guardExecutor: WorkflowNodeExecutor = async (input) => {
  const matched = resolveGuardValue(input);
  const conditionalEdges = input.graph.edges.filter(
    (edge) => edge.from === input.node.id && edge.condition,
  );
  const trueCondition =
    stringConfig(input, "trueCondition") ||
    stringConfig(input, "defaultCondition") ||
    conditionalEdges[0]?.condition ||
    "";
  const falseCondition =
    stringConfig(input, "falseCondition") ||
    conditionalEdges.find((edge) => edge.condition !== trueCondition)?.condition ||
    "";
  const condition = matched ? trueCondition : falseCondition;
  if (!condition) {
    throw new Error(
      `Workflow guard ${input.node.id} has no ${matched ? "true" : "false"} branch.`,
    );
  }
  return result(input, "restricted-guard-dsl", {
    ok: true,
    summary: `Guard selected ${condition}.`,
    condition,
    data: {
      expression: stringConfig(input, "expression", "result.ok == true"),
      matched,
      condition,
    },
  });
};

const evaluatorExecutor: WorkflowNodeExecutor = async (input) => {
  const modelOutput = findLatestWorkflowNodeEvent(input.state, input.graph, "model")?.output || "";
  const retrieval = findLatestWorkflowNodeEnvelope(
    input.state,
    input.graph,
    "retrieval",
  )?.data.retrieval as AgentRetrievalSummary | undefined;
  const minimumCitations = Math.max(
    0,
    Math.round(numberConfig(input, "minimumCitations", 0)),
  );
  let passed = modelOutput.trim().length > 0;
  let evaluation: Record<string, unknown> = {
    metric: "non-empty-output",
    outputLength: modelOutput.trim().length,
  };
  if (minimumCitations > 0) {
    if (!retrieval) {
      throw new Error(
        `Workflow evaluator ${input.node.id} requires retrieval evidence.`,
      );
    }
    const verification = verifyGroundedAnswer(modelOutput, retrieval);
    passed =
      verification.citedLabels.length >= minimumCitations &&
      verification.unsupportedLabels.length === 0 &&
      !verification.fallbackApplied;
    evaluation = {
      metric: "citation-grounding",
      minimumCitations,
      verification,
    };
  }
  const condition = passed
    ? stringConfig(input, "passedCondition") || undefined
    : stringConfig(input, "failedCondition") || undefined;
  return result(input, minimumCitations > 0 ? "citation-evaluator" : "non-empty-evaluator", {
    ok: true,
    summary: passed ? "Evaluation passed." : "Evaluation completed with a failing score.",
    condition,
    data: { passed, ...evaluation },
  });
};

const inputExecutor: WorkflowNodeExecutor = async (input) => ({
  executorId: "workflow-input",
  output: input.state.input,
});

const outputExecutor: WorkflowNodeExecutor = async (input) => {
  const modelOutput = findLatestWorkflowNodeEvent(input.state, input.graph, "model")?.output;
  const latestOutput = findLatestWorkflowNodeEvent(input.state, input.graph)?.output;
  return {
    executorId: "workflow-output",
    output: modelOutput || latestOutput || input.state.input,
  };
};

export function createWorkflowNodeExecutorRegistry(
  dependencies: RegistryDependencies = {},
): WorkflowNodeExecutorRegistry {
  const runModelNode = dependencies.runModelNode || executeWorkflowModelNode;
  return {
    input: inputExecutor,
    model: async (input) => {
      const model = await runModelNode(input);
      return {
        executorId: "provider-model",
        output: model.output,
      };
    },
    retrieval: createRetrievalExecutor({
      searchLocal: dependencies.searchLocal || searchKnowledgeBase,
      searchEnterprise: dependencies.searchEnterprise || searchEnterpriseRetrieval,
    }),
    tool: createReadOnlyToolExecutor(dependencies.runTool || runWorkspaceTool),
    guard: guardExecutor,
    evaluator: evaluatorExecutor,
    output: outputExecutor,
  };
}

export async function executeWorkflowNode(
  input: WorkflowNodeExecutionInput,
  registry = createWorkflowNodeExecutorRegistry(),
) {
  if (input.node.kind === "approval") {
    throw new Error("Approval nodes are advanced only by an explicit approval decision.");
  }
  const executor = registry[input.node.kind];
  if (!executor) {
    throw new Error(`No workflow executor is registered for ${input.node.kind}.`);
  }
  return executor(input);
}

export function readWorkflowNodeExecutorCapabilities() {
  return {
    ok: true as const,
    schemaVersion: WORKFLOW_NODE_EXECUTOR_REGISTRY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    executors: [
      "input",
      "model-provider",
      "local-retrieval",
      "enterprise-retrieval",
      "read-only-workspace-tool",
      "restricted-guard-dsl",
      "citation-evaluator",
      "output",
    ],
    protectedSideEffects: {
      automaticKinds: ["none", "read"],
      blockedKinds: ["write", "external"],
      resumePolicy: "idempotency-key",
    },
  };
}
