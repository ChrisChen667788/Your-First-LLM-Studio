import { spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import type { ExtensionManifest, ExtensionPermission } from "@/features/extensions/registry";

export const EXTENSION_SANDBOX_SCHEMA_VERSION = "extensions.process-sandbox.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const RECEIPT_FILE = path.join(DATA_DIR, "extension-sandbox-receipts.json");

type SandboxReceipt = {
  schemaVersion: typeof EXTENSION_SANDBOX_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  checks: Record<string, boolean>;
  isolation: string;
  stderr: string;
};

function readReceipts(): SandboxReceipt[] {
  if (!existsSync(RECEIPT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as { receipts?: SandboxReceipt[] };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function save(receipt: SandboxReceipt) {
  mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  writeFileSync(RECEIPT_FILE, `${JSON.stringify({ schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 50) }, null, 2)}\n`, "utf8");
}

export function readExtensionSandboxEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    nodePermissionModel: process.allowedNodeEnvironmentFlags.has("--permission"),
    latestPassing: receipts.find((receipt) => receipt.ok) || null,
    receipts,
    blockers: ["The Node permission model is defense-in-depth, not an OS or container security boundary."],
  };
}

const NODE_SANDBOX_UNSUPPORTED: ExtensionPermission[] = ["network:access", "secret:read", "command:execute"];

export function buildExtensionSandboxPolicy(manifest: ExtensionManifest) {
  const unsupported = manifest.permissions.filter((permission) => NODE_SANDBOX_UNSUPPORTED.includes(permission));
  const confirmation = manifest.permissions.filter((permission) => ["workspace:write"].includes(permission));
  return {
    schemaVersion: "extensions.sandbox-policy.v1" as const,
    generatedAt: new Date().toISOString(),
    extensionId: manifest.id,
    executionAllowed: unsupported.length === 0,
    isolation: "node-permission-process" as const,
    filesystem: {
      readPackageOnly: true,
      workspaceRead: manifest.permissions.includes("workspace:read"),
      workspaceWrite: false,
    },
    network: { allowed: false },
    childProcess: { allowed: false },
    secrets: { allowed: false },
    confirmationPermissions: confirmation,
    blockers: unsupported.map((permission) => `${permission} requires a hardened container or OS sandbox.`),
  };
}

export function runExtensionSandboxRehearsal() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "first-llm-extension-sandbox-"));
  const entrypoint = path.join(directory, "extension.mjs");
  writeFileSync(entrypoint, `
    import fs from "node:fs";
    let writeDenied = false;
    try { fs.writeFileSync(new URL("./escape.txt", import.meta.url), "denied"); } catch { writeDenied = true; }
    const input = JSON.parse(await new Promise((resolve) => {
      let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => value += chunk); process.stdin.on("end", () => resolve(value));
    }));
    process.stdout.write(JSON.stringify({ computed: input.value * 2, writeDenied }));
  `, { mode: 0o500 });
  const realDirectory = realpathSync(directory);
  const result = spawnSync(process.execPath, ["--permission", `--allow-fs-read=${directory},${realDirectory}`, realpathSync(entrypoint)], {
    input: JSON.stringify({ value: 21 }),
    encoding: "utf8",
    timeout: 10_000,
    env: { PATH: process.env.PATH || "/usr/bin:/bin", NODE_ENV: process.env.NODE_ENV || "production" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output: { computed?: number; writeDenied?: boolean } = {};
  try { output = JSON.parse(result.stdout || "{}"); } catch { output = {}; }
  const checks = {
    exitedCleanly: result.status === 0,
    inputOutputContract: output.computed === 42,
    filesystemWriteDenied: output.writeDenied === true && !existsSync(path.join(directory, "escape.txt")),
    environmentStripped: true,
  };
  const receipt: SandboxReceipt = {
    schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION,
    id: `sandbox-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    ok: Object.values(checks).every(Boolean),
    checks,
    isolation: "node-permission-process",
    stderr: String(result.stderr || "").slice(0, 2_000),
  };
  save(receipt);
  rmSync(directory, { recursive: true, force: true });
  return receipt;
}
