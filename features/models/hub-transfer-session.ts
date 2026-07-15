import { createHash, randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  createModelAcquisitionJob,
  readModelAcquisitionRegistry,
  runModelAcquisitionTransferStep,
  updateModelAcquisitionJob,
} from "@/features/models/model-acquisition";

export const HUB_TRANSFER_SESSION_SCHEMA_VERSION = "models.hub-transfer-session.v1" as const;

type HubProvider = "hugging-face" | "modelscope";
type HubFile = {
  path: string;
  size: number | null;
  oid?: string;
  url: string;
  jobId?: string;
  attempts?: number;
  lastError?: string;
  nextRetryAt?: string;
};
type HubSession = {
  id: string;
  provider: HubProvider;
  repository: string;
  revision: string;
  destination: string;
  include: string[];
  exclude: string[];
  files: HubFile[];
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const STORE_FILE = path.join(DATA_DIR, "hub-transfer-sessions.json");

function readSessions(): HubSession[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { sessions?: HubSession[] };
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: HubSession[]) {
  mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: HUB_TRANSFER_SESSION_SCHEMA_VERSION, sessions }, null, 2)}\n`, "utf8");
}

function updateSessionFile(sessionId: string, jobId: string, update: Partial<HubFile>) {
  const sessions = readSessions();
  writeSessions(sessions.map((session) => session.id === sessionId ? {
    ...session,
    updatedAt: new Date().toISOString(),
    files: session.files.map((file) => file.jobId === jobId ? { ...file, ...update } : file),
  } : session));
}

function required(value: unknown, name: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${name} is required.`);
  return text;
}

function safeRepository(value: unknown) {
  const repository = required(value, "repository");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("repository must use owner/name format.");
  return repository;
}

function globMatch(file: string, pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}

function selected(file: string, include: string[], exclude: string[]) {
  return (!include.length || include.some((pattern) => globMatch(file, pattern))) &&
    !exclude.some((pattern) => globMatch(file, pattern));
}

