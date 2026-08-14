import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveFineTuneCheckpointDirectory } from "./runtime-service";

export const FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION =
  "finetune.adapter-package.v1" as const;

export type FineTuneAdapterPackageFile = {
  path: string;
  role: "weights" | "adapter-config" | "training-config" | "card" | "evidence";
  bytes: number;
  sha256: string;
};

export type FineTuneAdapterPackageReceipt = {
  schemaVersion: typeof FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION;
  generatedAt: string;
  adapterName: string;
  baseTargetId: string | null;
  source: {
    outputDir: string;
    selectedCheckpointDir: string;
    selectedCheckpointFile: string;
    selection: "best" | "final" | "requested";
  };
  packageDir: string;
  archivePath: string;
  manifestPath: string;
  files: FineTuneAdapterPackageFile[];
  payloadDigest: string;
  archiveBytes: number;
  archiveSha256: string;
  secretScan: {
    status: "passed";
    scannedFiles: number;
  };
  readBack: {
    verified: true;
    extractedFiles: number;
    installedCheckpointSha256: string;
    rollbackPerformed: true;
    rollbackVerified: true;
  };
};

const WEIGHT_NAMES = ["adapters.safetensors", "adapter_model.safetensors"];
const TEXT_EXTENSIONS = new Set([".json", ".md", ".txt", ".yaml", ".yml"]);
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{20,}/gi,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

function sha256Buffer(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath: string) {
  return sha256Buffer(readFileSync(filePath));
}

function packageSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "adapter"
  ).slice(0, 80);
}

function findWeights(checkpointDir: string) {
  for (const name of WEIGHT_NAMES) {
    const candidate = path.join(checkpointDir, name);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  const checkpointFile = readdirSync(checkpointDir)
    .filter((name) => /(?:^|_)adapters?\.safetensors$/i.test(name))
    .sort()
    .at(-1);
  if (!checkpointFile) {
    throw new Error(`Selected checkpoint has no adapter weights: ${checkpointDir}`);
  }
  return path.join(checkpointDir, checkpointFile);
}

function copyPackageFile(input: {
  source: string;
  packageDir: string;
  relativePath: string;
  role: FineTuneAdapterPackageFile["role"];
}) {
  const destination = path.join(input.packageDir, input.relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(input.source, destination);
  const stats = statSync(destination);
  return {
    path: input.relativePath.split(path.sep).join("/"),
    role: input.role,
    bytes: stats.size,
    sha256: sha256File(destination),
  } satisfies FineTuneAdapterPackageFile;
}

function scanPackageSecrets(packageDir: string, files: FineTuneAdapterPackageFile[]) {
  let scannedFiles = 0;
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file.path).toLowerCase())) continue;
    scannedFiles += 1;
    const contents = readFileSync(path.join(packageDir, file.path), "utf8");
    if (SECRET_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(contents);
    })) {
      throw new Error(`Secret scan rejected exported text file: ${file.path}`);
    }
  }
  return { status: "passed" as const, scannedFiles };
}

function runTar(args: string[], failureMessage: string) {
  const result = spawnSync("tar", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "tar command failed").trim();
    throw new Error(`${failureMessage}: ${detail}`);
  }
}

function verifyArchiveRoundTrip(input: {
  archivePath: string;
  files: FineTuneAdapterPackageFile[];
}) {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), "first-llm-adapter-install-"));
  try {
    runTar(
      ["-xzf", input.archivePath, "-C", installRoot],
      "Adapter package install rehearsal failed",
    );
    for (const file of input.files) {
      const installedPath = path.join(installRoot, file.path);
      if (!existsSync(installedPath) || !statSync(installedPath).isFile()) {
        throw new Error(`Adapter package read-back is missing ${file.path}.`);
      }
      if (sha256File(installedPath) !== file.sha256) {
        throw new Error(`Adapter package read-back checksum mismatch: ${file.path}.`);
      }
    }
    const installedWeights = input.files.find((file) => file.role === "weights");
    if (!installedWeights) throw new Error("Adapter package has no weights inventory entry.");
    const installedCheckpointSha256 = sha256File(
      path.join(installRoot, installedWeights.path),
    );
    rmSync(installRoot, { recursive: true, force: true });
    return {
      verified: true as const,
      extractedFiles: input.files.length,
      installedCheckpointSha256,
      rollbackPerformed: true as const,
      rollbackVerified: !existsSync(installRoot) as true,
    };
  } finally {
    rmSync(installRoot, { recursive: true, force: true });
  }
}

