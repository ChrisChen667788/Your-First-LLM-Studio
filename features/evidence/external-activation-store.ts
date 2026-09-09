import {
  appendExternalEvidenceActivationDecisionReceipt,
  appendExternalEvidenceActivationObservation,
  appendExternalEvidenceActivationQuarantine,
  emptyExternalEvidenceActivationStore,
  insertExternalEvidenceActivationDecisionRequest,
  insertExternalEvidenceActivationManifest,
  type ExternalEvidenceActivationDecisionReceipt,
  type ExternalEvidenceActivationDecisionRequest,
  type ExternalEvidenceActivationManifest,
  type ExternalEvidenceActivationObservation,
  type ExternalEvidenceActivationQuarantine,
  type ExternalEvidenceActivationStore,
  validateExternalEvidenceActivationStore,
} from "@/features/evidence/external-activation";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v5.4.0-v5.5.4-external-evidence-activation.json",
);

const options = {
  filePath: STORE_PATH,
  initial: emptyExternalEvidenceActivationStore,
  validate: validateExternalEvidenceActivationStore,
};

export function externalEvidenceActivationStorePath() {
  return STORE_PATH;
}

export function readExternalEvidenceActivationStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function upsertExternalEvidenceActivationManifestDurably(manifest: ExternalEvidenceActivationManifest): ReturnType<typeof insertExternalEvidenceActivationManifest> {
  let result: ReturnType<typeof insertExternalEvidenceActivationManifest> | null = null;
  updateJsonFileDurably(options.filePath, options.initial, (store) => {
    result = insertExternalEvidenceActivationManifest(store, manifest);
    return result.store;
  }, options.validate);
  if (!result) throw new Error("External evidence activation manifest was not stored.");
  return result;
}

export function appendExternalEvidenceActivationObservationDurably(observation: ExternalEvidenceActivationObservation) {
  let result: ReturnType<typeof appendExternalEvidenceActivationObservation> | null = null;
  updateJsonFileDurably(options.filePath, options.initial, (store) => {
    result = appendExternalEvidenceActivationObservation(store, observation);
    return result.store;
  }, options.validate);
  if (!result) throw new Error("External evidence activation observation was not stored.");
  return result;
}

export function appendExternalEvidenceActivationQuarantineDurably(quarantine: ExternalEvidenceActivationQuarantine) {
  let result: ReturnType<typeof appendExternalEvidenceActivationQuarantine> | null = null;
  updateJsonFileDurably(options.filePath, options.initial, (store) => {
    result = appendExternalEvidenceActivationQuarantine(store, quarantine);
    return result.store;
  }, options.validate);
  if (!result) throw new Error("External evidence activation quarantine was not stored.");
  return result;
}

export function upsertExternalEvidenceActivationDecisionRequestDurably(request: ExternalEvidenceActivationDecisionRequest) {
  let result: ReturnType<typeof insertExternalEvidenceActivationDecisionRequest> | null = null;
  updateJsonFileDurably(options.filePath, options.initial, (store) => {
    result = insertExternalEvidenceActivationDecisionRequest(store, request);
    return result.store;
  }, options.validate);
  if (!result) throw new Error("External evidence activation decision request was not stored.");
  return result;
}

export function appendExternalEvidenceActivationDecisionReceiptDurably(receipt: ExternalEvidenceActivationDecisionReceipt) {
  let result: ReturnType<typeof appendExternalEvidenceActivationDecisionReceipt> | null = null;
  updateJsonFileDurably(options.filePath, options.initial, (store) => {
    result = appendExternalEvidenceActivationDecisionReceipt(store, receipt);
    return result.store;
  }, options.validate);
  if (!result) throw new Error("External evidence activation decision receipt was not stored.");
  return result;
}

export type { ExternalEvidenceActivationStore };
