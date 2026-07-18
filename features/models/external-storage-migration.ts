import { createHash, randomUUID } from "crypto";
import { execFileSync } from "child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";

export const MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION = "models.external-storage-migration.v2" as const;

type InventoryFile = { relative: string; bytes: number; sha256: string };
type VolumeEvidence = {
  mountPoint: string;
  volumeName: string;
  volumeUuid: string;
  deviceIdentifier: string;
  filesystem: string;
  protocol: string;
  external: boolean;
  writable: boolean;
  freeBytes: number;
};
type Receipt = {
  schemaVersion: typeof MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  mode: "fixture" | "physical-volume";
  status: "pass" | "failed";
  checks: Record<string, boolean>;
  files: number;
  bytes: number;
  sourcePath?: string;
  destinationPath?: string;
  sourceDigest?: string;
  destinationDigest?: string;
  volume?: VolumeEvidence;
  sourceRemoved: boolean;
  ownershipManifest?: string;
  warning: string;
  error?: string;
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(), "Library", "Application Support", "local-agent-lab", "observability",
);
const STORE_FILE = path.join(DATA_DIR, "model-external-storage-migrations.json");

function readReceipts(): Receipt[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] };
    return Array.isArray(parsed.receipts) ? parsed.receipts : [];
  } catch {
    return [];
  }
}

function persist(receipt: Receipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify({
    schemaVersion: MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION,
    receipts: [receipt, ...readReceipts()].slice(0, 100),
  }, null, 2)}\n`, "utf8");
}

function sha256File(filePath: string) {
  const hash = createHash("sha256");
  const descriptor = openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function inventory(root: string): InventoryFile[] {
  const files: InventoryFile[] = [];
  const walk = (directory: string) => {
    readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
      if (entry.name === ".DS_Store" || entry.name.startsWith("._")) return;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in model migration: ${absolute}`);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        files.push({ relative: path.relative(root, absolute), bytes: statSync(absolute).size, sha256: sha256File(absolute) });
      } else {
        throw new Error(`Unsupported model file type: ${absolute}`);
      }
    });
  };
  walk(root);
  return files;
}

function inventoryDigest(files: InventoryFile[]) {
  return createHash("sha256").update(JSON.stringify(files)).digest("hex");
}

function copyInventory(source: string, destination: string, files: InventoryFile[]) {
  mkdirSync(destination, { recursive: true });
  files.forEach((file) => {
    const target = path.join(destination, file.relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(source, file.relative), target);
  });
}

function removeSystemMetadata(root: string) {
  readdirSync(root, { withFileTypes: true }).forEach((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      rmSync(absolute, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      removeSystemMetadata(absolute);
    }
  });
}

function hasSystemMetadata(root: string): boolean {
  return readdirSync(root, { withFileTypes: true }).some((entry) => {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) return true;
    return entry.isDirectory() ? hasSystemMetadata(path.join(root, entry.name)) : false;
  });
}

function diskInfoField(output: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return output.match(new RegExp(`^\\s*${escaped}:\\s*(.+?)\\s*$`, "mu"))?.[1]?.trim() || "unknown";
}

function physicalVolumeEvidence(destinationRoot: string): VolumeEvidence {
  const resolved = path.resolve(destinationRoot);
  const parts = resolved.split(path.sep).filter(Boolean);
  if (parts[0] !== "Volumes" || !parts[1]) throw new Error("Physical migration destination must be under /Volumes/<volume>.");
  const mountPoint = path.join(path.sep, parts[0], parts[1]);
  const info = execFileSync("/usr/sbin/diskutil", ["info", mountPoint], { encoding: "utf8", timeout: 15_000 });
  const stats = statfsSync(mountPoint);
  const location = diskInfoField(info, "Device Location");
  const protocol = diskInfoField(info, "Protocol");
  const readOnly = diskInfoField(info, "Volume Read-Only");
  return {
    mountPoint,
    volumeName: diskInfoField(info, "Volume Name"),
    volumeUuid: diskInfoField(info, "Volume UUID"),
    deviceIdentifier: diskInfoField(info, "Device Identifier"),
    filesystem: diskInfoField(info, "File System Personality"),
    protocol,
    external: location.toLowerCase() === "external" || ["usb", "thunderbolt"].includes(protocol.toLowerCase()),
    writable: readOnly.toLowerCase() === "no",
    freeBytes: Math.max(0, stats.bavail * stats.bsize),
  };
}

