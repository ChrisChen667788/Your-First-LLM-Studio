import assert from "node:assert/strict";
import test from "node:test";

import { buildModelSupplyChainOperationsState } from "@/features/models/supply-chain-operations-evidence";

function fixture(hasHub = true) {
  return {
    hub: { latestPassing: hasHub ? { id: "hub-1", repository: "org/model", resolvedRevision: "a".repeat(40), authentication: { verified: true }, checks: { immutableRevision: true, expectedChecksumsMatched: true, destinationBound: true }, totals: { files: 2, verifiedChecksums: 2 } } : null },
    reconciliation: { latestPassing: hasHub ? { id: "reconcile-1", sessions: 1, missing: 0, checksumMetadataMissing: 0 } : null },
    deduplication: { latestPassing: { id: "dedup-1" } },
    migration: { latestPassing: { id: "migration-1", mode: "fixture" } },
    compatibility: { latestPassing: { id: "compat-1" } },
    sourceManifest: { latestPassing: { id: "manifest-1" } },
    scheduler: { latestPassing: { id: "scheduler-1" } },
    removal: { latestPassing: { id: "removal-1" } },
    switching: { latestPassing: { id: "switch-1" } },
    rehearsal: { id: "rehearsal-1", checks: { sourceManifest: true, transferScheduler: true, contentDeduplication: true, placementMigrationFixture: true, compatibilityPreflight: true, removalLifecycle: true, activationRollback: true }, receipts: {} },
  };
}

test("supply-chain operations need both a real authenticated Hub receipt and local lifecycle rehearsals", () => {
  const state = buildModelSupplyChainOperationsState(fixture() as Parameters<typeof buildModelSupplyChainOperationsState>[0]);
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.immutableAuthenticatedHubReceipt, true);
  assert.equal(state.checks.activationRollbackRehearsed, true);
});

test("local mechanics cannot fabricate an authenticated Hub transfer", () => {
  const state = buildModelSupplyChainOperationsState(fixture(false) as Parameters<typeof buildModelSupplyChainOperationsState>[0]);
  assert.equal(state.localStatus, "hold");
  assert.equal(state.checks.immutableAuthenticatedHubReceipt, false);
  assert.equal(state.checks.multiFileChecksumsBound, false);
  assert.equal(state.checks.sourceManifestRehearsed, true);
});
