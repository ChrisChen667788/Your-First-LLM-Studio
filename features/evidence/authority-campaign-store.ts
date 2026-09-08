import {
  appendEvidenceAuthorityReceipt,
  emptyEvidenceAuthorityCampaignStore,
  insertEvidenceAuthorityCampaign,
  insertEvidenceAuthorityProfile,
  type EvidenceAuthorityCampaign,
  type EvidenceAuthorityCampaignStore,
  type EvidenceAuthorityProfile,
  type EvidenceAuthorityReceiptRecord,
  validateEvidenceAuthorityCampaignStore,
} from "@/features/evidence/authority-campaign";
import {
  readJsonFileDurably,
  updateJsonFileDurably,
} from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const STORE_PATH = getLocalAgentDataPath(
  "experiments",
  "v4.8.0-v4.9.4-evidence-authority-campaigns.json",
);

const options = {
  filePath: STORE_PATH,
  initial: emptyEvidenceAuthorityCampaignStore,
  validate: validateEvidenceAuthorityCampaignStore,
};

export function evidenceAuthorityCampaignStorePath() {
  return STORE_PATH;
}

export function readEvidenceAuthorityCampaignStore() {
  return readJsonFileDurably(options.filePath, options.initial, options.validate);
}

export function upsertEvidenceAuthorityProfileDurably(profile: EvidenceAuthorityProfile) {
  let result: ReturnType<typeof insertEvidenceAuthorityProfile> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertEvidenceAuthorityProfile(store, profile);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("Evidence authority profile was not stored.");
  return result;
}

export function insertEvidenceAuthorityCampaignDurably(campaign: EvidenceAuthorityCampaign) {
  let result: ReturnType<typeof insertEvidenceAuthorityCampaign> | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = insertEvidenceAuthorityCampaign(store, campaign);
      return result.store;
    },
    options.validate,
  );
  if (!result) throw new Error("Evidence authority campaign was not stored.");
  return result;
}

export function appendEvidenceAuthorityReceiptDurably(record: EvidenceAuthorityReceiptRecord) {
  let result: EvidenceAuthorityCampaignStore | null = null;
  updateJsonFileDurably(
    options.filePath,
    options.initial,
    (store) => {
      result = appendEvidenceAuthorityReceipt(store, record);
      return result;
    },
    options.validate,
  );
  if (!result) throw new Error("Evidence authority receipt was not stored.");
  return result;
}
