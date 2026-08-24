import { createHash, randomUUID } from "node:crypto";

import { evaluateModelCompatibility, readModelCompatibilityEvidence } from "@/features/models/compatibility-manifest";
import { readModelContentDedupEvidence, runModelContentDedupRehearsal } from "@/features/models/content-deduplication";
import { readExternalStorageMigrationEvidence, rehearseExternalStorageMigration } from "@/features/models/external-storage-migration";
import { readHubSessionReconciliationEvidence, reconcileHubTransferSessions } from "@/features/models/hub-session-reconciliation";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readModelRemovalLifecycleEvidence, rehearseModelRemovalLifecycle } from "@/features/models/removal-lifecycle";
import { readServerSwitchControllerEvidence, rehearseServerSwitchController } from "@/features/models/server-switch-controller";
import { readModelSourceManifestEvidence, rehearseModelSourceManifest } from "@/features/models/source-manifest";
import { readModelTransferSchedulerEvidence, rehearseModelTransferScheduler } from "@/features/models/transfer-scheduler";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

export const MODEL_SUPPLY_CHAIN_OPERATIONS_SCHEMA_VERSION =
  "models.supply-chain-operations.v1" as const;
const STORE_SCHEMA_VERSION = "models.supply-chain-operations-store.v1" as const;
const RECEIPT_PATH = getLocalAgentDataPath("models", "v1.11.1-supply-chain-operations.json");

type Status = "pass" | "hold";
type Rehearsal = {
  id: string;
  checks: {
    sourceManifest: boolean;
    transferScheduler: boolean;
    contentDeduplication: boolean;
    placementMigrationFixture: boolean;
    compatibilityPreflight: boolean;
    removalLifecycle: boolean;
    activationRollback: boolean;
  };
  receipts: Record<string, string>;
};

export type ModelSupplyChainOperationsState = {
  localStatus: Status;
  productionStatus: "hold";
  checks: {
    immutableAuthenticatedHubReceipt: boolean;
    multiFileChecksumsBound: boolean;
    reconciledHubSession: boolean;
    sourceManifestRehearsed: boolean;
    transferSchedulerRehearsed: boolean;
    contentDeduplicationRehearsed: boolean;
    placementMigrationRehearsed: boolean;
    compatibilityPreflightRehearsed: boolean;
    removalLifecycleRehearsed: boolean;
    activationRollbackRehearsed: boolean;
  };
  summary: {
    hubReceiptId: string | null;
    hubRepository: string | null;
    hubResolvedRevision: string | null;
    hubFiles: number;
    verifiedHubChecksums: number;
    reconciliationReceiptId: string | null;
    dedupReceiptId: string | null;
    migrationReceiptId: string | null;
    rehearsal: Rehearsal | null;
  };
  blockers: string[];
  stateDigest: string;
};

export type ModelSupplyChainOperationsReceipt = ModelSupplyChainOperationsState & {
  id: string;
  generatedAt: string;
  evidenceDigest: string;
};

