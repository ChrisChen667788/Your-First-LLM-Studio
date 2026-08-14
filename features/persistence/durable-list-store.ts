import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

type ListStore<T> = {
  schemaVersion: string;
} & Record<string, T[] | string>;

function options<T>(schemaVersion: string, listKey: string) {
  const initial = (): ListStore<T> => ({
    schemaVersion,
    [listKey]: [],
  });
  const validate = (value: unknown): value is ListStore<T> => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schemaVersion === schemaVersion && Array.isArray(candidate[listKey]);
  };
  return { initial, validate };
}

export function readDurableList<T>(
  filePath: string,
  schemaVersion: string,
  listKey: string,
) {
  const { initial, validate } = options<T>(schemaVersion, listKey);
  const store = readJsonFileDurably(filePath, initial, validate);
  return store[listKey] as T[];
}

export function prependDurableListEntry<T>(
  filePath: string,
  schemaVersion: string,
  listKey: string,
  entry: T,
  limit: number,
) {
  const { initial, validate } = options<T>(schemaVersion, listKey);
  return updateJsonFileDurably(
    filePath,
    initial,
    (store) => ({
      ...store,
      [listKey]: [entry, ...(store[listKey] as T[])].slice(0, limit),
    }),
    validate,
  );
}
