import {
  migrateDurableJsonStore,
  readDurableJsonStore,
  updateDurableJsonStore,
  type DurableJsonStoreOptions,
} from "@/features/persistence/durable-json-store";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameTopLevelShape(value: unknown, example: unknown): boolean {
  if (example === null) return value === null || isRecord(value);
  if (Array.isArray(example)) return Array.isArray(value);
  if (!isRecord(example)) return typeof value === typeof example;
  if (!isRecord(value)) return false;

  return Object.entries(example).every(([key, expected]) => {
    if (!(key in value)) return false;
    const actual = value[key];
    if (Array.isArray(expected)) return Array.isArray(actual);
    if (expected === null) return actual === null || isRecord(actual);
    if (isRecord(expected)) return isRecord(actual);
    return typeof actual === typeof expected;
  });
}

function optionsFor<T>(
  filePath: string,
  initial: () => T,
  validate?: (value: unknown) => value is T,
): DurableJsonStoreOptions<T> {
  const initialValue = initial();
  return {
    filePath,
    initial: () => initialValue,
    validate:
      validate ||
      ((value: unknown): value is T => sameTopLevelShape(value, initialValue)),
  };
}

export function migrateJsonFileDurably<T>(
  filePath: string,
  initial: () => T,
  migrate: (value: unknown) => T | null,
  validate?: (value: unknown) => value is T,
) {
  return migrateDurableJsonStore(
    optionsFor(filePath, initial, validate),
    migrate,
  );
}

export function readJsonFileDurably<T>(
  filePath: string,
  initial: () => T,
  validate?: (value: unknown) => value is T,
) {
  return readDurableJsonStore(optionsFor(filePath, initial, validate));
}

export function replaceJsonFileDurably<T>(
  filePath: string,
  value: T,
  validate?: (value: unknown) => value is T,
) {
  return updateDurableJsonStore(
    optionsFor(filePath, () => value, validate),
    () => value,
  );
}

export function updateJsonFileDurably<T>(
  filePath: string,
  initial: () => T,
  mutate: (current: T) => T,
  validate?: (value: unknown) => value is T,
) {
  return updateDurableJsonStore(
    optionsFor(filePath, initial, validate),
    mutate,
  );
}
