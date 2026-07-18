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

export const HUB_TRANSFER_SESSION_SCHEMA_VERSION = "models.hub-transfer-session.v2" as const;
export const HUB_TRANSFER_RECEIPT_SCHEMA_VERSION = "models.hub-transfer-receipt.v1" as const;

type HubProvider = "hugging-face" | "modelscope";
type HubAuthentication = {
  mode: "anonymous" | "bearer";
  tokenConfigured: boolean;
  verified: boolean;
  endpoint?: string;
  subjectDigest?: string;
};
type HubFile = {
  path: string;
  size: number | null;
  oid?: string;
  expectedSha256?: string;
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
  requestedRevision?: string;
  resolvedRevision?: string;
  destination: string;
  include: string[];
  exclude: string[];
  files: HubFile[];
  authentication?: HubAuthentication;
  manifestDigest?: string;
  createdAt: string;
  updatedAt: string;
};
type HubTransferReceipt = {
  schemaVersion: typeof HUB_TRANSFER_RECEIPT_SCHEMA_VERSION;
  id: string;
  sessionId: string;
  generatedAt: string;
  status: "pass" | "hold";
  provider: HubProvider;
  repository: string;
  requestedRevision: string;
  resolvedRevision: string;
  destination: string;
  authentication: HubAuthentication;
  manifestDigest: string;
  checks: Record<string, boolean>;
  totals: { files: number; completed: number; bytes: number; verifiedChecksums: number };
  files: Array<{
    path: string;
    bytes: number;
    expectedSha256?: string;
    verifiedSha256?: string;
    checksumMatched: boolean;
    completedFile?: string;
  }>;
  blockers: string[];
};
type ResolvedManifest = {
  requestedRevision: string;
  resolvedRevision: string;
  files: Array<{ path: string; size: number | null; oid?: string; expectedSha256?: string; url: string }>;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const STORE_FILE = path.join(DATA_DIR, "hub-transfer-sessions.json");
const RECEIPT_FILE = path.join(DATA_DIR, "hub-transfer-receipts.json");

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

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

function readReceipts(): HubTransferReceipt[] {
  if (!existsSync(RECEIPT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: HubTransferReceipt[] };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persistReceipt(receipt: HubTransferReceipt) {
  mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  const prior = readReceipts().filter((entry) => entry.sessionId !== receipt.sessionId);
  writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: HUB_TRANSFER_RECEIPT_SCHEMA_VERSION, receipts: [receipt, ...prior].slice(0, 100) }, null, 2)}\n`, "utf8");
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
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("repository must use owner/name format.");
  }
  return repository;
}

function safeRemotePath(value: string) {
  return Boolean(value) && !path.isAbsolute(value) && !value.split(/[\\/]/u).includes("..");
}

function encodeRemotePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function globMatch(file: string, pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}

function selected(file: string, include: string[], exclude: string[]) {
  return (!include.length || include.some((pattern) => globMatch(file, pattern))) &&
    !exclude.some((pattern) => globMatch(file, pattern));
}

function validateToken(token: string) {
  if (/[\r\n"]/u.test(token)) throw new Error("Hub token contains unsupported characters.");
}

async function fetchJson<T>(url: string, token: string | undefined, label: string): Promise<T> {
  if (token) validateToken(token);
  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
    return await response.json() as T;
  } catch (error) {
    const output = execFileSync(
      "/usr/bin/curl",
      ["--config", "-", "--silent", "--show-error", "--fail", "--location", "--max-time", "30", url],
      {
        input: token ? `header = "Authorization: Bearer ${token}"\n` : "",
        encoding: "utf8",
        timeout: 35_000,
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    try {
      return JSON.parse(output) as T;
    } catch {
      throw error;
    }
  }
}

function authenticationSubject(payload: unknown) {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = [record.data, record.Data, record.user].find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
  const candidates = [
    record.id, record.username, record.userName, record.name,
    nested?.id, nested?.username, nested?.userName, nested?.name,
  ];
  return candidates.find((value) => typeof value === "string" || typeof value === "number") || JSON.stringify(payload);
}

async function verifyHubAuthentication(provider: HubProvider): Promise<HubAuthentication> {
  const token = provider === "hugging-face"
    ? process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN
    : process.env.MODELSCOPE_API_TOKEN || process.env.MODELSCOPE_TOKEN;
  if (!token?.trim()) return { mode: "anonymous", tokenConfigured: false, verified: false };
  const endpoint = provider === "hugging-face"
    ? "https://huggingface.co/api/whoami-v2"
    : "https://modelscope.cn/openapi/v1/users/me";
  const payload = await fetchJson<unknown>(endpoint, token, `${provider} identity verification`);
  return {
    mode: "bearer",
    tokenConfigured: true,
    verified: true,
    endpoint,
    subjectDigest: sha256(String(authenticationSubject(payload))),
  };
}

async function resolveHuggingFaceFiles(repository: string, requestedRevision: string): Promise<ResolvedManifest> {
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
  const info = await fetchJson<{ sha?: string }>(
    `https://huggingface.co/api/models/${repository}/revision/${encodeURIComponent(requestedRevision)}`,
    token,
    "Hugging Face revision",
  );
  const resolvedRevision = required(info.sha, "Hugging Face immutable revision");
  const entries = await fetchJson<Array<{ type?: string; path?: string; size?: number; oid?: string }>>(
    `https://huggingface.co/api/models/${repository}/tree/${encodeURIComponent(resolvedRevision)}?recursive=true&expand=false`,
    token,
    "Hugging Face manifest",
  );
  return {
    requestedRevision,
    resolvedRevision,
    files: entries
      .filter((entry) => entry.type === "file" && entry.path && safeRemotePath(entry.path))
      .map((entry) => ({
        path: entry.path as string,
        size: typeof entry.size === "number" ? entry.size : null,
        oid: entry.oid,
        expectedSha256: /^[a-f0-9]{64}$/iu.test(entry.oid || "") ? entry.oid?.toLowerCase() : undefined,
        url: `https://huggingface.co/${repository}/resolve/${encodeURIComponent(resolvedRevision)}/${encodeRemotePath(entry.path as string)}`,
      })),
  };
}

