import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DurableJsonStoreError,
  readDurableJsonStore,
  updateDurableJsonStore,
} from "@/features/persistence/durable-json-store";
import {
  readJsonFileDurably,
  migrateJsonFileDurably,
  replaceJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

type CounterStore = { schemaVersion: "counter.v1"; count: number };

function fixture() {
  const directory = path.join(os.tmpdir(), `first-llm-durable-${process.pid}-${Date.now()}-${Math.random()}`);
  const filePath = path.join(directory, "counter.json");
  const options = {
    filePath,
    initial: (): CounterStore => ({ schemaVersion: "counter.v1", count: 0 }),
    validate: (value: unknown): value is CounterStore => {
      if (!value || typeof value !== "object") return false;
      const candidate = value as Partial<CounterStore>;
      return candidate.schemaVersion === "counter.v1" && Number.isInteger(candidate.count);
    },
  };
  return { directory, filePath, options };
}

test("durable store writes validated state atomically", () => {
  const { directory, filePath, options } = fixture();
  try {
    updateDurableJsonStore(options, (current) => ({ ...current, count: current.count + 1 }));
    const persisted = readDurableJsonStore(options);
    assert.equal(persisted.count, 1);
    assert.equal(JSON.parse(readFileSync(filePath, "utf8")).count, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable store quarantines a corrupt primary and restores a valid backup", () => {
  const { directory, filePath, options } = fixture();
  try {
    updateDurableJsonStore(options, () => ({ schemaVersion: "counter.v1", count: 1 }));
    updateDurableJsonStore(options, () => ({ schemaVersion: "counter.v1", count: 2 }));
    writeFileSync(filePath, "{not-json", "utf8");
    const recovered = readDurableJsonStore(options);
    assert.equal(recovered.count, 1);
    assert.match(readFileSync(filePath, "utf8"), /"count": 1/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable store fails closed when neither primary nor backup is valid", () => {
  const { directory, filePath, options } = fixture();
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(filePath, "{not-json", "utf8");
    assert.throws(
      () => readDurableJsonStore(options),
      (error: unknown) => error instanceof DurableJsonStoreError && error.code === "store_corrupt",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable store rejects a live concurrent writer lock", () => {
  const { directory, filePath, options } = fixture();
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${filePath}.lock`, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), "utf8");
    assert.throws(
      () => updateDurableJsonStore(options, (current) => current),
      (error: unknown) => error instanceof DurableJsonStoreError && error.code === "store_locked",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable JSON file adapter preserves domain shape across replacement and update", () => {
  const { directory, filePath } = fixture();
  const initial = () => ({ schemaVersion: "sessions.v1", sessions: [] as string[] });
  try {
    replaceJsonFileDurably(filePath, {
      schemaVersion: "sessions.v1",
      sessions: ["session-a"],
    });
    const updated = updateJsonFileDurably(filePath, initial, (current) => ({
      ...current,
      sessions: [...current.sessions, "session-b"],
    }));
    assert.deepEqual(updated.sessions, ["session-a", "session-b"]);
    assert.deepEqual(readJsonFileDurably(filePath, initial), updated);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable JSON file adapter rejects a mismatched top-level domain shape", () => {
  const { directory, filePath } = fixture();
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(filePath, JSON.stringify({ schemaVersion: "sessions.v1", sessions: {} }), "utf8");
    assert.throws(
      () =>
        readJsonFileDurably(filePath, () => ({
          schemaVersion: "sessions.v1",
          sessions: [] as string[],
        })),
      (error: unknown) =>
        error instanceof DurableJsonStoreError && error.code === "store_corrupt",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable JSON file adapter migrates a validated legacy schema atomically", () => {
  const { directory, filePath } = fixture();
  type ArchiveStore = { schemaVersion: 1; archives: Array<{ id: string }> };
  const initial = (): ArchiveStore => ({ schemaVersion: 1, archives: [] });
  const validate = (value: unknown): value is ArchiveStore => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ArchiveStore>;
    return candidate.schemaVersion === 1 && Array.isArray(candidate.archives);
  };
  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(filePath, JSON.stringify({ archives: [{ id: "archive-v0" }] }), "utf8");
    const migrated = migrateJsonFileDurably(
      filePath,
      initial,
      (value) => {
        if (!value || typeof value !== "object") return null;
        const legacy = value as { archives?: Array<{ id: string }> };
        return Array.isArray(legacy.archives)
          ? { schemaVersion: 1, archives: legacy.archives }
          : null;
      },
      validate,
    );
    assert.equal(migrated, true);
    assert.deepEqual(readJsonFileDurably(filePath, initial, validate), {
      schemaVersion: 1,
      archives: [{ id: "archive-v0" }],
    });
    assert.deepEqual(JSON.parse(readFileSync(`${filePath}.bak`, "utf8")), {
      archives: [{ id: "archive-v0" }],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
