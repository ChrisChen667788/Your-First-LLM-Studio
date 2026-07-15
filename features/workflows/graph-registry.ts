import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { createProtectedToolResumeGraph, createRetrievalGroundedAnswerGraph, validateWorkflowGraph, type WorkflowGraph } from "@/features/workflows/graph-contract";

export const WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION = "workflows.graph-registry.v1" as const;

type GraphRecord = { graph: WorkflowGraph; state: "draft" | "published" | "retired"; revision: number; createdAt: string; updatedAt: string; publishedAt?: string; deploymentSlug?: string };
type GraphRegistry = { schemaVersion: typeof WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION; records: GraphRecord[] };

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REGISTRY_FILE = path.join(DATA_DIR, "workflow-graph-registry.json");

function seedRecord(): GraphRecord {
  const now = new Date().toISOString();
  return { graph: createProtectedToolResumeGraph(), state: "published", revision: 1, createdAt: now, updatedAt: now, publishedAt: now, deploymentSlug: "protected-tool-resume" };
}

function readRegistry(): GraphRegistry {
  if (!existsSync(REGISTRY_FILE)) return { schemaVersion: WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION, records: [seedRecord()] };
  try { const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as Partial<GraphRegistry>; return { schemaVersion: WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION, records: Array.isArray(parsed.records) ? parsed.records : [seedRecord()] }; }
  catch { return { schemaVersion: WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION, records: [seedRecord()] }; }
}

function writeRegistry(registry: GraphRegistry) {
  mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function safeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("deploymentSlug must use lowercase kebab-case.");
  return slug;
}

export function readWorkflowGraphRegistry() {
  const registry = readRegistry();
  return { ok: true as const, ...registry, generatedAt: new Date().toISOString(), totals: { records: registry.records.length, drafts: registry.records.filter((record) => record.state === "draft").length, published: registry.records.filter((record) => record.state === "published").length, deployments: registry.records.filter((record) => record.state === "published" && record.deploymentSlug).length }, path: REGISTRY_FILE };
}

export function resolveWorkflowGraph(graphId: string, graphVersion: number) {
  return readRegistry().records.find((record) => record.graph.id === graphId && record.graph.version === graphVersion)?.graph ||
    (graphId === "agent-protected-tool-resume" && graphVersion === 1 ? createProtectedToolResumeGraph() : graphId === "retrieval-grounded-answer" && graphVersion === 1 ? createRetrievalGroundedAnswerGraph() : null);
}

export function resolveDeployedWorkflow(slug: string) {
  return readRegistry().records.find((record) => record.state === "published" && record.deploymentSlug === slug) || null;
}

export function saveWorkflowDraft(graph: WorkflowGraph) {
  const validation = validateWorkflowGraph(graph);
  if (!validation.valid) throw new Error(`Workflow graph is invalid: ${validation.errors.join(" ")}`);
  const registry = readRegistry();
  const existing = registry.records.find((record) => record.graph.id === graph.id && record.graph.version === graph.version);
  if (existing?.state === "published") throw new Error("Published workflow versions are immutable; create a new version.");
  const now = new Date().toISOString();
  const record: GraphRecord = { graph, state: "draft", revision: (existing?.revision || 0) + 1, createdAt: existing?.createdAt || now, updatedAt: now };
  writeRegistry({ ...registry, records: [record, ...registry.records.filter((candidate) => !(candidate.graph.id === graph.id && candidate.graph.version === graph.version))].slice(0, 200) });
  return record;
}

export function publishWorkflowVersion(input: { graphId: string; graphVersion: number; deploymentSlug: string }) {
  const registry = readRegistry();
  const target = registry.records.find((record) => record.graph.id === input.graphId && record.graph.version === input.graphVersion);
  if (!target) throw new Error("Workflow draft was not found.");
  const validation = validateWorkflowGraph(target.graph);
  if (!validation.valid) throw new Error(`Workflow graph is invalid: ${validation.errors.join(" ")}`);
  const slug = safeSlug(input.deploymentSlug);
  if (registry.records.some((record) => record.deploymentSlug === slug && record !== target)) throw new Error("deploymentSlug is already in use.");
  const now = new Date().toISOString();
  const published: GraphRecord = { ...target, state: "published", revision: target.revision + 1, updatedAt: now, publishedAt: now, deploymentSlug: slug };
  writeRegistry({ ...registry, records: registry.records.map((record) => record === target ? published : record) });
  return published;
}