async function resolveModelScopeFiles(repository: string, requestedRevision: string): Promise<ResolvedManifest> {
  const token = process.env.MODELSCOPE_API_TOKEN || process.env.MODELSCOPE_TOKEN;
  const payload = await fetchJson<{
    Code?: number;
    Data?: { Files?: Array<{ Type?: string; Path?: string; Size?: number; Sha256?: string; Revision?: string }> };
  }>(
    `https://modelscope.cn/api/v1/models/${repository}/repo/files?Revision=${encodeURIComponent(requestedRevision)}&Recursive=true`,
    token,
    "ModelScope manifest",
  );
  if (payload.Code !== 200) throw new Error(`ModelScope manifest returned code ${payload.Code || "unknown"}.`);
  const entries = (payload.Data?.Files || []).filter(
    (entry) => entry.Type === "blob" && entry.Path && safeRemotePath(entry.Path),
  );
  const revisions = [...new Set(entries.map((entry) => entry.Revision).filter(Boolean))] as string[];
  if (revisions.length !== 1 || !/^[a-f0-9]{40}$/iu.test(revisions[0])) {
    throw new Error("ModelScope manifest did not resolve to one immutable commit.");
  }
  const resolvedRevision = revisions[0];
  return {
    requestedRevision,
    resolvedRevision,
    files: entries.map((entry) => ({
      path: entry.Path as string,
      size: typeof entry.Size === "number" ? entry.Size : null,
      expectedSha256: /^[a-f0-9]{64}$/iu.test(entry.Sha256 || "") ? entry.Sha256?.toLowerCase() : undefined,
      url: `https://www.modelscope.cn/models/${repository}/resolve/${resolvedRevision}/${encodeRemotePath(entry.Path as string)}`,
    })),
  };
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
  const requestedRevision = input.revision?.trim() || (provider === "modelscope" ? "master" : "main");
  const destination = path.resolve(required(input.destination, "destination"));
  const include = (input.include || []).filter(Boolean);
  const exclude = (input.exclude || []).filter(Boolean);
  const authentication = await verifyHubAuthentication(provider);
  const manifest = provider === "hugging-face"
    ? await resolveHuggingFaceFiles(repository, requestedRevision)
    : await resolveModelScopeFiles(repository, requestedRevision);
  const explicitFiles = new Set((input.files || []).map((value) => value.replace(/^\/+/, "")));
  const chosen = manifest.files.filter((file) =>
    (!explicitFiles.size || explicitFiles.has(file.path)) && selected(file.path, include, exclude),
  );
  if (!chosen.length) throw new Error("No repository files matched the transfer selection.");
  if (chosen.length > 2_000) throw new Error("Transfer selection exceeds the 2,000-file safety limit.");
  const files = chosen.map((file) => {
    const job = createModelAcquisitionJob({
      source: provider,
      modelId: `${repository}:${file.path}`,
      revision: manifest.resolvedRevision,
      destination: path.join(destination, file.path),
      bytesTotal: file.size || undefined,
      expectedSha256: file.expectedSha256,
      artifactUrl: file.url,
    });
    return { ...file, jobId: job.id };
  });
  const now = new Date().toISOString();
  const manifestDigest = sha256(JSON.stringify({
    provider,
    repository,
    requestedRevision,
    resolvedRevision: manifest.resolvedRevision,
    authentication: { verified: authentication.verified, subjectDigest: authentication.subjectDigest },
    files: chosen,
  }));
  const session: HubSession = {
    id: `hub-${sha256(`${provider}:${repository}:${manifest.resolvedRevision}:${destination}:${randomUUID()}`).slice(0, 20)}`,
    provider,
    repository,
    revision: manifest.resolvedRevision,
    requestedRevision,
    resolvedRevision: manifest.resolvedRevision,
    destination,
    include,
    exclude,
    files,
    authentication,
    manifestDigest,
    createdAt: now,
    updatedAt: now,
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
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: HUB_TRANSFER_SESSION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    capabilities: [
      "immutable-revision-resolution",
      "authenticated-identity-proof",
      "automatic-multi-file-manifest",
      "include-exclude",
      "range-resume",
      "private-token-redaction",
      "persistent-retry-backoff",
      "bounded-attempts",
      "final-checksum-provenance-receipt",
    ],
    providers: {
      huggingFace: { automaticManifest: true, tokenConfigured: Boolean(process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN) },
      modelScope: { automaticManifest: true, tokenConfigured: Boolean(process.env.MODELSCOPE_API_TOKEN || process.env.MODELSCOPE_TOKEN) },
    },
    sessions,
    receipts,
    latestPassing: receipts.find((entry) => entry.status === "pass") || null,
    paths: { sessions: STORE_FILE, receipts: RECEIPT_FILE },
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
  if (!nextFile?.jobId) {
    return { completed: true, session: readHubTransferSessions().sessions.find((entry) => entry.id === sessionId) };
  }
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

export function finalizeHubTransferSession(sessionId: string, requireAuthentication = true) {
  const session = readSessions().find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error("Hub transfer session was not found.");
  const jobs = new Map(readModelAcquisitionRegistry().jobs.map((job) => [job.id, job]));
  const resolvedRevision = session.resolvedRevision || session.revision;
  const authentication = session.authentication || { mode: "anonymous", tokenConfigured: false, verified: false };
  const files = session.files.map((file) => {
    const job = file.jobId ? jobs.get(file.jobId) : undefined;
    const expectedSha256 = file.expectedSha256 || job?.expectedSha256;
    const verifiedSha256 = job?.verifiedSha256;
    return {
      path: file.path,
      bytes: job?.bytesDownloaded || 0,
      expectedSha256,
      verifiedSha256,
      checksumMatched: Boolean(
        verifiedSha256 && (!expectedSha256 || expectedSha256.toLowerCase() === verifiedSha256.toLowerCase()),
      ),
      completedFile: job?.completedFile,
      status: job?.status,
    };
  });
  const checks = {
    immutableRevision: /^[a-f0-9]{40}$/iu.test(resolvedRevision),
    multiFile: files.length >= 2,
    authenticationVerified: !requireAuthentication || authentication.verified,
    allCompleted: files.every((file) => file.status === "completed" && Boolean(file.completedFile)),
    checksumsMaterialized: files.every((file) => /^[a-f0-9]{64}$/iu.test(file.verifiedSha256 || "")),
    expectedChecksumsMatched: files.every((file) => file.checksumMatched),
    destinationBound: files.every((file) => file.completedFile && path.resolve(file.completedFile).startsWith(`${path.resolve(session.destination)}${path.sep}`)),
    manifestBound: /^[a-f0-9]{64}$/u.test(session.manifestDigest || ""),
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `Hub receipt check failed: ${name}.`);
  const receipt: HubTransferReceipt = {
    schemaVersion: HUB_TRANSFER_RECEIPT_SCHEMA_VERSION,
    id: `hub-receipt-${randomUUID()}`,
    sessionId,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    provider: session.provider,
    repository: session.repository,
    requestedRevision: session.requestedRevision || session.revision,
    resolvedRevision,
    destination: session.destination,
    authentication,
    manifestDigest: session.manifestDigest || "",
    checks,
    totals: {
      files: files.length,
      completed: files.filter((file) => file.status === "completed").length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
      verifiedChecksums: files.filter((file) => /^[a-f0-9]{64}$/iu.test(file.verifiedSha256 || "")).length,
    },
    files: files.map(({ status: _status, ...file }) => file),
    blockers,
  };
  persistReceipt(receipt);
  return receipt;
}

export function resetHubTransferFileRetry(sessionId: string, jobId: string) {
  const session = readSessions().find((candidate) => candidate.id === sessionId);
  if (!session?.files.some((file) => file.jobId === jobId)) throw new Error("Hub transfer file was not found.");
  updateSessionFile(sessionId, jobId, { attempts: 0, lastError: undefined, nextRetryAt: undefined });
  return readHubTransferSessions().sessions.find((entry) => entry.id === sessionId);
}
