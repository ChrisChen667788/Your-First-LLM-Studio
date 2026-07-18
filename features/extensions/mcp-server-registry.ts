import { createHash, randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import type { ExtensionPermission } from "@/features/extensions/registry";

export const MCP_SERVER_REGISTRY_SCHEMA_VERSION =
  "extensions.mcp-server-registry.v1" as const;

export type McpServerRegistration = {
  id: string;
  name: string;
  state: "enabled" | "disabled" | "quarantined";
  source: {
    registry: "npm";
    packageName: string;
    packageVersion: string;
    packageIntegrity: string;
    entrypoint: string;
    entrypointDigest: string;
  };
  transport: {
    kind: "stdio";
    command: string;
    args: string[];
    roots: string[];
    environmentKeys: string[];
  };
  permissions: ExtensionPermission[];
  sandboxRequired: true;
  registeredAt: string;
  updatedAt: string;
  lastProbe: {
    status: "pass" | "failed";
    probedAt: string;
    toolCount: number;
    readOnlyTools: number;
    destructiveTools: number;
    error: string | null;
  } | null;
};

type RegistryReceipt = {
  id: string;
  generatedAt: string;
  action: "register" | "enable" | "disable" | "probe";
  serverId: string;
  status: "pass" | "failed";
  summary: string;
};

type RegistryStore = {
  schemaVersion: typeof MCP_SERVER_REGISTRY_SCHEMA_VERSION;
  servers: McpServerRegistration[];
  receipts: RegistryReceipt[];
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
const STORE_FILE = path.join(DATA_DIR, "mcp-server-registry.json");
export const MCP_FILESYSTEM_ACCEPTANCE_ROOT = path.join(
  DATA_DIR,
  "mcp-filesystem-acceptance-root",
);
const FILESYSTEM_PACKAGE = "@modelcontextprotocol/server-filesystem";
const FILESYSTEM_SERVER_ID =
  "io.github.modelcontextprotocol/server-filesystem";

function emptyStore(): RegistryStore {
  return {
    schemaVersion: MCP_SERVER_REGISTRY_SCHEMA_VERSION,
    servers: [],
    receipts: [],
  };
}

function readStore(): RegistryStore {
  if (!existsSync(STORE_FILE)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<
      RegistryStore
    >;
    return {
      schemaVersion: MCP_SERVER_REGISTRY_SCHEMA_VERSION,
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: RegistryStore) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function sha256File(filePath: string) {
  return createHash("sha256")
    .update(readFileSync(filePath))
    .digest("hex");
}

function resolveFilesystemPackage() {
  const packageRoot = path.resolve(
    process.cwd(),
    "node_modules",
    "@modelcontextprotocol",
    "server-filesystem",
  );
  const packageJsonPath = path.join(packageRoot, "package.json");
  const entrypoint = path.join(packageRoot, "dist", "index.js");
  if (!existsSync(packageJsonPath) || !existsSync(entrypoint)) {
    throw new Error(
      `${FILESYSTEM_PACKAGE} is not installed in the application dependency tree.`,
    );
  }
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as {
    name?: string;
    version?: string;
    mcpName?: string;
    bin?: Record<string, string>;
  };
  if (
    packageJson.name !== FILESYSTEM_PACKAGE ||
    !packageJson.version ||
    packageJson.mcpName !== FILESYSTEM_SERVER_ID ||
    packageJson.bin?.["mcp-server-filesystem"] !== "dist/index.js"
  ) {
    throw new Error("Installed filesystem MCP package metadata is invalid.");
  }
  const lock = JSON.parse(
    readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"),
  ) as {
    packages?: Record<string, { version?: string; integrity?: string }>;
  };
  const lockEntry =
    lock.packages?.[
      "node_modules/@modelcontextprotocol/server-filesystem"
    ];
  if (
    lockEntry?.version !== packageJson.version ||
    !lockEntry.integrity?.startsWith("sha512-")
  ) {
    throw new Error(
      "Filesystem MCP package is not bound to a lockfile integrity receipt.",
    );
  }
  return {
    packageRoot: realpathSync(packageRoot),
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    packageIntegrity: lockEntry.integrity,
    entrypoint: realpathSync(entrypoint),
    entrypointDigest: sha256File(entrypoint),
  };
}

function validateRoot(root: string) {
  const resolved = path.resolve(root);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error("MCP filesystem root must be an existing directory.");
  }
  return realpathSync(resolved);
}

function receipt(
  action: RegistryReceipt["action"],
  serverId: string,
  summary: string,
  status: RegistryReceipt["status"] = "pass",
): RegistryReceipt {
  return {
    id: `mcp-registry-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    action,
    serverId,
    status,
    summary,
  };
}

export function registerPinnedFilesystemMcpServer(root: string) {
  const packageInfo = resolveFilesystemPackage();
  const allowedRoot = validateRoot(root);
  const store = readStore();
  const existing = store.servers.find(
    (entry) => entry.id === FILESYSTEM_SERVER_ID,
  );
  const now = new Date().toISOString();
  const registration: McpServerRegistration = {
    id: FILESYSTEM_SERVER_ID,
    name: "Official filesystem MCP server",
    state: "enabled",
    source: {
      registry: "npm",
      packageName: packageInfo.packageName,
      packageVersion: packageInfo.packageVersion,
      packageIntegrity: packageInfo.packageIntegrity,
      entrypoint: packageInfo.entrypoint,
      entrypointDigest: packageInfo.entrypointDigest,
    },
    transport: {
      kind: "stdio",
      command: process.execPath,
      args: [packageInfo.entrypoint, allowedRoot],
      roots: [allowedRoot],
      environmentKeys: ["PATH", "NODE_ENV"],
    },
    permissions: ["workspace:read"],
    sandboxRequired: true,
    registeredAt: existing?.registeredAt || now,
    updatedAt: now,
    lastProbe: existing?.lastProbe || null,
  };
  const nextReceipt = receipt(
    "register",
    registration.id,
    `Registered ${registration.source.packageName}@${registration.source.packageVersion} from a pinned npm integrity record.`,
  );
  writeStore({
    schemaVersion: MCP_SERVER_REGISTRY_SCHEMA_VERSION,
    servers: [
      registration,
      ...store.servers.filter((entry) => entry.id !== registration.id),
    ],
    receipts: [nextReceipt, ...store.receipts].slice(0, 200),
  });
  return { registration, receipt: nextReceipt, packageRoot: packageInfo.packageRoot };
}

export function setMcpServerEnabled(serverId: string, enabled: boolean) {
  const store = readStore();
  const current = store.servers.find((entry) => entry.id === serverId);
  if (!current) throw new Error("MCP server registration was not found.");
  const next: McpServerRegistration = {
    ...current,
    state: enabled ? "enabled" : "disabled",
    updatedAt: new Date().toISOString(),
  };
  const nextReceipt = receipt(
    enabled ? "enable" : "disable",
    serverId,
    `${enabled ? "Enabled" : "Disabled"} ${serverId}.`,
  );
  writeStore({
    ...store,
    servers: store.servers.map((entry) =>
      entry.id === serverId ? next : entry,
    ),
    receipts: [nextReceipt, ...store.receipts].slice(0, 200),
  });
  return nextReceipt;
}

export function recordMcpServerProbe(
  serverId: string,
  probe: NonNullable<McpServerRegistration["lastProbe"]>,
) {
  const store = readStore();
  const current = store.servers.find((entry) => entry.id === serverId);
  if (!current) throw new Error("MCP server registration was not found.");
  const nextReceipt = receipt(
    "probe",
    serverId,
    probe.status === "pass"
      ? `Discovered ${probe.toolCount} MCP tools through stdio.`
      : probe.error || "MCP server probe failed.",
    probe.status,
  );
  writeStore({
    ...store,
    servers: store.servers.map((entry) =>
      entry.id === serverId
        ? { ...entry, lastProbe: probe, updatedAt: probe.probedAt }
        : entry,
    ),
    receipts: [nextReceipt, ...store.receipts].slice(0, 200),
  });
  return nextReceipt;
}

export function readMcpServerRegistry() {
  const store = readStore();
  return {
    ok: true as const,
    ...store,
    generatedAt: new Date().toISOString(),
    totals: {
      registered: store.servers.length,
      enabled: store.servers.filter((entry) => entry.state === "enabled")
        .length,
      passing: store.servers.filter(
        (entry) => entry.lastProbe?.status === "pass",
      ).length,
      stdio: store.servers.filter(
        (entry) => entry.transport.kind === "stdio",
      ).length,
    },
    path: STORE_FILE,
  };
}