export function buildExternalStorageMigrationPlan(input: { sourcePath?: string; destinationRoot?: string } = {}) {
  return {
    ok: true as const,
    schemaVersion: MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "plan-only" as const,
    sourcePath: input.sourcePath || "<model-directory>",
    destinationRoot: input.destinationRoot || "<external-volume>/FirstLLMStudio/models",
    steps: [
      "verify-operator-approval",
      "verify-physical-volume-identity-and-space",
      "inventory-and-hash-every-file",
      "copy-to-same-volume-staging",
      "verify-every-file-and-directory-digest",
      "atomic-destination-rename",
      "write-ownership-and-volume-manifest",
      "preserve-source-unless-destructive-approval",
    ],
    requiresOperatorApproval: true,
    destructiveApprovalPhrase: "REMOVE_SOURCE_AFTER_VERIFICATION",
    blockers: ["Physical migration is rejected unless operatorApproved=true and the destination is a writable external volume."],
  };
}

export function migrateModelDirectoryToExternalStorage(input: {
  sourcePath?: string;
  destinationRoot?: string;
  operatorApproved?: boolean;
  expectedSourceDigest?: string;
  removeSourceAfterVerification?: boolean;
  destructiveApproval?: string;
}) {
  if (input.operatorApproved !== true) throw new Error("Physical migration requires operatorApproved=true.");
  const sourcePath = path.resolve(input.sourcePath || "");
  const destinationRoot = path.resolve(input.destinationRoot || "");
  if (!input.sourcePath || !existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
    throw new Error("Physical migration sourcePath must be an existing directory.");
  }
  if (sourcePath === destinationRoot || destinationRoot.startsWith(`${sourcePath}${path.sep}`)) {
    throw new Error("Physical migration destination cannot be inside the source directory.");
  }
  const volume = physicalVolumeEvidence(destinationRoot);
  const destinationPath = path.join(destinationRoot, path.basename(sourcePath));
  const stagingPath = path.join(destinationRoot, `.${path.basename(sourcePath)}.${randomUUID()}.staging`);
  if (existsSync(destinationPath)) throw new Error(`Physical migration destination already exists: ${destinationPath}`);
  const removeSource = input.removeSourceAfterVerification === true;
  if (removeSource && input.destructiveApproval !== "REMOVE_SOURCE_AFTER_VERIFICATION") {
    throw new Error("Removing the source requires the destructive approval phrase.");
  }
  const checks = {
    operatorApproved: true,
    physicalVolumeExternal: volume.external,
    volumeWritable: volume.writable,
    spaceAvailable: false,
    expectedSourceDigestMatched: true,
    stagedCopyComplete: false,
    perFileChecksumsVerified: false,
    digestPreserved: false,
    atomicDestination: false,
    ownershipManifestWritten: false,
    systemMetadataRemoved: false,
    sourceDispositionVerified: false,
  };
  let status: Receipt["status"] = "pass";
  let error: string | undefined;
  let sourceDigest: string | undefined;
  let destinationDigest: string | undefined;
  let sourceFiles: InventoryFile[] = [];
  let ownershipManifest: string | undefined;
  try {
    if (!volume.external || !volume.writable) throw new Error("Destination volume is not a writable external device.");
    mkdirSync(destinationRoot, { recursive: true });
    sourceFiles = inventory(sourcePath);
    if (!sourceFiles.length) throw new Error("Model migration source contains no files.");
    const bytes = sourceFiles.reduce((sum, file) => sum + file.bytes, 0);
    checks.spaceAvailable = volume.freeBytes > bytes * 1.1;
    if (!checks.spaceAvailable) throw new Error("External volume does not have enough free space for staging.");
    sourceDigest = inventoryDigest(sourceFiles);
    if (input.expectedSourceDigest && input.expectedSourceDigest !== sourceDigest) {
      checks.expectedSourceDigestMatched = false;
      throw new Error(`Source digest mismatch: expected ${input.expectedSourceDigest}, received ${sourceDigest}.`);
    }
    copyInventory(sourcePath, stagingPath, sourceFiles);
    const stagedFiles = inventory(stagingPath);
    checks.stagedCopyComplete = stagedFiles.length === sourceFiles.length;
    checks.perFileChecksumsVerified = sourceFiles.every((file, index) =>
      stagedFiles[index]?.relative === file.relative && stagedFiles[index]?.bytes === file.bytes && stagedFiles[index]?.sha256 === file.sha256,
    );
    destinationDigest = inventoryDigest(stagedFiles);
    checks.digestPreserved = sourceDigest === destinationDigest;
    if (!checks.stagedCopyComplete || !checks.perFileChecksumsVerified || !checks.digestPreserved) {
      throw new Error("External staging verification failed.");
    }
    renameSync(stagingPath, destinationPath);
    checks.atomicDestination = existsSync(destinationPath) && !existsSync(stagingPath);
    ownershipManifest = path.join(destinationPath, ".first-llm-storage-owner.json");
    writeFileSync(ownershipManifest, `${JSON.stringify({
      schemaVersion: MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      sourcePath,
      destinationPath,
      sourceDigest,
      files: sourceFiles,
      volume,
    }, null, 2)}\n`, "utf8");
    checks.ownershipManifestWritten = existsSync(ownershipManifest);
    removeSystemMetadata(destinationPath);
    checks.systemMetadataRemoved = !hasSystemMetadata(destinationPath);
    if (removeSource) rmSync(sourcePath, { recursive: true, force: true });
    checks.sourceDispositionVerified = removeSource ? !existsSync(sourcePath) : existsSync(sourcePath);
    if (!Object.values(checks).every(Boolean)) throw new Error("One or more physical migration checks failed.");
  } catch (caught) {
    status = "failed";
    error = caught instanceof Error ? caught.message : "Physical external-storage migration failed.";
    rmSync(stagingPath, { recursive: true, force: true });
  }
  const receipt: Receipt = {
    schemaVersion: MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION,
    id: `external-storage-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    mode: "physical-volume",
    status,
    checks,
    files: sourceFiles.length,
    bytes: sourceFiles.reduce((sum, file) => sum + file.bytes, 0),
    sourcePath,
    destinationPath,
    sourceDigest,
    destinationDigest,
    volume,
    sourceRemoved: !existsSync(sourcePath),
    ownershipManifest,
    warning: "A mounted physical external volume was verified. Disconnect/reconnect recovery is not part of this receipt.",
    error,
  };
  persist(receipt);
  return receipt;
}

export function rehearseExternalStorageMigration() {
  const root = mkdtempSync(path.join(os.tmpdir(), "first-llm-external-storage-"));
  const sourcePath = path.join(root, "internal", "model");
  const stagingPath = path.join(root, "external", ".model.staging");
  const destinationPath = path.join(root, "external", "model");
  const checks = {
    stagedCopyComplete: false,
    digestPreserved: false,
    atomicDestination: false,
    ownershipManifestWritten: false,
    sourceRemovedAfterVerification: false,
  };
  let status: Receipt["status"] = "pass";
  let error: string | undefined;
  let sourceDigest: string | undefined;
  let destinationDigest: string | undefined;
  let files: InventoryFile[] = [];
  try {
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(path.join(sourcePath, "config.json"), "{\"model\":\"fixture\"}\n");
    writeFileSync(path.join(sourcePath, "weights.gguf"), Buffer.alloc(4096, 7));
    files = inventory(sourcePath);
    sourceDigest = inventoryDigest(files);
    copyInventory(sourcePath, stagingPath, files);
    const staged = inventory(stagingPath);
    checks.stagedCopyComplete = staged.length === files.length;
    destinationDigest = inventoryDigest(staged);
    checks.digestPreserved = sourceDigest === destinationDigest;
    renameSync(stagingPath, destinationPath);
    checks.atomicDestination = existsSync(destinationPath) && !existsSync(stagingPath);
    writeFileSync(path.join(destinationPath, ".first-llm-storage-owner.json"), `${JSON.stringify({ sourceDigest }, null, 2)}\n`);
    checks.ownershipManifestWritten = true;
    rmSync(sourcePath, { recursive: true, force: true });
    checks.sourceRemovedAfterVerification = !existsSync(sourcePath);
    if (!Object.values(checks).every(Boolean)) throw new Error("One or more fixture migration checks failed.");
  } catch (caught) {
    status = "failed";
    error = caught instanceof Error ? caught.message : "External storage migration rehearsal failed.";
  }
  const receipt: Receipt = {
    schemaVersion: MODEL_EXTERNAL_STORAGE_SCHEMA_VERSION,
    id: `external-storage-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    mode: "fixture",
    status,
    checks,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    sourceDigest,
    destinationDigest,
    sourceRemoved: true,
    warning: "The fixture rehearsal does not prove a physical external-volume migration.",
    error,
  };
  rmSync(root, { recursive: true, force: true });
  persist(receipt);
  return receipt;
}

export function readExternalStorageMigrationEvidence() {
  const receipts = readReceipts();
  return {
    ...buildExternalStorageMigrationPlan(),
    receipts,
    latestPassing: receipts.find((entry) => entry.status === "pass") || null,
    latestPhysicalPassing: receipts.find((entry) => entry.mode === "physical-volume" && entry.status === "pass") || null,
    path: STORE_FILE,
  };
}