export function buildFineTuneAdapterPackage(input: {
  adapterName: string;
  baseTargetId?: string;
  outputDir: string;
  bestCheckpointPath?: string;
  requestedCheckpointPath?: string;
  trainingConfigPath?: string;
  destinationDir: string;
  extraFiles?: Array<{
    source: string;
    relativePath: string;
    role: Extract<FineTuneAdapterPackageFile["role"], "card" | "evidence">;
  }>;
}) {
  const requestedCheckpointPath = input.requestedCheckpointPath?.trim();
  const bestCheckpointPath = input.bestCheckpointPath?.trim();
  const selectedCheckpointDir = resolveFineTuneCheckpointDirectory({
    outputDir: input.outputDir,
    requestedPath: requestedCheckpointPath || bestCheckpointPath,
    fallbackPath: input.outputDir,
  });
  const selectedPath = requestedCheckpointPath || bestCheckpointPath;
  const selectedCheckpointFile =
    selectedPath && existsSync(selectedPath) && statSync(selectedPath).isFile()
      ? realpathSync(selectedPath)
      : findWeights(selectedCheckpointDir);
  const slug = packageSlug(input.adapterName);
  const packageDir = path.join(input.destinationDir, `${slug}-adapter-package`);
  const archivePath = path.join(input.destinationDir, `${slug}-adapter-package.tar.gz`);
  if (existsSync(packageDir) || existsSync(archivePath)) {
    throw new Error(`Adapter export destination already contains package ${slug}.`);
  }
  mkdirSync(packageDir, { recursive: true });

  try {
    const files: FineTuneAdapterPackageFile[] = [];
    files.push(
      copyPackageFile({
        source: selectedCheckpointFile,
        packageDir,
        relativePath: "adapter/adapters.safetensors",
        role: "weights",
      }),
    );

    const adapterConfigPath = path.join(input.outputDir, "adapter_config.json");
    if (!existsSync(adapterConfigPath)) {
      throw new Error(`Adapter config is missing: ${adapterConfigPath}`);
    }
    files.push(
      copyPackageFile({
        source: realpathSync(adapterConfigPath),
        packageDir,
        relativePath: "adapter/adapter_config.json",
        role: "adapter-config",
      }),
    );
    if (input.trainingConfigPath && existsSync(input.trainingConfigPath)) {
      files.push(
        copyPackageFile({
          source: realpathSync(input.trainingConfigPath),
          packageDir,
          relativePath: `training/${path.basename(input.trainingConfigPath)}`,
          role: "training-config",
        }),
      );
    }
    for (const extra of input.extraFiles || []) {
      if (!existsSync(extra.source) || !statSync(extra.source).isFile()) continue;
      files.push(copyPackageFile({ ...extra, packageDir }));
    }

    const secretScan = scanPackageSecrets(packageDir, files);
    const payloadDigest = sha256Buffer(
      files
        .map((file) => `${file.path}\0${file.bytes}\0${file.sha256}`)
        .sort()
        .join("\n"),
    );
    const generatedAt = new Date().toISOString();
    const manifestPath = path.join(packageDir, "adapter-package-manifest.json");
    const manifest = {
      schemaVersion: FINETUNE_ADAPTER_PACKAGE_SCHEMA_VERSION,
      generatedAt,
      adapterName: input.adapterName,
      baseTargetId: input.baseTargetId || null,
      source: {
        outputDir: realpathSync(input.outputDir),
        selectedCheckpointDir,
        selectedCheckpointFile,
        selection: requestedCheckpointPath
          ? ("requested" as const)
          : bestCheckpointPath
            ? ("best" as const)
            : ("final" as const),
      },
      files,
      payloadDigest,
      secretScan,
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    runTar(
      ["-czf", archivePath, "-C", packageDir, "."],
      "Adapter package archive creation failed",
    );
    const readBack = verifyArchiveRoundTrip({ archivePath, files });
    const receipt: FineTuneAdapterPackageReceipt = {
      ...manifest,
      packageDir,
      archivePath,
      manifestPath,
      archiveBytes: statSync(archivePath).size,
      archiveSha256: sha256File(archivePath),
      readBack,
    };
    const receiptPath = path.join(packageDir, "adapter-package-receipt.json");
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return { ...receipt, receiptPath };
  } catch (error) {
    rmSync(packageDir, { recursive: true, force: true });
    rmSync(archivePath, { force: true });
    throw error;
  }
}
