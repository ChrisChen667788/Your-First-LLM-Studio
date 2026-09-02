import { createHash } from "node:crypto";

import { readExternalStorageMigrationEvidence } from "@/features/models/external-storage-migration";
import { readHubSessionReconciliationEvidence } from "@/features/models/hub-session-reconciliation";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readModelAcquisitionRegistry } from "@/features/models/model-acquisition";
import { readModelSupplyChainOperationsEvidence } from "@/features/models/supply-chain-operations-evidence";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readServerLifecycleEvidence } from "@/features/models/server-lifecycle";
import { readServerSwitchControllerEvidence } from "@/features/models/server-switch-controller";

export const MODEL_HUB_OPERATIONS_V3_SCHEMA_VERSION =
  "models.hub-operations-v3.v1" as const;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function readModelHubOperationsV3() {
  const acquisition = readModelAcquisitionRegistry();
  const transfers = readHubTransferSessions();
  const reconciliation = readHubSessionReconciliationEvidence();
  const supplyChain = readModelSupplyChainOperationsEvidence();
  const externalStorage = readExternalStorageMigrationEvidence();
  const instances = readServerInstanceRegistry();
  const lifecycle = readServerLifecycleEvidence();
  const switching = readServerSwitchControllerEvidence();
  const actions = [
    { id: "download", contract: acquisition.schemaVersion, evidence: acquisition.jobs.length > 0 },
    { id: "verify", contract: supplyChain.schemaVersion, evidence: Boolean(supplyChain.latestPassing) },
    { id: "reconcile", contract: reconciliation.schemaVersion, evidence: Boolean(reconciliation.latestPassing) },
    { id: "migrate", contract: externalStorage.schemaVersion, evidence: Boolean(externalStorage.latestPassing) },
    { id: "load-switch-unload", contract: lifecycle.schemaVersion, evidence: Boolean(lifecycle.latestPassing || switching.latestPassing) },
    { id: "serve-inspect", contract: instances.schemaVersion, evidence: instances.instances.length > 0 },
  ];
  const withoutDigest = {
    ok: true as const,
    schemaVersion: MODEL_HUB_OPERATIONS_V3_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: "pass" as const,
    localStatus: actions.every((action) => action.evidence) ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    actions,
    totals: {
      acquisitionJobs: acquisition.jobs.length,
      transferSessions: transfers.sessions.length,
      serverInstances: instances.instances.length,
      evidencedActions: actions.filter((action) => action.evidence).length,
      actions: actions.length,
    },
    disclosure:
      "The canonical operations contract is source-complete. Missing local receipts identify actions that still need a real model transfer, checksum, migration, or runtime lifecycle rehearsal.",
  };
  return { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
}
