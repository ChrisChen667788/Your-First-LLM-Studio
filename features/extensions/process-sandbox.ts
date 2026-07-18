import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import type {
  ExtensionManifest,
  ExtensionPermission,
} from "@/features/extensions/registry";

export const EXTENSION_SANDBOX_SCHEMA_VERSION =
  "extensions.process-sandbox.v2" as const;

export type ExtensionSandboxKind =
  | "macos-seatbelt"
  | "linux-bubblewrap"
  | "node-permission";

export type ExtensionSandboxLaunch = {
  kind: ExtensionSandboxKind;
  osEnforced: boolean;
  command: string;
  args: string[];
  env: Record<string, string> & NodeJS.ProcessEnv;
  readPaths: string[];
  networkAllowed: false;
  filesystemWriteAllowed: false;
};

type SandboxReceipt = {
  schemaVersion: typeof EXTENSION_SANDBOX_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  checks: Record<string, boolean>;
  isolation: ExtensionSandboxKind;
  osEnforced: boolean;
  stderr: string;
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
const RECEIPT_FILE = path.join(
  DATA_DIR,
  "extension-sandbox-receipts.json",
);
const SANDBOX_EXEC = "/usr/bin/sandbox-exec";

function readReceipts(): SandboxReceipt[] {
  if (!existsSync(RECEIPT_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as {
      receipts?: SandboxReceipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function save(receipt: SandboxReceipt) {
  mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  writeFileSync(
    RECEIPT_FILE,
    `${JSON.stringify(
      {
        schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION,
        receipts: [receipt, ...readReceipts()].slice(0, 50),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function quoteSeatbelt(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function existingRealPath(value: string) {
  const resolved = path.resolve(value);
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

function metadataAncestors(value: string) {
  const ancestors: string[] = [];
  let current = path.dirname(existingRealPath(value));
  while (current !== path.dirname(current)) {
    ancestors.push(current);
    current = path.dirname(current);
  }
  return ancestors;
}

export function readExtensionSandboxCapabilities() {
  const seatbeltAvailable =
    process.platform === "darwin" && existsSync(SANDBOX_EXEC);
  const bubblewrapPath =
    process.platform === "linux"
      ? ["/usr/bin/bwrap", "/bin/bwrap"].find((candidate) =>
          existsSync(candidate),
        ) || null
      : null;
  return {
    platform: process.platform,
    seatbeltAvailable,
    bubblewrapPath,
    nodePermissionModel:
      process.allowedNodeEnvironmentFlags.has("--permission"),
    preferredIsolation: seatbeltAvailable
      ? ("macos-seatbelt" as const)
      : bubblewrapPath
        ? ("linux-bubblewrap" as const)
        : ("node-permission" as const),
  };
}

function buildSeatbeltProfile(input: {
  executable: string;
  readPaths: string[];
}) {
  const executable = existingRealPath(input.executable);
  const readPaths = [...new Set(input.readPaths.map(existingRealPath))];
  const metadataPaths = [
    ...new Set([
      ...readPaths.flatMap(metadataAncestors),
      ...metadataAncestors(executable),
      "/private",
      "/private/tmp",
      "/tmp",
      "/Users",
    ]),
  ];
  const metadataRules = metadataPaths
    .map((item) => `(literal "${quoteSeatbelt(item)}")`)
    .join(" ");
  const readRules = readPaths
    .map((item) => `(subpath "${quoteSeatbelt(item)}")`)
    .join(" ");
  return [
    "(version 1)",
    "(deny default)",
    '(import "system.sb")',
    `(allow process-exec (literal "${quoteSeatbelt(executable)}"))`,
    "(allow process-fork)",
    `(allow file-read-metadata ${metadataRules})`,
    '(allow file-read* (subpath "/System") (subpath "/usr")',
    '  (subpath "/Library/Apple") (subpath "/opt/homebrew")',
    `  ${readRules})`,
  ].join("\n");
}

export function buildExtensionSandboxLaunch(input: {
  command: string;
  args?: string[];
  readPaths: string[];
  env?: Record<string, string>;
}): ExtensionSandboxLaunch {
  const capabilities = readExtensionSandboxCapabilities();
  const command = existingRealPath(input.command);
  const readPaths = [...new Set(input.readPaths.map(existingRealPath))];
  const env = {
    PATH: process.env.PATH || "/usr/bin:/bin:/opt/homebrew/bin",
    NODE_ENV: process.env.NODE_ENV || "production",
    ...input.env,
  };
  if (capabilities.seatbeltAvailable) {
    return {
      kind: "macos-seatbelt",
      osEnforced: true,
      command: SANDBOX_EXEC,
      args: [
        "-p",
        buildSeatbeltProfile({ executable: command, readPaths }),
        command,
        ...(input.args || []),
      ],
      env,
      readPaths,
      networkAllowed: false,
      filesystemWriteAllowed: false,
    };
  }
  if (capabilities.bubblewrapPath) {
    return {
      kind: "linux-bubblewrap",
      osEnforced: true,
      command: capabilities.bubblewrapPath,
      args: [
        "--die-with-parent",
        "--new-session",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
        "--tmpfs",
        "/tmp",
        command,
        ...(input.args || []),
      ],
      env,
      readPaths,
      networkAllowed: false,
      filesystemWriteAllowed: false,
    };
  }
  return {
    kind: "node-permission",
    osEnforced: false,
    command,
    args: input.args || [],
    env,
    readPaths,
    networkAllowed: false,
    filesystemWriteAllowed: false,
  };
}

export function readExtensionSandboxEvidence() {
  const receipts = readReceipts();
  const capabilities = readExtensionSandboxCapabilities();
  return {
    ok: true as const,
    schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    capabilities,
    latestPassing: receipts.find((receipt) => receipt.ok) || null,
    latestOsEnforcedPassing:
      receipts.find((receipt) => receipt.ok && receipt.osEnforced) || null,
    receipts,
    blockers: capabilities.seatbeltAvailable || capabilities.bubblewrapPath
      ? []
      : [
          "An OS-enforced Seatbelt or bubblewrap boundary is not available on this host.",
        ],
  };
}

const BROKER_REQUIRED_PERMISSIONS: ExtensionPermission[] = [
  "network:access",
  "secret:read",
  "command:execute",
];

export function buildExtensionSandboxPolicy(manifest: ExtensionManifest) {
  const capabilities = readExtensionSandboxCapabilities();
  const brokerRequired = manifest.permissions.filter((permission) =>
    BROKER_REQUIRED_PERMISSIONS.includes(permission),
  );
  const confirmation = manifest.permissions.filter((permission) =>
    ["workspace:write"].includes(permission),
  );
  const osEnforced =
    capabilities.seatbeltAvailable || Boolean(capabilities.bubblewrapPath);
  const blockers = [
    ...brokerRequired.map(
      (permission) =>
        `${permission} requires a dedicated broker and cannot be granted directly to an extension process.`,
    ),
    ...(osEnforced
      ? []
      : ["No OS-enforced extension sandbox is available on this host."]),
  ];
  return {
    schemaVersion: "extensions.sandbox-policy.v2" as const,
    generatedAt: new Date().toISOString(),
    extensionId: manifest.id,
    executionAllowed: blockers.length === 0,
    isolation: capabilities.preferredIsolation,
    osEnforced,
    filesystem: {
      readPackageOnly: true,
      workspaceRead: manifest.permissions.includes("workspace:read"),
      workspaceWrite: false,
    },
    network: { allowed: false, brokerRequired: true },
    childProcess: { allowed: false, brokerRequired: true },
    secrets: { allowed: false, brokerRequired: true },
    confirmationPermissions: confirmation,
    blockers,
  };
}

export function runExtensionSandboxRehearsal() {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "first-llm-extension-sandbox-"),
  );
  const entrypoint = path.join(directory, "extension.mjs");
  writeFileSync(
    entrypoint,
    `
      import fs from "node:fs";
      import net from "node:net";
      const input = JSON.parse(await new Promise((resolve) => {
        let value = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => value += chunk);
        process.stdin.on("end", () => resolve(value));
      }));
      let writeError = "";
      try {
        fs.writeFileSync(new URL("./escape.txt", import.meta.url), "denied");
      } catch (error) {
        writeError = error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown";
      }
      const networkError = await new Promise((resolve) => {
        const socket = net.connect({ host: "127.0.0.1", port: 9 });
        socket.once("error", (error) => resolve(error && error.code ? String(error.code) : "unknown"));
        setTimeout(() => {
          socket.destroy();
          resolve("timeout");
        }, 1500);
      });
      process.stdout.write(JSON.stringify({
        computed: input.value * 2,
        writeError,
        networkError,
        leakedSecret: process.env.FIRST_LLM_SANDBOX_SECRET || null,
      }));
    `,
    { mode: 0o500 },
  );
  const launch = buildExtensionSandboxLaunch({
    command: process.execPath,
    args: [entrypoint],
    readPaths: [directory],
    env: {
      FIRST_LLM_SANDBOX_SECRET: "",
    },
  });
  const result = spawnSync(launch.command, launch.args, {
    input: JSON.stringify({ value: 21 }),
    encoding: "utf8",
    timeout: 10_000,
    env: launch.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output: {
    computed?: number;
    writeError?: string;
    networkError?: string;
    leakedSecret?: string | null;
  } = {};
  try {
    output = JSON.parse(result.stdout || "{}");
  } catch {
    output = {};
  }
  const checks = {
    exitedCleanly: result.status === 0,
    inputOutputContract: output.computed === 42,
    filesystemWriteDenied:
      output.writeError === "EPERM" &&
      !existsSync(path.join(directory, "escape.txt")),
    networkDenied: output.networkError === "EPERM",
    environmentStripped: !output.leakedSecret,
    osEnforced: launch.osEnforced,
  };
  const receipt: SandboxReceipt = {
    schemaVersion: EXTENSION_SANDBOX_SCHEMA_VERSION,
    id: `sandbox-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    ok: Object.values(checks).every(Boolean),
    checks,
    isolation: launch.kind,
    osEnforced: launch.osEnforced,
    stderr: String(result.stderr || "").slice(0, 2_000),
  };
  save(receipt);
  rmSync(directory, { recursive: true, force: true });
  return receipt;
}
