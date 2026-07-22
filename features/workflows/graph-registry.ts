import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { createProtectedToolResumeGraph, createRetrievalGroundedAnswerGraph, validateWorkflowGraph, type WorkflowGraph } from "@/features/workflows/graph-contract";

export const WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION = "workflows.graph-registry.v1" as const;

export type WorkflowGraphRecord = { graph: WorkflowGraph; graphDigest: string; state: "draft" | "published" | "retired"; revision: number; createdAt: string; updatedAt: string; publishedAt?: string; deploymentSlug?: string };
type GraphRegistry = { schemaVersion: typeof WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION; records: GraphRecord[] };

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REGISTRY_FILE = path.join(DATA_DIR, "workflow-graph-registry.json");

type GraphRecord = WorkflowGraphRecord;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

export function digestWorkflowGraph(graph: WorkflowGraph) {
  return `sha256:${createHash("sha256").update(JSON.stringify(stableValue(graph))).digest("hex")}`;
}

function normalizeRecord(record: Omit<GraphRecord, "graphDigest"> & { graphDigest?: string }): GraphRecord {
  return { ...record, graphDigest: record.graphDigest || digestWorkflowGraph(record.graph) };
}

function seedRecord(): GraphRecord {
  const now = new Date().toISOString();
  const graph = createProtectedToolResumeGraph();
  return { graph, graphDigest: digestWorkflowGraph(graph), state: "published", revision: 1, createdAt: now, updatedAt: now, publishedAt: now, deploymentSlug: "protected-tool-resume" };
}

function readRegistry(): GraphRegistry {
  if (!existsSync(REGISTRY_FILE)) return { schemaVersion: WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION, records: [seedRecord()] };
  try { const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as Partial<GraphRegistry>; return { schemaVersion: WORKFLOW_GRAPH_REGISTRY_SCHEMA_VERSION, records: Array.isArray(parsed.records) ? parsed.records.map(normalizeRecord) : [seedRecord()] }; }
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

export function saveWorkflowDraft(graph: WorkflowGraph, options: { expectedRevision?: number } = {}) {
  const validation = validateWorkflowGraph(graph);
  if (!validation.valid) throw new Error(`Workflow graph is invalid: ${validation.errors.join(" ")}`);
  const registry = readRegistry();
  const existing = registry.records.find((record) => record.graph.id === graph.id && record.graph.version === graph.version);
  if (existing?.state === "published") throw new Error("Published workflow versions are immutable; create a new version.");
  if (existing && options.expectedRevision !== undefined && existing.revision !== options.expectedRevision) {
    throw new Error(`Workflow draft revision conflict: expected ${options.expectedRevision}, current ${existing.revision}. Reload before saving.`);
  }
  const now = new Date().toISOString();
  const record: GraphRecord = { graph, graphDigest: digestWorkflowGraph(graph), state: "draft", revision: (existing?.revision || 0) + 1, createdAt: existing?.createdAt || now, updatedAt: now };
  writeRegistry({ ...registry, records: [record, ...registry.records.filter((candidate) => !(candidate.graph.id === graph.id && candidate.graph.version === graph.version))].slice(0, 200) });
  return record;
}

export function publishWorkflowVersion(input: { graphId: string; graphVersion: number; deploymentSlug: string; expectedRevision?: number }) {
  const registry = readRegistry();
  const target = registry.records.find((record) => record.graph.id === input.graphId && record.graph.version === input.graphVersion);
  if (!target) throw new Error("Workflow draft was not found.");
  if (input.expectedRevision !== undefined && target.revision !== input.expectedRevision) {
    throw new Error(`Workflow draft revision conflict: expected ${input.expectedRevision}, current ${target.revision}. Reload before publishing.`);
  }
  const validation = validateWorkflowGraph(target.graph);
  if (!validation.valid) throw new Error(`Workflow graph is invalid: ${validation.errors.join(" ")}`);
  const slug = safeSlug(input.deploymentSlug);
  if (registry.records.some((record) => record.deploymentSlug === slug && record !== target)) throw new Error("deploymentSlug is already in use.");
  const now = new Date().toISOString();
  const published: GraphRecord = { ...target, state: "published", revision: target.revision + 1, updatedAt: now, publishedAt: now, deploymentSlug: slug };
  writeRegistry({ ...registry, records: registry.records.map((record) => record === target ? published : record) });
  return published;
}

export function cloneWorkflowVersion(input: { graphId: string; graphVersion: number; nextVersion?: number }) {
  const registry = readRegistry();
  const source = registry.records.find((record) => record.graph.id === input.graphId && record.graph.version === input.graphVersion);
  if (!source) throw new Error("Workflow source version was not found.");
  const existingVersions = registry.records.filter((record) => record.graph.id === input.graphId).map((record) => record.graph.version);
  const nextVersion = input.nextVersion || Math.max(source.graph.version, ...existingVersions) + 1;
  if (!Number.isInteger(nextVersion) || nextVersion <= source.graph.version) throw new Error("Next workflow version must be greater than the source version.");
  if (existingVersions.includes(nextVersion)) throw new Error(`Workflow version ${nextVersion} already exists.`);
  return saveWorkflowDraft({ ...source.graph, version: nextVersion, label: `${source.graph.label.replace(/ v\d+$/, "")} v${nextVersion}` });
}

export function retireWorkflowVersion(input: { graphId: string; graphVersion: number; expectedRevision?: number }) {
  const registry = readRegistry();
  const target = registry.records.find((record) => record.graph.id === input.graphId && record.graph.version === input.graphVersion);
  if (!target) throw new Error("Workflow version was not found.");
  if (input.expectedRevision !== undefined && target.revision !== input.expectedRevision) throw new Error("Workflow version changed before it could be retired.");
  const retired: GraphRecord = { ...target, state: "retired", deploymentSlug: undefined, revision: target.revision + 1, updatedAt: new Date().toISOString() };
  writeRegistry({ ...registry, records: registry.records.map((record) => record === target ? retired : record) });
  return retired;
}
