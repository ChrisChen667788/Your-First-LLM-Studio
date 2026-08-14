import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";

type ReceiptStore<T> = {
  schemaVersion: string;
  receipts: T[];
};

function options<T>(schemaVersion: string) {
  const initial = (): ReceiptStore<T> => ({ schemaVersion, receipts: [] });
  const validate = (value: unknown): value is ReceiptStore<T> => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ReceiptStore<T>>;
    return candidate.schemaVersion === schemaVersion && Array.isArray(candidate.receipts);
  };
  return { initial, validate };
}

export function readDurableReceipts<T>(
  filePath: string,
  schemaVersion: string,
) {
  const { initial, validate } = options<T>(schemaVersion);
  return readJsonFileDurably(filePath, initial, validate).receipts;
}

export function prependDurableReceipt<T>(
  filePath: string,
  schemaVersion: string,
  receipt: T,
  limit: number,
) {
  const { initial, validate } = options<T>(schemaVersion);
  return updateJsonFileDurably(
    filePath,
    initial,
    (store) => ({
      ...store,
      receipts: [receipt, ...store.receipts].slice(0, limit),
    }),
    validate,
  );
}
