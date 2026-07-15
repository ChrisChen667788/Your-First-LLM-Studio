import { spawnSync } from "child_process";
import { createHash, generateKeyPairSync, sign, verify } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";

export const DESKTOP_PACKAGE_REHEARSAL_SCHEMA_VERSION =
  "desktop.package-rehearsal.v1" as const;

type LocalSigningKey = {
  keyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const REHEARSAL_DIR = path.join(DATA_DIR, "desktop-package-rehearsals");
const KEY_FILE = path.join(REHEARSAL_DIR, "local-package-signing-key.json");

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries: string[] = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function readOrCreateLocalKey(): LocalSigningKey {
  mkdirSync(REHEARSAL_DIR, { recursive: true });
  if (existsSync(KEY_FILE)) return JSON.parse(readFileSync(KEY_FILE, "utf8")) as LocalSigningKey;
  const pair = generateKeyPairSync("ed25519");
  const key: LocalSigningKey = {
    keyId: `desktop-local-${Date.now()}`,
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
  writeFileSync(KEY_FILE, `${JSON.stringify(key, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

function readDeveloperIdEvidence() {
  const packagePath = process.env.FIRST_LLM_DESKTOP_PACKAGE_PATH?.trim();
  const identity = process.env.FIRST_LLM_APPLE_SIGNING_IDENTITY?.trim();
  if (!packagePath || !identity || !existsSync(packagePath)) {
    return {
      configured: false,
      verified: false,
      packagePath: packagePath || null,
      identity: identity || null,
      summary: "Developer ID package path or signing identity is not configured.",
    };
  }
  const result = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", packagePath], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return {
    configured: true,
    verified: result.status === 0,
    packagePath,
    identity,
    summary: result.status === 0 ? "Developer ID codesign verification passed." : (result.stderr || result.stdout || "codesign failed").trim(),
  };
}

export function readDesktopPackageRehearsals() {
  mkdirSync(REHEARSAL_DIR, { recursive: true });
  const reports = readdirSync(REHEARSAL_DIR)
    .filter((name) => name.startsWith("rehearsal-") && name.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 20)
    .map((name) => {
      try {
        return JSON.parse(readFileSync(path.join(REHEARSAL_DIR, name), "utf8")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((report): report is Record<string, unknown> => Boolean(report));
  return {
    ok: true as const,
    schemaVersion: DESKTOP_PACKAGE_REHEARSAL_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    signerMode: "local-ed25519-rehearsal" as const,
    developerId: readDeveloperIdEvidence(),
    reports,
    totals: {
      rehearsals: reports.length,
      passed: reports.filter((report) => report.status === "pass").length,
      developerIdVerified: readDeveloperIdEvidence().verified ? 1 : 0,
    },
    paths: { directory: REHEARSAL_DIR, localKey: KEY_FILE },
  };
}

export function runDesktopPackageRehearsal() {
  const id = `rehearsal-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const root = path.join(REHEARSAL_DIR, id);
  const packages = path.join(root, "packages");
  const installRoot = path.join(root, "install-root");
  const installedFile = path.join(installRoot, "First LLM Studio.app", "Contents", "version.txt");
  const backupFile = path.join(root, "rollback", "version.txt");
  mkdirSync(path.dirname(installedFile), { recursive: true });
  mkdirSync(path.dirname(backupFile), { recursive: true });
  const key = readOrCreateLocalKey();
  const steps: Array<{ id: string; status: "pass" | "fail"; summary: string }> = [];
  const versions = ["1.1.0-rehearsal.1", "1.1.0-rehearsal.2"];
  const receipts = versions.map((version) => {
    const source = path.join(packages, version, "version.txt");
    mkdirSync(path.dirname(source), { recursive: true });
    const content = `First LLM Studio ${version}\n`;
    writeFileSync(source, content, "utf8");
    const manifest = {
      schemaVersion: "desktop.package-manifest.v1",
      product: "First LLM Studio",
      version,
      files: [{ path: "First LLM Studio.app/Contents/version.txt", bytes: Buffer.byteLength(content), sha256: sha256(content) }],
    };
    const digest = sha256(stableJson(manifest));
    const signature = sign(null, Buffer.from(digest, "hex"), key.privateKeyPem).toString("base64");
    const verified = verify(null, Buffer.from(digest, "hex"), key.publicKeyPem, Buffer.from(signature, "base64"));
    return { version, source, manifest, digest, signature, keyId: key.keyId, verified };
  });
  try {
    if (!receipts.every((receipt) => receipt.verified)) throw new Error("Local package signature verification failed.");
    steps.push({ id: "verify-signatures", status: "pass", summary: "Both local rehearsal package manifests verified." });
    copyFileSync(receipts[0].source, installedFile);
    steps.push({ id: "fresh-install", status: "pass", summary: `Installed ${versions[0]} into the isolated staging root.` });
    copyFileSync(installedFile, backupFile);
    copyFileSync(receipts[1].source, installedFile);
    steps.push({ id: "upgrade", status: "pass", summary: `Upgraded staging installation to ${versions[1]}.` });
    copyFileSync(backupFile, `${installedFile}.rollback`);
    renameSync(`${installedFile}.rollback`, installedFile);
    if (!readFileSync(installedFile, "utf8").includes(versions[0])) throw new Error("Rollback content mismatch.");
    steps.push({ id: "rollback", status: "pass", summary: `Rolled back to ${versions[0]}.` });
    rmSync(installRoot, { recursive: true, force: true });
    if (existsSync(installRoot)) throw new Error("Uninstall did not remove the staging root.");
    steps.push({ id: "uninstall", status: "pass", summary: "Removed the isolated staging installation." });
  } catch (error) {
    steps.push({ id: "rehearsal-failure", status: "fail", summary: error instanceof Error ? error.message : "Desktop rehearsal failed." });
  }
  const report = {
    schemaVersion: DESKTOP_PACKAGE_REHEARSAL_SCHEMA_VERSION,
    id,
    createdAt: new Date().toISOString(),
    status: steps.every((step) => step.status === "pass") ? "pass" as const : "fail" as const,
    signerMode: "local-ed25519-rehearsal" as const,
    developerId: readDeveloperIdEvidence(),
    receipts,
    steps,
    warning: "Local Ed25519 rehearsal evidence is not Apple Developer ID notarization evidence.",
  };
  const reportPath = path.join(REHEARSAL_DIR, `${id}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { ...report, reportPath };
}
