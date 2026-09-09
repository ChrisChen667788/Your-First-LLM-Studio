import {
  appendExternalEvidenceRelayQuarantine,
  appendExternalEvidenceRelayReceipt,
  emptyExternalEvidenceRelayStore,
  insertExternalEvidenceRelayConfiguration,
  insertExternalEvidenceRelayRequest,
  type ExternalEvidenceRelayConfiguration,
  type ExternalEvidenceRelayQuarantine,
  type ExternalEvidenceRelayReceipt,
  type ExternalEvidenceRelayRequest,
  type ExternalEvidenceRelayStore,
  validateExternalEvidenceRelayStore,
} from "@/features/evidence/external-relay";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v5.2.0-v5.3.4-external-evidence-relay.json",
);

const options = {
  filePath: STORE_PATH,
  initial: emptyExternalEvidenceRelayStore,
  validate: validateExternalEvidenceRelayStore,
};

export function externalEvidenceRelayStorePath() {
  return STORE_PATH;
}

export function readExternalEvidenceRelayStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function upsertExternalEvidenceRelayConfigurationDurably(configuration: ExternalEvidenceRelayConfiguration) {
  let result: ReturnType<typeof insertExternalEvidenceRelayConfiguration> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertExternalEvidenceRelayConfiguration(store, configuration);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence relay configuration was not stored.");
  return result;
}

export function upsertExternalEvidenceRelayRequestDurably(request: ExternalEvidenceRelayRequest) {
  let result: ReturnType<typeof insertExternalEvidenceRelayRequest> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertExternalEvidenceRelayRequest(store, request);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence relay request was not stored.");
  return result;
}

export function appendExternalEvidenceRelayReceiptDurably(receipt: ExternalEvidenceRelayReceipt) {
  let result: ReturnType<typeof appendExternalEvidenceRelayReceipt> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = appendExternalEvidenceRelayReceipt(store, receipt);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence relay receipt was not stored.");
  return result;
}

export function appendExternalEvidenceRelayQuarantineDurably(quarantine: ExternalEvidenceRelayQuarantine) {
  let result: ReturnType<typeof appendExternalEvidenceRelayQuarantine> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = appendExternalEvidenceRelayQuarantine(store, quarantine);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence relay quarantine record was not stored.");
  return result;
}

export type { ExternalEvidenceRelayStore };
