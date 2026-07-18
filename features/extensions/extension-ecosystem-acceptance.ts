import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
} from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import { createExtensionInstallPlan } from "@/features/extensions/install-planner";
import {
  installVerifiedExtension,
  rollbackExtensionVersion,
} from "@/features/extensions/install-transaction";
import { runMcpFilesystemAcceptance } from "@/features/extensions/mcp-filesystem-acceptance";
import { verifyExtensionPackage } from "@/features/extensions/package-verification";
import { rehearseExtensionPermissionGrants } from "@/features/extensions/permission-grants";
import { runExtensionSandboxRehearsal } from "@/features/extensions/process-sandbox";
import { rehearseExtensionQuarantineReview } from "@/features/extensions/quarantine-review";
import type { ExtensionManifest } from "@/features/extensions/registry";
import { rehearseExtensionSecretScopePolicy } from "@/features/extensions/secret-scope-policy";

export const EXTENSION_ECOSYSTEM_ACCEPTANCE_SCHEMA_VERSION =
  "extensions.ecosystem-acceptance.v1" as const;

type AcceptanceReceipt = {
  id: string;
  schemaVersion: typeof EXTENSION_ECOSYSTEM_ACCEPTANCE_SCHEMA_VERSION;
  generatedAt: string;
  status: "pass" | "hold";
  checks: Record<string, boolean>;
  lifecycle: {
    extensionId: string;
    installedVersion: string;
    updatedVersion: string;
    rollbackVersion: string;
  };
  security: {
    sandbox: string;
    osEnforced: boolean;
    maliciousPackageQuarantined: boolean;
    traversalBundleRejected: boolean;
    dependencyConflictBlocked: boolean;
  };
  mcp: {
    serverId: string;
    packageName: string;
    packageVersion: string;
    tools: number;
    readOnlyTools: number;
    destructiveTools: number;
    transport: "stdio";
  };
  blockers: string[];
  evidenceDigest: string;
};

