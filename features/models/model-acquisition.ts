import { createHash, randomUUID } from "crypto";
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  statSync,
  rmSync,
  writeFileSync,
} from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";

export const MODEL_ACQUISITION_SCHEMA_VERSION = "models.acquisition-registry.v1" as const;

export type ModelAcquisitionStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "verifying"
  | "completed"
  | "cancelled"
  | "failed";

export type ModelAcquisitionJob = {
  id: string;
  source: "hugging-face" | "modelscope" | "ollama" | "url";
  modelId: string;
  revision: string;
  destination: string;
  status: ModelAcquisitionStatus;
  bytesDownloaded: number;
  bytesTotal: number | null;
  expectedSha256?: string;
  verifiedSha256?: string;
  artifactUrl?: string;
  partFile?: string;
  completedFile?: string;
  etag?: string;
  lastRange?: string;
  resumeToken: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

type ModelAcquisitionRegistry = {
  schemaVersion: typeof MODEL_ACQUISITION_SCHEMA_VERSION;
  jobs: ModelAcquisitionJob[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REGISTRY_FILE = path.join(DATA_DIR, "model-acquisition-registry.json");

function readRegistry(): ModelAcquisitionRegistry {
  if (!existsSync(REGISTRY_FILE)) {
    return { schemaVersion: MODEL_ACQUISITION_SCHEMA_VERSION, jobs: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as Partial<ModelAcquisitionRegistry>;
    return {
      schemaVersion: MODEL_ACQUISITION_SCHEMA_VERSION,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { schemaVersion: MODEL_ACQUISITION_SCHEMA_VERSION, jobs: [] };
  }
}

function writeRegistry(registry: ModelAcquisitionRegistry) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function requiredText(value: unknown, name: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${name} is required.`);
  return text;
}

function allowedModelRoots() {
  return [
    process.env.LOCAL_MODEL_DIR,
    path.join(os.homedir(), ".lmstudio", "models"),
    path.join(DATA_DIR, "model-downloads"),
    "/Volumes",
    ...(process.env.FIRST_LLM_MODEL_ALLOWED_ROOTS || "").split(path.delimiter),
    ...(process.env.NODE_ENV === "production" ? [] : [os.tmpdir()]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => path.resolve(value));
}

function assertAllowedDestination(destination: string) {
  const resolved = path.resolve(destination);
  const allowed = allowedModelRoots().some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`),
  );
  if (!allowed) {
    throw new Error("destination is outside the allowed model storage roots.");
  }
  return resolved;
}

function normalizeArtifactUrl(value: unknown) {
  const text = requiredText(value, "artifactUrl");
  const url = new URL(text);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("artifactUrl must use http or https.");
  }
  return url.toString();
}

function replaceJob(registry: ModelAcquisitionRegistry, next: ModelAcquisitionJob) {
  writeRegistry({
    ...registry,
    jobs: registry.jobs.map((job) => (job.id === next.id ? next : job)),
  });
}

async function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function curlArtifactChunk(input: { url: string; start: number; end: number; timeoutMs: number; token?: string }) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-curl-transfer-"));
  const bodyFile = path.join(directory, "body.bin");
  const headerFile = path.join(directory, "headers.txt");
  try {
    const token = input.token?.trim() || "";
    if (/[\r\n"]/u.test(token)) throw new Error("Hub token contains unsupported characters.");
    const config = token ? `header = "Authorization: Bearer ${token}"\n` : "";
    const commonArgs = [
      "--config", "-", "--silent", "--show-error", "--location", "--fail-with-body",
      "--max-time", String(Math.ceil(input.timeoutMs / 1_000)),
      "--dump-header", headerFile,
      "--output", bodyFile,
      "--write-out", "%{http_code}",
    ];
    const options = { input: config, encoding: "utf8" as const, timeout: input.timeoutMs + 5_000, maxBuffer: 2 * 1024 * 1024 };
    let statusText: string;
    try {
      statusText = execFileSync("/usr/bin/curl", [...commonArgs, "--range", `${input.start}-${input.end}`, input.url], options);
    } catch (error) {
      if (input.start !== 0) throw error;
      statusText = execFileSync("/usr/bin/curl", [...commonArgs, "--max-filesize", String(input.end + 1), input.url], options);
    }
    const headersText = readFileSync(headerFile, "utf8");
    const blocks = headersText.split(/\r?\n\r?\n/).filter((block) => /^HTTP\//m.test(block));
    const finalHeaders = blocks.at(-1) || "";
    const headers = new Map<string, string>();
    finalHeaders.split(/\r?\n/).slice(1).forEach((line) => {
      const separator = line.indexOf(":");
      if (separator > 0) headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
    });
    return { status: Number(statusText), bytes: readFileSync(bodyFile), headers };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function readModelAcquisitionRegistry() {
  const registry = readRegistry();
  return {
    ok: true as const,
    schemaVersion: MODEL_ACQUISITION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    capabilities: [
      "pause-resume-contract",
      "checksum-verification",
      "external-disk-destination",
      "idempotent-job-identity",
      "bounded-range-transfer",
      "sha256-materialization",
    ],
    jobs: registry.jobs,
    totals: {
      jobs: registry.jobs.length,
      active: registry.jobs.filter((job) => ["queued", "downloading", "verifying"].includes(job.status)).length,
      paused: registry.jobs.filter((job) => job.status === "paused").length,
      completed: registry.jobs.filter((job) => job.status === "completed").length,
      failed: registry.jobs.filter((job) => job.status === "failed").length,
    },
    paths: { registry: REGISTRY_FILE },
  };
}

export function createModelAcquisitionJob(input: {
  source?: ModelAcquisitionJob["source"];
  modelId?: string;
  revision?: string;
  destination?: string;
  expectedSha256?: string;
  bytesTotal?: number;
  artifactUrl?: string;
}) {
  const modelId = requiredText(input.modelId, "modelId");
  const destination = assertAllowedDestination(requiredText(input.destination, "destination"));
  const revision = input.revision?.trim() || "main";
  const source = input.source || "hugging-face";
  const registry = readRegistry();
  const identity = createHash("sha256")
    .update(`${source}:${modelId}:${revision}:${destination}`)
    .digest("hex")
    .slice(0, 20);
  const existing = registry.jobs.find(
    (job) => job.id === identity && job.status !== "cancelled",
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const job: ModelAcquisitionJob = {
    id: identity,
    source,
    modelId,
    revision,
    destination,
    status: "queued",
    bytesDownloaded: 0,
    bytesTotal:
      typeof input.bytesTotal === "number" && input.bytesTotal > 0
        ? Math.round(input.bytesTotal)
        : null,
    expectedSha256: input.expectedSha256?.trim() || undefined,
    artifactUrl: input.artifactUrl ? normalizeArtifactUrl(input.artifactUrl) : undefined,
    partFile: `${destination}.part`,
    resumeToken: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  writeRegistry({ ...registry, jobs: [job, ...registry.jobs].slice(0, 200) });
  return job;
}

export function updateModelAcquisitionJob(input: {
  jobId?: string;
  action: "start" | "pause" | "resume" | "cancel";
}) {
  const jobId = requiredText(input.jobId, "jobId");
  const registry = readRegistry();
  const target = registry.jobs.find((job) => job.id === jobId);
  if (!target) throw new Error("Model acquisition job was not found.");
  const allowed: Record<typeof input.action, ModelAcquisitionStatus[]> = {
    start: ["queued", "paused", "failed"],
    pause: ["downloading"],
    resume: ["paused", "failed"],
    cancel: ["queued", "downloading", "paused", "verifying"],
  };
  if (!allowed[input.action].includes(target.status)) {
    throw new Error(`Cannot ${input.action} a ${target.status} acquisition job.`);
  }
  const status: ModelAcquisitionStatus =
    input.action === "pause"
      ? "paused"
      : input.action === "cancel"
        ? "cancelled"
        : "downloading";
  const next = { ...target, status, error: undefined, updatedAt: new Date().toISOString() };
  writeRegistry({
    ...registry,
    jobs: registry.jobs.map((job) => (job.id === jobId ? next : job)),
  });
  return next;
}

export async function runModelAcquisitionTransferStep(input: {
  jobId?: string;
  chunkBytes?: number;
  timeoutMs?: number;
}) {
  const jobId = requiredText(input.jobId, "jobId");
  const registry = readRegistry();
  const target = registry.jobs.find((job) => job.id === jobId);
  if (!target) throw new Error("Model acquisition job was not found.");
  if (target.status === "paused") throw new Error("Resume the acquisition job before transferring bytes.");
  if (!target.artifactUrl) throw new Error("Model acquisition job has no artifactUrl.");
  if (!["queued", "downloading"].includes(target.status)) {
    throw new Error(`Cannot transfer bytes for a ${target.status} acquisition job.`);
  }
  const chunkBytes = Math.round(Math.max(64 * 1024, Math.min(input.chunkBytes || 8 * 1024 * 1024, 64 * 1024 * 1024)));
  const destination = assertAllowedDestination(target.destination);
  const partFile = target.partFile || `${destination}.part`;
  mkdirSync(path.dirname(destination), { recursive: true });
  const start = existsSync(partFile) ? statSync(partFile).size : 0;
  const end = start + chunkBytes - 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Math.min(input.timeoutMs || 60_000, 300_000)));
  try {
    const authorizationToken = target.source === "hugging-face"
      ? process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN
      : target.source === "modelscope" ? process.env.MODELSCOPE_API_TOKEN : undefined;
    let responseStatus = 0;
    let responseHeaders = new Map<string, string>();
    let bytes: Buffer;
    try {
      const response = await fetch(target.artifactUrl, {
        headers: {
        Range: `bytes=${start}-${end}`,
          ...(authorizationToken ? { Authorization: `Bearer ${authorizationToken}` } : {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      responseStatus = response.status;
      response.headers.forEach((value, key) => responseHeaders.set(key.toLowerCase(), value));
      bytes = Buffer.from(await response.arrayBuffer());
    } catch {
      const curl = curlArtifactChunk({ url: target.artifactUrl, start, end, timeoutMs: input.timeoutMs || 60_000, token: authorizationToken });
      responseStatus = curl.status;
      responseHeaders = curl.headers;
      bytes = curl.bytes;
    }
    if (responseStatus !== 200 && responseStatus !== 206) {
      throw new Error(`Artifact server returned HTTP ${responseStatus}.`);
    }
    if (start > 0 && responseStatus !== 206) {
      throw new Error("Artifact server does not support HTTP Range resume.");
    }
    const declaredLength = Number(responseHeaders.get("content-length") || 0);
    if (declaredLength > chunkBytes) {
      throw new Error("Artifact server exceeded the bounded transfer chunk.");
    }
    if (!bytes.length) throw new Error("Artifact server returned an empty transfer chunk.");
    if (bytes.length > chunkBytes) throw new Error("Transfer chunk exceeded the configured byte limit.");
    appendFileSync(partFile, bytes);
    const bytesDownloaded = start + bytes.length;
    const contentRange = responseHeaders.get("content-range") || undefined;
    const rangeMatch = contentRange?.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
    const rangeTotal = rangeMatch?.[3] && rangeMatch[3] !== "*" ? Number(rangeMatch[3]) : null;
    const bytesTotal = rangeTotal || target.bytesTotal || (responseStatus === 200 ? declaredLength || bytesDownloaded : null);
    const etag = responseHeaders.get("etag") || target.etag;
    let next: ModelAcquisitionJob = {
      ...target,
      status: "downloading",
      bytesDownloaded,
      bytesTotal,
      partFile,
      etag,
      lastRange: contentRange || `bytes ${start}-${bytesDownloaded - 1}/${bytesTotal || "*"}`,
      updatedAt: new Date().toISOString(),
      error: undefined,
    };
    if (bytesTotal !== null && bytesDownloaded >= bytesTotal) {
      next = { ...next, status: "verifying" };
      replaceJob(registry, next);
      const verifiedSha256 = await sha256File(partFile);
      if (target.expectedSha256 && target.expectedSha256.toLowerCase() !== verifiedSha256) {
        next = {
          ...next,
          status: "failed",
          verifiedSha256,
          error: `SHA-256 mismatch: expected ${target.expectedSha256}, received ${verifiedSha256}.`,
          updatedAt: new Date().toISOString(),
        };
        replaceJob(readRegistry(), next);
        throw new Error(next.error);
      }
      renameSync(partFile, destination);
      next = {
        ...next,
        status: "completed",
        verifiedSha256,
        completedFile: destination,
        partFile: undefined,
        updatedAt: new Date().toISOString(),
      };
    }
    replaceJob(readRegistry(), next);
    return next;
  } catch (error) {
    const current = readRegistry().jobs.find((job) => job.id === jobId) || target;
    const failed: ModelAcquisitionJob = {
      ...current,
      status: current.status === "completed" ? "completed" : "failed",
      error: error instanceof Error ? error.message : "Model transfer failed.",
      updatedAt: new Date().toISOString(),
    };
    if (failed.status !== "completed") replaceJob(readRegistry(), failed);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
