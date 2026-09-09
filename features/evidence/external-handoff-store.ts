import {
  appendExternalEvidenceHandoffObservation,
  emptyExternalEvidenceHandoffStore,
  insertExternalEvidenceHandoff,
  type ExternalEvidenceHandoff,
  type ExternalEvidenceHandoffObservation,
  type ExternalEvidenceHandoffStore,
  validateExternalEvidenceHandoffStore,
} from "@/features/evidence/external-handoff";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v5.0.0-v5.1.4-external-evidence-handoffs.json",
);

const options = {
  filePath: STORE_PATH,
  initial: emptyExternalEvidenceHandoffStore,
  validate: validateExternalEvidenceHandoffStore,
};

export function externalEvidenceHandoffStorePath() {
  return STORE_PATH;
}

export function readExternalEvidenceHandoffStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function upsertExternalEvidenceHandoffDurably(handoff: ExternalEvidenceHandoff) {
  let result: ReturnType<typeof insertExternalEvidenceHandoff> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertExternalEvidenceHandoff(store, handoff);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence handoff was not stored.");
  return result;
}

export function appendExternalEvidenceHandoffObservationDurably(observation: ExternalEvidenceHandoffObservation) {
  let result: ExternalEvidenceHandoffStore | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = appendExternalEvidenceHandoffObservation(store, observation);
      return result;
    },
    options.validate,
  );
  if (!result) throw new Error("External evidence handoff observation was not stored.");
  return result;
}