type SignedBundle = {
  manifest: ExtensionManifest;
  payloadBase64: string;
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
const STORE_FILE = path.join(DATA_DIR, "extension-ecosystem-acceptance.json");
const ACCEPTANCE_PUBLISHER = "first-llm-studio.acceptance";
const ACCEPTANCE_EXTENSION_ID = "first-llm-studio.acceptance-tool";

function readReceipts(): AcceptanceReceipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as {
      receipts?: AcceptanceReceipt[];
    };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: AcceptanceReceipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    STORE_FILE,
    `${JSON.stringify(
      {
        schemaVersion: EXTENSION_ECOSYSTEM_ACCEPTANCE_SCHEMA_VERSION,
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

function createSignedBundle(input: {
  version: string;
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
  files?: Array<{ path: string; content: string; executable?: boolean }>;
  dependencies?: Record<string, string>;
}) {
  const files = input.files || [
    {
      path: "extension.mjs",
      content: `process.stdout.write(JSON.stringify({ version: "${input.version}", status: "ready" }));\n`,
      executable: true,
    },
  ];
  const payload = Buffer.from(
    JSON.stringify({
      schemaVersion: "first-llm-extension-bundle.v1",
      files: files.map((file) => ({
        path: file.path,
        contentBase64: Buffer.from(file.content).toString("base64"),
        executable: Boolean(file.executable),
      })),
    }),
  );
  const payloadDigest = createHash("sha256").update(payload).digest("hex");
  const signature = sign(
    null,
    Buffer.from(payloadDigest, "hex"),
    input.privateKey,
  ).toString("base64");
  const manifest: ExtensionManifest = {
    schemaVersion: "first-llm-extension.v1",
    id: ACCEPTANCE_EXTENSION_ID,
    name: "First LLM Studio signed extension acceptance",
    version: input.version,
    publisher: ACCEPTANCE_PUBLISHER,
    kind: "tool",
    entrypoint: "extension.mjs",
    permissions: ["workspace:read"],
    compatibleStudio: ">=1.3.0",
    dependencies: input.dependencies,
    digest: payloadDigest,
    signature,
  };
  return {
    manifest,
    payloadBase64: payload.toString("base64"),
  } satisfies SignedBundle;
}

export async function runExtensionEcosystemAcceptance() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const internalAcceptanceTrustRoot = {
    publisher: ACCEPTANCE_PUBLISHER,
    publicKeyPem,
  };
  const versionOne = createSignedBundle({
    version: "1.0.0",
    privateKey,
  });
  const versionTwo = createSignedBundle({
    version: "1.1.0",
    privateKey,
  });
  const installed = installVerifiedExtension({
    ...versionOne,
    internalAcceptanceTrustRoot,
  });
  const updated = installVerifiedExtension({
    ...versionTwo,
    internalAcceptanceTrustRoot,
  });
  const rollback = rollbackExtensionVersion({
    extensionId: ACCEPTANCE_EXTENSION_ID,
    targetVersion: "1.0.0",
  });

  const tamperedPayload = Buffer.from(
    `${Buffer.from(versionOne.payloadBase64, "base64").toString("utf8")} `,
  ).toString("base64");
  const tampered = verifyExtensionPackage({
    manifest: versionOne.manifest,
    payloadBase64: tamperedPayload,
    quarantineOnFailure: true,
    internalAcceptanceTrustRoot,
  });

  const traversal = createSignedBundle({
    version: "1.2.0",
    privateKey,
    files: [
      {
        path: "../escape.mjs",
        content: 'process.stdout.write("unsafe");\n',
        executable: true,
      },
    ],
  });
  let traversalBundleRejected = false;
  try {
    installVerifiedExtension({
      ...traversal,
      internalAcceptanceTrustRoot,
    });
  } catch {
    traversalBundleRejected = true;
  }

  const dependencyConflictPlan = createExtensionInstallPlan([
    createSignedBundle({
      version: "1.3.0",
      privateKey,
      dependencies: {
        "community.missing-dependency": "^1.0.0",
      },
    }).manifest,
  ]);
  const permissionReceipt = rehearseExtensionPermissionGrants();
  const secretScopeReceipt = rehearseExtensionSecretScopePolicy();
  const quarantineReceipt = rehearseExtensionQuarantineReview();
  const sandboxReceipt = runExtensionSandboxRehearsal();
  const mcpReceipt = await runMcpFilesystemAcceptance();

  const checks = {
    signedInstallAccepted:
      installed.verification.accepted &&
      installed.installation.version === "1.0.0",
    signedUpdateAccepted:
      updated.verification.accepted &&
      updated.installation.version === "1.1.0",
    rollbackRestoredPreviousVersion:
      rollback.status === "pass" && rollback.toVersion === "1.0.0",
    tamperedPackageRejected:
      !tampered.accepted && Boolean(tampered.quarantine),
    traversalBundleRejected,
    dependencyConflictVisible:
      dependencyConflictPlan.status === "blocked" &&
      dependencyConflictPlan.errors.some((error) =>
        error.includes("missing dependency"),
      ),
    permissionGrantLifecycle: permissionReceipt.status === "pass",
    secretScopeEnforced: secretScopeReceipt.status === "pass",
    quarantineReviewAudited: quarantineReceipt.status === "pass",
    osSandboxEnforced:
      sandboxReceipt.ok && sandboxReceipt.osEnforced,
    realMcpServerAccepted: mcpReceipt.status === "pass",
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Extension ecosystem acceptance failed: ${check}.`);
  const core = {
    schemaVersion: EXTENSION_ECOSYSTEM_ACCEPTANCE_SCHEMA_VERSION,
    status: blockers.length ? ("hold" as const) : ("pass" as const),
    checks,
    lifecycle: {
      extensionId: ACCEPTANCE_EXTENSION_ID,
      installedVersion: installed.installation.version,
      updatedVersion: updated.installation.version,
      rollbackVersion: rollback.toVersion,
    },
    security: {
      sandbox: sandboxReceipt.isolation,
      osEnforced: sandboxReceipt.osEnforced,
      maliciousPackageQuarantined: Boolean(tampered.quarantine),
      traversalBundleRejected,
      dependencyConflictBlocked:
        dependencyConflictPlan.status === "blocked",
    },
    mcp: {
      serverId: mcpReceipt.server.id,
      packageName: mcpReceipt.server.packageName,
      packageVersion: mcpReceipt.server.packageVersion,
      tools: mcpReceipt.capabilities.tools,
      readOnlyTools: mcpReceipt.capabilities.readOnlyTools,
      destructiveTools: mcpReceipt.capabilities.destructiveTools,
      transport: mcpReceipt.server.transport,
    },
    blockers,
  };
  const receipt: AcceptanceReceipt = {
    id: `extension-ecosystem-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    ...core,
    evidenceDigest: digest(core),
  };
  persist(receipt);
  return receipt;
}

export function readExtensionEcosystemAcceptanceEvidence() {
  const receipts = readReceipts();
  return {
    ok: true as const,
    schemaVersion: EXTENSION_ECOSYSTEM_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latest: receipts[0] || null,
    latestPassing:
      receipts.find((receipt) => receipt.status === "pass") || null,
    path: STORE_FILE,
  };
}
