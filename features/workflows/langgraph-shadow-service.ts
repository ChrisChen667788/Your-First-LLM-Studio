import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import os from "os";
import path from "path";
import {
  readDurableJsonStore,
  updateDurableJsonStore,
} from "@/features/persistence/durable-json-store";
import { withTelemetrySpan } from "@/features/telemetry/trace-adapter";

export const LANGGRAPH_SHADOW_SCHEMA_VERSION =
  "workflows.langgraph-shadow.v1" as const;

type ShadowReceipt = {
  id: string;
  generatedAt: string;
  threadId: string;
  status: "pass" | "failed";
  protectedToolRuns: number;
  resumedRuns: number;
  duplicateSideEffects: number;
  interrupted: boolean;
  output?: string;
  error?: string;
};

type Store = {
  schemaVersion: typeof LANGGRAPH_SHADOW_SCHEMA_VERSION;
  receipts: ShadowReceipt[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "langgraph-shadow-evidence.json");
const storeOptions = {
  filePath: STORE_FILE,
  initial: (): Store => ({
    schemaVersion: LANGGRAPH_SHADOW_SCHEMA_VERSION,
    receipts: [],
  }),
  validate: (value: unknown): value is Store => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<Store>;
    return (
      candidate.schemaVersion === LANGGRAPH_SHADOW_SCHEMA_VERSION &&
      Array.isArray(candidate.receipts)
    );
  },
};

const ShadowState = Annotation.Root({
  input: Annotation<string>,
  approved: Annotation<boolean>,
  sideEffectCount: Annotation<number>,
  output: Annotation<string>,
});

function buildShadowGraph() {
  return new StateGraph(ShadowState)
    .addNode("plan", (state) => ({
      output: `Protected action planned for: ${state.input}`,
    }))
    .addNode("approval", () => ({
      approved: Boolean(
        interrupt({
          kind: "protected-tool-approval",
          question: "Approve the protected shadow action?",
        }),
      ),
    }))
    .addNode("tool", (state) => ({
      sideEffectCount: state.approved
        ? state.sideEffectCount + 1
        : state.sideEffectCount,
      output: state.approved
        ? "Shadow protected action executed exactly once."
        : "Shadow protected action rejected.",
    }))
    .addNode("finish", (state) => ({ output: state.output }))
    .addEdge(START, "plan")
    .addEdge("plan", "approval")
    .addEdge("approval", "tool")
    .addEdge("tool", "finish")
    .addEdge("finish", END)
    .compile({ checkpointer: new MemorySaver() });
}

function persist(receipt: ShadowReceipt) {
  updateDurableJsonStore(storeOptions, (store) => ({
    ...store,
    receipts: [receipt, ...store.receipts].slice(0, 200),
  }));
}

export async function runLangGraphProtectedToolShadow(input?: {
  prompt?: string;
  approve?: boolean;
}) {
  const threadId = `langgraph-shadow-${crypto.randomUUID()}`;
  const graph = buildShadowGraph();
  const config = { configurable: { thread_id: threadId } };
  let interrupted = false;
  try {
    const result = await withTelemetrySpan(
      "workflow.langgraph.shadow",
      { "workflow.thread.id": threadId, "workflow.shadow": true },
      async () => {
        const initial = (await graph.invoke(
          {
            input: input?.prompt || "Verify protected tool resume safety.",
            approved: false,
            sideEffectCount: 0,
            output: "",
          },
          config,
        )) as typeof ShadowState.State & { __interrupt__?: unknown[] };
        interrupted = Boolean(initial.__interrupt__?.length);
        return graph.invoke(
          new Command({ resume: input?.approve !== false }),
          config,
        ) as Promise<typeof ShadowState.State>;
      },
    );
    const protectedToolRuns = result.sideEffectCount || 0;
    const receipt: ShadowReceipt = {
      id: `langgraph-shadow-receipt-${crypto.randomUUID()}`,
      generatedAt: new Date().toISOString(),
      threadId,
      status:
        interrupted && protectedToolRuns <= 1 && result.approved
          ? "pass"
          : "failed",
      protectedToolRuns,
      resumedRuns: interrupted ? 1 : 0,
      duplicateSideEffects: Math.max(0, protectedToolRuns - 1),
      interrupted,
      output: result.output,
    };
    persist(receipt);
    return receipt;
  } catch (error) {
    const receipt: ShadowReceipt = {
      id: `langgraph-shadow-receipt-${crypto.randomUUID()}`,
      generatedAt: new Date().toISOString(),
      threadId,
      status: "failed",
      protectedToolRuns: 0,
      resumedRuns: 0,
      duplicateSideEffects: 0,
      interrupted,
      error: error instanceof Error ? error.message : String(error),
    };
    persist(receipt);
    return receipt;
  }
}

export function readLangGraphShadowEvidence() {
  const store = readDurableJsonStore(storeOptions);
  return {
    ok: true as const,
    mode: "shadow" as const,
    schemaVersion: LANGGRAPH_SHADOW_SCHEMA_VERSION,
    evidence: store.receipts,
    summary: {
      protectedToolRuns: store.receipts.reduce(
        (sum, receipt) => sum + receipt.protectedToolRuns,
        0,
      ),
      resumedRuns: store.receipts.reduce(
        (sum, receipt) => sum + receipt.resumedRuns,
        0,
      ),
      duplicateSideEffects: store.receipts.reduce(
        (sum, receipt) => sum + receipt.duplicateSideEffects,
        0,
      ),
      passingRuns: store.receipts.filter((receipt) => receipt.status === "pass")
        .length,
      lastUpdated: store.receipts[0]?.generatedAt || null,
    },
    path: STORE_FILE,
  };
}
