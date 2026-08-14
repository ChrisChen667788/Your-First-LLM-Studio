import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type DurableJsonStoreOptions<T> = {
  filePath: string;
  initial: () => T;
  validate: (value: unknown) => value is T;
  maxLockAgeMs?: number;
};

export class DurableJsonStoreError extends Error {
  constructor(
    readonly code: "store_locked" | "store_corrupt" | "store_invalid",
    readonly filePath: string,
    message: string,
  ) {
    super(message);
    this.name = "DurableJsonStoreError";
  }
}

function processIsAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(filePath: string, maxLockAgeMs = 30_000) {
  const lockPath = `${filePath}.lock`;
  mkdirSync(path.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(lockPath, "wx", 0o600);
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`);
      fsyncSync(descriptor);
      closeSync(descriptor);
      return () => rmSync(lockPath, { force: true });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") throw error;
      let stale = false;
      try {
        const owner = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: number };
        stale = Date.now() - statSync(lockPath).mtimeMs > maxLockAgeMs && !processIsAlive(Number(owner.pid));
      } catch {
        stale = Date.now() - statSync(lockPath).mtimeMs > maxLockAgeMs;
      }
      if (stale && attempt === 0) {
        rmSync(lockPath, { force: true });
        continue;
      }
      throw new DurableJsonStoreError("store_locked", filePath, `Durable store is locked: ${filePath}`);
    }
  }
  throw new DurableJsonStoreError("store_locked", filePath, `Durable store is locked: ${filePath}`);
}

function parseCandidate<T>(candidatePath: string, validate: DurableJsonStoreOptions<T>["validate"]) {
  const value = JSON.parse(readFileSync(candidatePath, "utf8")) as unknown;
  if (!validate(value)) {
    throw new DurableJsonStoreError("store_invalid", candidatePath, `Durable store failed schema validation: ${candidatePath}`);
  }
  return value;
}

function atomicWrite<T>(filePath: string, value: T, preserveBackup = true) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const backupPath = `${filePath}.bak`;
  const backupTemporaryPath = `${backupPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    if (preserveBackup && existsSync(filePath)) {
      copyFileSync(filePath, backupTemporaryPath);
      renameSync(backupTemporaryPath, backupPath);
    }
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    const descriptor = openSync(temporaryPath, "r");
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporaryPath, filePath);
    try {
      const directoryDescriptor = openSync(path.dirname(filePath), "r");
      try {
        fsyncSync(directoryDescriptor);
      } finally {
        closeSync(directoryDescriptor);
      }
    } catch {
      // Some filesystems do not expose directory descriptors; the file itself is already synced.
    }
  } finally {
    rmSync(temporaryPath, { force: true });
    rmSync(backupTemporaryPath, { force: true });
  }
}

function readOrRecover<T>(options: DurableJsonStoreOptions<T>) {
  if (!existsSync(options.filePath)) return options.initial();
  try {
    return parseCandidate(options.filePath, options.validate);
  } catch (primaryError) {
    const corruptPath = `${options.filePath}.corrupt-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
    renameSync(options.filePath, corruptPath);
    const backupPath = `${options.filePath}.bak`;
    if (existsSync(backupPath)) {
      try {
        const recovered = parseCandidate(backupPath, options.validate);
        atomicWrite(options.filePath, recovered, false);
        return recovered;
      } catch {
        // The primary error below keeps the original failure and quarantine path visible.
      }
    }
    const reason = primaryError instanceof Error ? primaryError.message : "Unknown JSON parse failure.";
    throw new DurableJsonStoreError(
      "store_corrupt",
      options.filePath,
      `Durable store was quarantined at ${corruptPath}; no valid backup was available. ${reason}`,
    );
  }
}

export function readDurableJsonStore<T>(options: DurableJsonStoreOptions<T>) {
  if (!existsSync(options.filePath)) return options.initial();
  try {
    return parseCandidate(options.filePath, options.validate);
  } catch {
    const release = acquireLock(options.filePath, options.maxLockAgeMs);
    try {
      return readOrRecover(options);
    } finally {
      release();
    }
  }
}

export function migrateDurableJsonStore<T>(
  options: DurableJsonStoreOptions<T>,
  migrate: (value: unknown) => T | null,
) {
  if (!existsSync(options.filePath)) return false;
  const release = acquireLock(options.filePath, options.maxLockAgeMs);
  try {
    let current: unknown;
    try {
      current = JSON.parse(readFileSync(options.filePath, "utf8")) as unknown;
    } catch {
      return false;
    }
    if (options.validate(current)) return false;
    const next = migrate(current);
    if (!next) return false;
    if (!options.validate(next)) {
      throw new DurableJsonStoreError(
        "store_invalid",
        options.filePath,
        `Durable store migration did not produce valid state: ${options.filePath}`,
      );
    }
    atomicWrite(options.filePath, next);
    return true;
  } finally {
    release();
  }
}

export function updateDurableJsonStore<T>(options: DurableJsonStoreOptions<T>, mutate: (current: T) => T) {
  const release = acquireLock(options.filePath, options.maxLockAgeMs);
  try {
    const current = readOrRecover(options);
    const next = mutate(current);
    if (!options.validate(next)) {
      throw new DurableJsonStoreError("store_invalid", options.filePath, `Refusing to persist invalid durable state: ${options.filePath}`);
    }
    atomicWrite(options.filePath, next);
    return next;
  } finally {
    release();
  }
}

export async function withDurableFileLock<T>(
  filePath: string,
  action: () => Promise<T> | T,
  maxLockAgeMs?: number,
) {
  const release = acquireLock(filePath, maxLockAgeMs);
  try {
    return await action();
  } finally {
    release();
  }
}
