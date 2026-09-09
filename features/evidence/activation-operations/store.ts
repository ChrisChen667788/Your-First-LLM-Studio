import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { readJsonFileDurably, updateJsonFileDurably } from "@/features/persistence/durable-json-file";
import { ActivationOperationsError, emptyActivationOperationsStore, operationsStoreSchema, type ActivationOperationsStore } from "./contracts";

export function validateActivationOperationsStore(input: unknown): input is ActivationOperationsStore {
  return operationsStoreSchema.safeParse(input).success;
}

export function loadOperationsPolicyFile(filePath: string) {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.size > 128 * 1024 || (metadata.mode & 0o022) !== 0) throw new Error("Untrusted policy file.");
    return JSON.parse(readFileSync(descriptor, "utf8")) as unknown;
  } catch {
    throw new ActivationOperationsError("policy-invalid", 503);
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}

export function createActivationOperationsStore(filePath = process.env.FIRST_LLM_ACTIVATION_OPERATIONS_STORE_PATH || getLocalAgentDataPath("experiments", "activation-operations.json")) {
  return {
    filePath,
    read() { return readJsonFileDurably(filePath, emptyActivationOperationsStore, validateActivationOperationsStore); },
    update(mutate: (store: ActivationOperationsStore) => ActivationOperationsStore) {
      return updateJsonFileDurably(filePath, emptyActivationOperationsStore, mutate, validateActivationOperationsStore);
    },
  };
}
