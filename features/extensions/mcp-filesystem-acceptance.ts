import { createHash, randomUUID } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildExtensionSandboxLaunch } from "@/features/extensions/process-sandbox";
import {
  MCP_FILESYSTEM_ACCEPTANCE_ROOT,
  recordMcpServerProbe,
  registerPinnedFilesystemMcpServer,
} from "@/features/extensions/mcp-server-registry";

export const MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION =
  "extensions.mcp-filesystem-acceptance.v1" as const;

type McpFilesystemAcceptanceReceipt = {
  id: string;
  schemaVersion: typeof MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION;
  generatedAt: string;
  status: "pass" | "hold";
  server: {
    id: string;
    packageName: string;
    packageVersion: string;
    packageIntegrity: string;
    entrypointDigest: string;
    transport: "stdio";
  };
  sandbox: {
    kind: string;
    osEnforced: boolean;
    networkAllowed: false;
    filesystemWriteAllowed: false;
  };
  capabilities: {
    tools: number;
    readOnlyTools: number;
    destructiveTools: number;
  };
  checks: Record<string, boolean>;
  marker: string;
  stderr: string;
  error: string | null;
  evidenceDigest: string;
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
const STORE_FILE = path.join(DATA_DIR, "mcp-filesystem-acceptance.json");

function readReceipts(): McpFilesystemAcceptanceReceipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as {
      receipts?: McpFilesystemAcceptanceReceipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: McpFilesystemAcceptanceReceipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    STORE_FILE,
    `${JSON.stringify(
      {
        schemaVersion: MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION,
        receipts: [receipt, ...readReceipts()].slice(0, 50),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function textContent(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const candidate = item as { type?: string; text?: string };
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

export async function runMcpFilesystemAcceptance() {
  mkdirSync(MCP_FILESYSTEM_ACCEPTANCE_ROOT, { recursive: true });
  const marker = "FIRST_LLM_STUDIO_MCP_V130";
  const markerPath = path.join(
    MCP_FILESYSTEM_ACCEPTANCE_ROOT,
    "acceptance-marker.txt",
  );
  const blockedWritePath = path.join(
    MCP_FILESYSTEM_ACCEPTANCE_ROOT,
    "sandbox-write-must-not-exist.txt",
  );
  writeFileSync(markerPath, `${marker}\n`, "utf8");
  const registrationResult = registerPinnedFilesystemMcpServer(
    MCP_FILESYSTEM_ACCEPTANCE_ROOT,
  );
  const registration = registrationResult.registration;
  const launch = buildExtensionSandboxLaunch({
    command: registration.transport.command,
    args: registration.transport.args,
    readPaths: [
      path.join(process.cwd(), "node_modules"),
      ...registration.transport.roots,
    ],
  });
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    env: launch.env,
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({
    name: "first-llm-studio-runtime",
    version: "1.3.0",
  });
  let toolCount = 0;
  let readOnlyTools = 0;
  let destructiveTools = 0;
  let connected = false;
  let closedCleanly = false;
  let rootBound = false;
  let markerRead = false;
  let writeDenied = false;
  let error: string | null = null;
  try {
    await client.connect(transport);
    connected = true;
    const tools = await client.listTools();
    toolCount = tools.tools.length;
    readOnlyTools = tools.tools.filter(
      (tool) => tool.annotations?.readOnlyHint === true,
    ).length;
    destructiveTools = tools.tools.filter(
      (tool) => tool.annotations?.destructiveHint === true,
    ).length;
    const allowed = await client.callTool({
      name: "list_allowed_directories",
      arguments: {},
    });
    rootBound = textContent(allowed.content).includes(
      MCP_FILESYSTEM_ACCEPTANCE_ROOT,
    );
    const read = await client.callTool({
      name: "read_text_file",
      arguments: { path: markerPath },
    });
    markerRead = textContent(read.content).includes(marker);
    try {
      const write = await client.callTool({
        name: "write_file",
        arguments: {
          path: blockedWritePath,
          content: "THIS_WRITE_MUST_BE_DENIED",
        },
      });
      writeDenied =
        write.isError === true &&
        /EPERM|operation not permitted|denied/iu.test(
          textContent(write.content),
        );
    } catch (caught) {
      writeDenied = /EPERM|operation not permitted|denied/iu.test(
        caught instanceof Error ? caught.message : String(caught),
      );
    }
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "MCP filesystem acceptance failed.";
  } finally {
    try {
      await client.close();
      closedCleanly = true;
    } catch {
      closedCleanly = false;
    }
  }
  const checks = {
    packageVersionPinned: /^\d{4}\.\d+\.\d+$/u.test(
      registration.source.packageVersion,
    ),
    packageIntegrityPinned:
      registration.source.packageIntegrity.startsWith("sha512-"),
    entrypointDigestBound:
      /^[a-f0-9]{64}$/u.test(registration.source.entrypointDigest),
    stdioInitialized: connected,
    toolDiscovery: toolCount >= 10,
    toolAnnotations: readOnlyTools > 0 && destructiveTools > 0,
    rootBound,
    markerRead,
    filesystemWriteDenied: writeDenied,
    writeArtifactAbsent: !existsSync(blockedWritePath),
    networkDeniedByProfile: launch.networkAllowed === false,
    osEnforcedSandbox: launch.osEnforced,
    lifecycleClosed: closedCleanly,
  };
  const status = Object.values(checks).every(Boolean) ? "pass" : "hold";
  recordMcpServerProbe(registration.id, {
    status: status === "pass" ? "pass" : "failed",
    probedAt: new Date().toISOString(),
    toolCount,
    readOnlyTools,
    destructiveTools,
    error,
  });
  const stableProjection = {
    schemaVersion: MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION,
    status,
    packageName: registration.source.packageName,
    packageVersion: registration.source.packageVersion,
    packageIntegrity: registration.source.packageIntegrity,
    entrypointDigest: registration.source.entrypointDigest,
    sandboxKind: launch.kind,
    osEnforced: launch.osEnforced,
    capabilities: { toolCount, readOnlyTools, destructiveTools },
    checks,
  };
  const receipt: McpFilesystemAcceptanceReceipt = {
    id: `mcp-filesystem-${randomUUID()}`,
    schemaVersion: MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    status,
    server: {
      id: registration.id,
      packageName: registration.source.packageName,
      packageVersion: registration.source.packageVersion,
      packageIntegrity: registration.source.packageIntegrity,
      entrypointDigest: registration.source.entrypointDigest,
      transport: registration.transport.kind,
    },
    sandbox: {
      kind: launch.kind,
      osEnforced: launch.osEnforced,
      networkAllowed: launch.networkAllowed,
      filesystemWriteAllowed: launch.filesystemWriteAllowed,
    },
    capabilities: {
      tools: toolCount,
      readOnlyTools,
      destructiveTools,
    },
    checks,
    marker,
    stderr: stderr.slice(0, 2_000),
    error,
    evidenceDigest: digest(stableProjection),
  };
  persist(receipt);
  return receipt;
}

export function readMcpFilesystemAcceptanceEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: MCP_FILESYSTEM_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing:
      receipts.find((receipt) => receipt.status === "pass") || null,
    path: STORE_FILE,
  };
}