async function resolveHuggingFaceFiles(repository: string, revision: string) {
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
  const url = `https://huggingface.co/api/models/${repository}/tree/${encodeURIComponent(revision)}?recursive=true&expand=false`;
  let entries: Array<{ type?: string; path?: string; size?: number; oid?: string }>;
  try {
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store" });
    if (!response.ok) throw new Error(`Hugging Face manifest returned HTTP ${response.status}.`);
    entries = await response.json() as typeof entries;
  } catch {
    if (token && /[\r\n"]/u.test(token)) throw new Error("Hugging Face token contains unsupported characters.");
    const output = execFileSync("/usr/bin/curl", ["--config", "-", "--silent", "--show-error", "--fail", "--location", "--max-time", "30", url], {
      input: token ? `header = "Authorization: Bearer ${token}"\n` : "",
      encoding: "utf8",
      timeout: 35_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    entries = JSON.parse(output) as typeof entries;
  }
  return entries.filter((entry) => entry.type === "file" && entry.path).map((entry) => ({
    path: entry.path as string,
    size: typeof entry.size === "number" ? entry.size : null,
    oid: entry.oid,
    url: `https://huggingface.co/${repository}/resolve/${encodeURIComponent(revision)}/${entry.path}`,
  }));
}

function resolveModelScopeFiles(repository: string, revision: string, requestedFiles: string[]) {
  if (!requestedFiles.length) {
    throw new Error("ModelScope requires an explicit files manifest; provide files after selecting them from the repository view.");
  }
  return requestedFiles.map((file) => {
    const normalized = file.replace(/^\/+/, "");
    if (!normalized || normalized.includes("..")) throw new Error(`Invalid ModelScope file path: ${file}`);
    return {
      path: normalized,
      size: null,
      url: `https://www.modelscope.cn/models/${repository}/resolve/${encodeURIComponent(revision)}/${normalized}`,
    };
  });
}

export async function createHubTransferSession(input: {
  provider?: HubProvider;
  repository?: string;
  revision?: string;
  destination?: string;
  include?: string[];
  exclude?: string[];
  files?: string[];
}) {
  const provider = input.provider === "modelscope" ? "modelscope" : "hugging-face";
  const repository = safeRepository(input.repository);
  const revision = input.revision?.trim() || (provider === "modelscope" ? "master" : "main");
  const destination = path.resolve(required(input.destination, "destination"));
  const include = (input.include || []).filter(Boolean);
  const exclude = (input.exclude || []).filter(Boolean);
  const manifest = provider === "hugging-face"
    ? await resolveHuggingFaceFiles(repository, revision)
    : resolveModelScopeFiles(repository, revision, input.files || []);
  const chosen = manifest.filter((file) => selected(file.path, include, exclude));
  if (!chosen.length) throw new Error("No repository files matched the transfer selection.");
  if (chosen.length > 2_000) throw new Error("Transfer selection exceeds the 2,000-file safety limit.");
  const files = chosen.map((file) => {
    const job = createModelAcquisitionJob({
      source: provider,
      modelId: `${repository}:${file.path}`,
      revision,
      destination: path.join(destination, file.path),
      bytesTotal: file.size || undefined,
      artifactUrl: file.url,
    });
    return { ...file, jobId: job.id };
  });
  const now = new Date().toISOString();
  const session: HubSession = {
    id: `hub-${createHash("sha256").update(`${provider}:${repository}:${revision}:${destination}:${randomUUID()}`).digest("hex").slice(0, 20)}`,
    provider, repository, revision, destination, include, exclude, files, createdAt: now, updatedAt: now,
  };
  writeSessions([session, ...readSessions()].slice(0, 50));
  return session;
}

export function readHubTransferSessions() {
  const jobs = new Map(readModelAcquisitionRegistry().jobs.map((job) => [job.id, job]));
  const sessions = readSessions().map((session) => ({
    ...session,
    files: session.files.map((file) => ({ ...file, job: file.jobId ? jobs.get(file.jobId) || null : null })),
  }));
  return {
    ok: true as const,
    schemaVersion: HUB_TRANSFER_SESSION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    capabilities: ["repository-manifest", "include-exclude", "multi-file-session", "range-resume", "private-token-redaction", "persistent-retry-backoff", "bounded-attempts"],
    providers: {
      huggingFace: { automaticManifest: true, tokenConfigured: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN) },
      modelScope: { automaticManifest: false, explicitFileManifest: true, tokenConfigured: Boolean(process.env.MODELSCOPE_API_TOKEN) },
    },
    sessions,
  };
}

export async function runHubTransferSessionStep(sessionId: string, chunkBytes?: number) {
  const session = readSessions().find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error("Hub transfer session was not found.");
  const registry = readModelAcquisitionRegistry();
  const nextFile = session.files.find((file) => {
    const job = registry.jobs.find((candidate) => candidate.id === file.jobId);
    return job && !["completed", "cancelled"].includes(job.status);
  });
  if (!nextFile?.jobId) return { completed: true, session: readHubTransferSessions().sessions.find((entry) => entry.id === sessionId) };
  const currentJob = registry.jobs.find((candidate) => candidate.id === nextFile.jobId);
  const attempts = nextFile.attempts || 0;
  if (attempts >= 5) throw new Error(`Hub file ${nextFile.path} exhausted its retry budget.`);
  if (nextFile.nextRetryAt && Date.parse(nextFile.nextRetryAt) > Date.now()) {
    throw new Error(`Hub file ${nextFile.path} is waiting for retry backoff until ${nextFile.nextRetryAt}.`);
  }
  if (currentJob?.status === "failed" || currentJob?.status === "paused") {
    updateModelAcquisitionJob({ jobId: nextFile.jobId, action: "resume" });
  }
  try {
    const job = await runModelAcquisitionTransferStep({ jobId: nextFile.jobId, chunkBytes });
    updateSessionFile(sessionId, nextFile.jobId, { attempts, lastError: undefined, nextRetryAt: undefined });
    return { completed: false, job, session: readHubTransferSessions().sessions.find((entry) => entry.id === sessionId) };
  } catch (error) {
    const nextAttempts = attempts + 1;
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.max(0, nextAttempts - 1));
    updateSessionFile(sessionId, nextFile.jobId, {
      attempts: nextAttempts,
      lastError: error instanceof Error ? error.message : "Hub transfer failed.",
      nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
    });
    throw error;
  }
}

export function resetHubTransferFileRetry(sessionId: string, jobId: string) {
  const session = readSessions().find((candidate) => candidate.id === sessionId);
  if (!session?.files.some((file) => file.jobId === jobId)) throw new Error("Hub transfer file was not found.");
  updateSessionFile(sessionId, jobId, { attempts: 0, lastError: undefined, nextRetryAt: undefined });
  return readHubTransferSessions().sessions.find((entry) => entry.id === sessionId);
}