type Inputs = {
  hub: ReturnType<typeof readHubTransferSessions>;
  reconciliation: ReturnType<typeof readHubSessionReconciliationEvidence>;
  deduplication: ReturnType<typeof readModelContentDedupEvidence>;
  migration: ReturnType<typeof readExternalStorageMigrationEvidence>;
  compatibility: ReturnType<typeof readModelCompatibilityEvidence>;
  sourceManifest: ReturnType<typeof readModelSourceManifestEvidence>;
  scheduler: ReturnType<typeof readModelTransferSchedulerEvidence>;
  removal: ReturnType<typeof readModelRemovalLifecycleEvidence>;
  switching: ReturnType<typeof readServerSwitchControllerEvidence>;
  rehearsal: Rehearsal | null;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildModelSupplyChainOperationsState(input: Inputs): ModelSupplyChainOperationsState {
  const hubReceipt = input.hub.latestPassing || null;
  const rehearsal = input.rehearsal;
  const checks = {
    immutableAuthenticatedHubReceipt: Boolean(hubReceipt && hubReceipt.authentication.verified && /^[a-f0-9]{40}$/iu.test(hubReceipt.resolvedRevision) && hubReceipt.checks.immutableRevision),
    multiFileChecksumsBound: Boolean(hubReceipt && hubReceipt.totals.files >= 2 && hubReceipt.totals.files === hubReceipt.totals.verifiedChecksums && hubReceipt.checks.expectedChecksumsMatched && hubReceipt.checks.destinationBound),
    reconciledHubSession: Boolean(hubReceipt && input.reconciliation.latestPassing && input.reconciliation.latestPassing.sessions > 0 && input.reconciliation.latestPassing.missing === 0 && input.reconciliation.latestPassing.checksumMetadataMissing === 0),
    sourceManifestRehearsed: Boolean(rehearsal?.checks.sourceManifest && input.sourceManifest.latestPassing),
    transferSchedulerRehearsed: Boolean(rehearsal?.checks.transferScheduler && input.scheduler.latestPassing),
    contentDeduplicationRehearsed: Boolean(rehearsal?.checks.contentDeduplication && input.deduplication.latestPassing),
    placementMigrationRehearsed: Boolean(rehearsal?.checks.placementMigrationFixture && input.migration.latestPassing?.mode === "fixture"),
    compatibilityPreflightRehearsed: Boolean(rehearsal?.checks.compatibilityPreflight && input.compatibility.latestPassing),
    removalLifecycleRehearsed: Boolean(rehearsal?.checks.removalLifecycle && input.removal.latestPassing),
    activationRollbackRehearsed: Boolean(rehearsal?.checks.activationRollback && input.switching.latestPassing),
  };
  const blockers = [
    ...(checks.immutableAuthenticatedHubReceipt ? [] : ["No authenticated Hub receipt binds a resolved immutable revision."]),
    ...(checks.multiFileChecksumsBound ? [] : ["No completed multi-file Hub receipt binds every verified checksum to its destination."]),
    ...(checks.reconciledHubSession ? [] : ["No non-empty Hub-session reconciliation receipt proves completed files remain present and checksummed."]),
    ...(checks.sourceManifestRehearsed ? [] : ["The local source-manifest rehearsal is missing."]),
    ...(checks.transferSchedulerRehearsed ? [] : ["The transfer scheduler/backoff rehearsal is missing."]),
    ...(checks.contentDeduplicationRehearsed ? [] : ["The content-address deduplication rehearsal is missing."]),
    ...(checks.placementMigrationRehearsed ? [] : ["The isolated placement migration rehearsal is missing."]),
    ...(checks.compatibilityPreflightRehearsed ? [] : ["The conversion/runtime compatibility preflight rehearsal is missing."]),
    ...(checks.removalLifecycleRehearsed ? [] : ["The quarantine, shared-blob, and final-cleanup rehearsal is missing."]),
    ...(checks.activationRollbackRehearsed ? [] : ["The drain-aware activation rollback rehearsal is missing."]),
    "Authenticated multi-Hub transfers, converter execution, physical external-volume reconnect repair, mirror recovery, garbage collection on live model stores, and organization-managed license/malware review remain production HOLD gates.",
  ];
  const withoutDigest = {
    localStatus: blockers.length === 1 ? ("pass" as const) : ("hold" as const),
    productionStatus: "hold" as const,
    checks,
    summary: {
      hubReceiptId: hubReceipt?.id || null,
      hubRepository: hubReceipt?.repository || null,
      hubResolvedRevision: hubReceipt?.resolvedRevision || null,
      hubFiles: hubReceipt?.totals.files || 0,
      verifiedHubChecksums: hubReceipt?.totals.verifiedChecksums || 0,
      reconciliationReceiptId: input.reconciliation.latestPassing?.id || null,
      dedupReceiptId: input.deduplication.latestPassing?.id || null,
      migrationReceiptId: input.migration.latestPassing?.id || null,
      rehearsal,
    },
    blockers,
  };
  return { ...withoutDigest, stateDigest: digest(withoutDigest) };
}

function readCurrentState(rehearsal: Rehearsal | null) {
  return buildModelSupplyChainOperationsState({
    hub: readHubTransferSessions(),
    reconciliation: readHubSessionReconciliationEvidence(),
    deduplication: readModelContentDedupEvidence(),
    migration: readExternalStorageMigrationEvidence(),
    compatibility: readModelCompatibilityEvidence(),
    sourceManifest: readModelSourceManifestEvidence(),
    scheduler: readModelTransferSchedulerEvidence(),
    removal: readModelRemovalLifecycleEvidence(),
    switching: readServerSwitchControllerEvidence(),
    rehearsal,
  });
}

/** Exercises only local operational mechanics; it never creates a Hub session or contacts a provider. */
export function runModelSupplyChainOperationsRehearsal() {
  const sourceManifest = rehearseModelSourceManifest();
  const scheduler = rehearseModelTransferScheduler();
  const deduplication = runModelContentDedupRehearsal();
  const migration = rehearseExternalStorageMigration();
  const compatibility = evaluateModelCompatibility({ modelId: "local-rehearsal.qwen3-0.6b", format: "gguf", license: "Apache-2.0", tokenizerFiles: ["tokenizer.json"], chatTemplate: "{{ messages }}", parameterBillions: 0.6, quantizationBits: 4, runtime: "ollama" });
  const removal = rehearseModelRemovalLifecycle();
  const switching = rehearseServerSwitchController();
  const reconciliation = reconcileHubTransferSessions();
  const rehearsal: Rehearsal = {
    id: `model-supply-chain-rehearsal-${randomUUID()}`,
    checks: {
      sourceManifest: sourceManifest.status === "pass",
      transferScheduler: scheduler.status === "pass",
      contentDeduplication: deduplication.status === "pass",
      placementMigrationFixture: migration.status === "pass" && migration.mode === "fixture",
      compatibilityPreflight: compatibility.status === "pass",
      removalLifecycle: removal.status === "pass",
      activationRollback: switching.status === "pass",
    },
    receipts: {
      sourceManifest: sourceManifest.id,
      transferScheduler: scheduler.id,
      contentDeduplication: deduplication.id,
      placementMigration: migration.id,
      compatibility: compatibility.id,
      removalLifecycle: removal.id,
      activationRollback: switching.id,
      reconciliation: reconciliation.id,
    },
  };
  const state = readCurrentState(rehearsal);
  const withoutDigest = { id: `model-supply-chain-${randomUUID()}`, generatedAt: new Date().toISOString(), ...state };
  const receipt: ModelSupplyChainOperationsReceipt = { ...withoutDigest, evidenceDigest: digest(withoutDigest) };
  prependDurableReceipt(RECEIPT_PATH, STORE_SCHEMA_VERSION, receipt, 50);
  return { receipt, rehearsal, reconciliation };
}

export function readModelSupplyChainOperationsEvidence() {
  const receipts = readDurableReceipts<ModelSupplyChainOperationsReceipt>(RECEIPT_PATH, STORE_SCHEMA_VERSION);
  const current = readCurrentState(receipts[0]?.summary.rehearsal || null);
  const latest = receipts[0] || null;
  return {
    ok: true as const,
    schemaVersion: MODEL_SUPPLY_CHAIN_OPERATIONS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...current,
    latest: latest?.stateDigest === current.stateDigest ? latest : null,
    latestPassing: receipts.find((receipt) => receipt.localStatus === "pass") || null,
    receipts,
    receiptPath: RECEIPT_PATH,
  };
}
