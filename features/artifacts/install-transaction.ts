import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ArtifactPackageManifest } from "@/features/artifacts/package-contract";
import {
  evaluateTrustedArtifactPackage,
  type ArtifactDependencyNode,
  type ArtifactSbomEvidence,
} from "@/features/artifacts/trusted-package-policy";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

export const ARTIFACT_INSTALL_TRANSACTION_SCHEMA_VERSION =
  "artifacts.install-transaction.v1" as const;

type InstalledVersion = {
  artifactId: string;
  version: string;
  manifestDigest: string;
  directory: string;
  installedAt: string;
  active: boolean;
};

type InstallReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "blocked";
  action: "install" | "activate" | "rollback" | "uninstall";
  artifactId: string;
  version: string;
  checks: Record<string, boolean>;
  blockers: string[];
};

type Store = {
  schemaVersion: typeof ARTIFACT_INSTALL_TRANSACTION_SCHEMA_VERSION;
  versions: InstalledVersion[];
  receipts: InstallReceipt[];
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
const INSTALL_ROOT = path.join(DATA_DIR, "artifact-installs");
const STORE_FILE = path.join(DATA_DIR, "artifact-install-transactions.json");

function emptyStore(): Store {
  return { schemaVersion: ARTIFACT_INSTALL_TRANSACTION_SCHEMA_VERSION, versions: [], receipts: [] };
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Store>;
  return candidate.schemaVersion === ARTIFACT_INSTALL_TRANSACTION_SCHEMA_VERSION &&
    Array.isArray(candidate.versions) && Array.isArray(candidate.receipts);
}

function safeSegment(value: string) {
  if (!/^[a-z0-9][a-z0-9._-]+$/iu.test(value)) {
    throw new Error("Artifact install coordinates contain an unsafe path segment.");
  }
  return value;
}

function persistReceipt(receipt: InstallReceipt, mutate?: (store: Store) => Store) {
  updateJsonFileDurably(
    STORE_FILE,
    emptyStore,
    (store) => ({
      ...(mutate ? mutate(store) : store),
      receipts: [receipt, ...store.receipts].slice(0, 500),
    }),
    isStore,
  );
  return receipt;
}

export function installTrustedArtifact(input: {
  manifest: ArtifactPackageManifest;
  keyId: string;
  payloadsBase64: Record<string, string>;
  dependencyCatalog: ArtifactDependencyNode[];
  studioVersion: string;
  allowedLicenses: string[];
  sbom: ArtifactSbomEvidence;
  secretScanPassed: boolean;
  malwareScanPassed: boolean;
  activate?: boolean;
}) {
  const payloads = Object.fromEntries(
    Object.entries(input.payloadsBase64).map(([filePath, value]) => [
      filePath,
      Buffer.from(value, "base64"),
    ]),
  );
  const policy = evaluateTrustedArtifactPackage({ ...input, payloads });
  const artifactId = safeSegment(input.manifest.id);
  const version = safeSegment(input.manifest.version);
  const destination = path.join(INSTALL_ROOT, artifactId, version);
  const existing = readJsonFileDurably(STORE_FILE, emptyStore, isStore).versions.find(
    (entry) => entry.artifactId === artifactId && entry.version === version,
  );
  const immutableCoordinate = !existing || existing.manifestDigest === policy.artifact.manifestDigest;
  const checks = {
    trustedPolicyPassed: policy.status === "pass",
    immutableCoordinate,
    isolatedStaging: false,
    stagedDigestVerified: false,
    atomicInstall: false,
  };
  const blockers = [
    ...policy.blockers,
    ...(!immutableCoordinate ? ["Installed artifact coordinates are immutable."] : []),
  ];
  if (blockers.length) {
    return persistReceipt({
      id: `artifact-install-${randomUUID()}`,
      generatedAt: new Date().toISOString(),
      status: "blocked",
      action: "install",
      artifactId,
      version,
      checks,
      blockers,
    });
  }
  if (existing) {
    return persistReceipt({
      id: `artifact-install-${randomUUID()}`,
      generatedAt: new Date().toISOString(),
      status: "pass",
      action: "install",
      artifactId,
      version,
      checks: { ...checks, isolatedStaging: true, stagedDigestVerified: true, atomicInstall: true },
      blockers: [],
    });
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const staging = mkdtempSync(path.join(os.tmpdir(), "first-llm-artifact-install-"));
  checks.isolatedStaging = !staging.startsWith(INSTALL_ROOT);
  try {
    for (const file of input.manifest.files) {
      const payload = payloads[file.path];
      const outputPath = path.join(staging, file.path);
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, payload, { mode: file.role === "weights" ? 0o400 : 0o440 });
    }
    checks.stagedDigestVerified = input.manifest.files.every((file) =>
      createHash("sha256").update(readFileSync(path.join(staging, file.path))).digest("hex") === file.sha256,
    );
    if (!checks.stagedDigestVerified) throw new Error("Staged artifact digest verification failed.");
    renameSync(staging, destination);
    checks.atomicInstall = existsSync(destination);
    const now = new Date().toISOString();
    const versionRecord: InstalledVersion = {
      artifactId,
      version,
      manifestDigest: policy.artifact.manifestDigest,
      directory: destination,
      installedAt: now,
      active: input.activate !== false,
    };
    return persistReceipt(
      {
        id: `artifact-install-${randomUUID()}`,
        generatedAt: now,
        status: Object.values(checks).every(Boolean) ? "pass" : "blocked",
        action: "install",
        artifactId,
        version,
        checks,
        blockers: Object.values(checks).every(Boolean) ? [] : ["Artifact install checks were incomplete."],
      },
      (store) => ({
        ...store,
        versions: [
          versionRecord,
          ...store.versions
            .filter((entry) => !(entry.artifactId === artifactId && entry.version === version))
            .map((entry) => input.activate !== false && entry.artifactId === artifactId
              ? { ...entry, active: false }
              : entry),
        ],
      }),
    );
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}

export function changeArtifactActivation(input: {
  artifactId: string;
  version: string;
  action: "activate" | "rollback" | "uninstall";
}) {
  const artifactId = safeSegment(input.artifactId);
  const version = safeSegment(input.version);
  const store = readJsonFileDurably(STORE_FILE, emptyStore, isStore);
  const target = store.versions.find(
    (entry) => entry.artifactId === artifactId && entry.version === version,
  );
  const activeUninstallDenied = input.action !== "uninstall" || !target?.active;
  const targetExists = Boolean(target);
  const checks = { targetExists, activeUninstallDenied };
  const blockers = [
    ...(!targetExists ? ["Artifact install target was not found."] : []),
    ...(!activeUninstallDenied ? ["Active artifact versions cannot be uninstalled."] : []),
  ];
  const receipt: InstallReceipt = {
    id: `artifact-install-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "pass",
    action: input.action,
    artifactId,
    version,
    checks,
    blockers,
  };
  if (blockers.length) return persistReceipt(receipt);
  return persistReceipt(receipt, (current) => ({
    ...current,
    versions: input.action === "uninstall"
      ? current.versions.filter((entry) => !(entry.artifactId === artifactId && entry.version === version))
      : current.versions.map((entry) => entry.artifactId === artifactId
        ? { ...entry, active: entry.version === version }
        : entry),
  }));
}

export function readArtifactInstallTransactions() {
  const store = readJsonFileDurably(STORE_FILE, emptyStore, isStore);
  return {
    ...store,
    ok: true as const,
    schemaVersion: ARTIFACT_INSTALL_TRANSACTION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    latestPassing: store.receipts.find((receipt) => receipt.status === "pass") || null,
    totals: {
      installed: store.versions.length,
      active: store.versions.filter((entry) => entry.active).length,
      receipts: store.receipts.length,
      blocked: store.receipts.filter((receipt) => receipt.status === "blocked").length,
    },
    paths: { root: INSTALL_ROOT, store: STORE_FILE },
  };
}
