import os from "os";
import path from "path";
import {
  readDurableJsonStore,
  updateDurableJsonStore,
} from "@/features/persistence/durable-json-store";
import { runIdentityWorkspaceMappingRehearsal } from "@/features/governance/identity-workspace-mapping";
import { runWorkspaceMultiUserConflictRehearsal } from "@/features/governance/workspace-acl-database";

export const GOVERNANCE_REHEARSAL_EVIDENCE_SCHEMA_VERSION =
  "governance.rehearsal-evidence.v1" as const;

type IdentityMappingEvidence = ReturnType<
  typeof runIdentityWorkspaceMappingRehearsal
>;
type MultiUserConflictEvidence = ReturnType<
  typeof runWorkspaceMultiUserConflictRehearsal
>;

type GovernanceRehearsalEvidenceStore = {
  schemaVersion: typeof GOVERNANCE_REHEARSAL_EVIDENCE_SCHEMA_VERSION;
  identityMapping: IdentityMappingEvidence | null;
  multiUserConflict: MultiUserConflictEvidence | null;
};

const dataDir =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const storeOptions = {
  filePath: path.join(dataDir, "governance", "rehearsal-evidence.json"),
  initial: (): GovernanceRehearsalEvidenceStore => ({
    schemaVersion: GOVERNANCE_REHEARSAL_EVIDENCE_SCHEMA_VERSION,
    identityMapping: null,
    multiUserConflict: null,
  }),
  validate: (value: unknown): value is GovernanceRehearsalEvidenceStore => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<GovernanceRehearsalEvidenceStore>;
    return (
      candidate.schemaVersion === GOVERNANCE_REHEARSAL_EVIDENCE_SCHEMA_VERSION &&
      (candidate.identityMapping === null ||
        typeof candidate.identityMapping === "object") &&
      (candidate.multiUserConflict === null ||
        typeof candidate.multiUserConflict === "object")
    );
  },
};

export function readGovernanceRehearsalEvidence() {
  return readDurableJsonStore(storeOptions);
}

export function runAndPersistGovernanceRehearsalEvidence() {
  const identityMapping = runIdentityWorkspaceMappingRehearsal();
  const multiUserConflict = runWorkspaceMultiUserConflictRehearsal();
  const store = updateDurableJsonStore(storeOptions, (current) => ({
    ...current,
    identityMapping,
    multiUserConflict,
  }));
  return {
    ok: identityMapping.ok && multiUserConflict.ok,
    identityMapping,
    multiUserConflict,
    evidenceFile: storeOptions.filePath,
    store,
  };
}
