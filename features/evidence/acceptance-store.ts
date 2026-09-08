import {
  emptyEvidenceAcceptanceStore,
  insertEvidenceAcceptancePackage,
  replaceEvidenceAcceptancePackage,
  type EvidenceAcceptancePackage,
  type EvidenceAcceptanceStore,
  validateEvidenceAcceptanceStore,
} from "@/features/evidence/acceptance-lifecycle";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.6.0-v4.7.4-evidence-acceptance-packages.json",
);

const options = {
  filePath: STORE_PATH,
  initial: emptyEvidenceAcceptanceStore,
  validate: validateEvidenceAcceptanceStore,
};

export function evidenceAcceptanceStorePath() {
  return STORE_PATH;
}

export function readEvidenceAcceptanceStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function insertEvidenceAcceptancePackageDurably(pkg: EvidenceAcceptancePackage) {
  let result: ReturnType<typeof insertEvidenceAcceptancePackage> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertEvidenceAcceptancePackage(store, pkg);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("Evidence acceptance package was not stored.");
  return result;
}

export function mutateEvidenceAcceptancePackageDurably(input: {
  packageId: string;
  expectedRevision: number;
  mutate: (pkg: EvidenceAcceptancePackage) => EvidenceAcceptancePackage;
}) {
  let result: ReturnType<typeof replaceEvidenceAcceptancePackage> | null = null;
  updateJsonFileDurably<EvidenceAcceptanceStore>(
    options.filePath,
    options.initial,
    (store) => {
      result = replaceEvidenceAcceptancePackage({ store, ...input });
      return result.store;
    },
    options.validate,
  );
  const updated = result as ReturnType<typeof replaceEvidenceAcceptancePackage> | null;
  if (!updated) throw new Error("Evidence acceptance package was not updated.");
  return updated.pkg;
}
