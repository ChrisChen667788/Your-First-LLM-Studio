import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const MODEL_SOURCE_MANIFEST_SCHEMA_VERSION = "models.source-manifest.v1" as const;
type Source = "hugging-face" | "modelscope";
type FileEntry = { path: string; bytes: number; sha256: string; url: string };
type Receipt = { id: string; generatedAt: string; status: "pass" | "hold"; source: Source; modelId: string; revision: string; tokenConfigured: boolean; files: FileEntry[]; manifestDigest: string; checks: Record<string, boolean>; blockers: string[]; warning: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "model-source-manifests.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: MODEL_SOURCE_MANIFEST_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 200) }, null, 2)}\n`, "utf8"); }
function safeFilePath(value: string) { return Boolean(value) && !path.isAbsolute(value) && !value.split(/[\\/]/u).includes(".."); }
function stableDigest(input: unknown) { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); }

export function materializeModelSourceManifest(input: { source: Source; modelId: string; revision: string; token?: string; files: FileEntry[] }) {
  const tokenConfigured = Boolean(input.token?.trim());
  const checks = {
    authenticated: tokenConfigured,
    immutableRevision: Boolean(input.revision.trim()) && input.revision !== "main" && input.revision !== "master",
    multiFile: input.files.length >= 2,
    safePaths: input.files.every((entry) => safeFilePath(entry.path)),
    checksumsPresent: input.files.every((entry) => /^[a-f0-9]{64}$/u.test(entry.sha256) && entry.bytes > 0),
    httpsOnly: input.files.every((entry) => { try { return new URL(entry.url).protocol === "https:"; } catch { return false; } }),
  };
  const blockers = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `Source manifest check failed: ${name}.`);
  const publicManifest = { source: input.source, modelId: input.modelId.trim(), revision: input.revision.trim(), tokenConfigured, files: input.files };
  const receipt: Receipt = { id: `source-manifest-${randomUUID()}`, generatedAt: new Date().toISOString(), status: blockers.length ? "hold" : "pass", ...publicManifest, manifestDigest: stableDigest(publicManifest), checks, blockers, warning: "Authentication shape is verified without contacting the hub; no token value is persisted." };
  persist(receipt); return receipt;
}

export function rehearseModelSourceManifest() {
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  return materializeModelSourceManifest({ source: "hugging-face", modelId: "Qwen/Qwen3-4B", revision: "0123456789abcdef0123456789abcdef01234567", token: "rehearsal-token-not-persisted", files: [
    { path: "config.json", bytes: 2048, sha256: digest("config"), url: "https://huggingface.co/Qwen/Qwen3-4B/resolve/revision/config.json" },
    { path: "model-00001-of-00002.safetensors", bytes: 2_000_000_000, sha256: digest("weight-1"), url: "https://huggingface.co/Qwen/Qwen3-4B/resolve/revision/model-00001-of-00002.safetensors" },
    { path: "model-00002-of-00002.safetensors", bytes: 1_800_000_000, sha256: digest("weight-2"), url: "https://huggingface.co/Qwen/Qwen3-4B/resolve/revision/model-00002-of-00002.safetensors" },
  ] });
}

export function readModelSourceManifestEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: MODEL_SOURCE_MANIFEST_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, security: { tokenValuesPersisted: false }, path: STORE_FILE }; }
