import assert from "node:assert/strict";
import test from "node:test";

import { buildArtifactFederationTrustState } from "@/features/artifacts/federation-trust-evidence";

function input(rehearsal = true) {
  return {
    adapters: {
      targets: [{ supportsImmutableVersion: true, supportsDigestVerification: true }],
      totals: { targets: 1, digestVerified: 1 },
      policy: { remoteRoundTripReceiptRequired: true, previewAdaptersMayMutateRemote: false },
    },
    publisherTrust: { totals: { active: 1, revoked: 1 } },
    provenance: { latestPassing: { id: "provenance-1" } },
    registry: { totals: { records: 1, verified: 1 } },
    staging: { latestPassing: { id: "read-back-1", checks: { publisherSignatureVerified: true, remoteManifestReadBackMatched: true, remotePackageReadBackMatched: true, immutableReferencePresent: true } } },
    installs: { latestPassing: { checks: { trustedPolicyPassed: true, atomicInstall: true } } },
    rehearsal: rehearsal ? {
      id: "rehearsal-1",
      status: "pass" as const,
      artifact: { id: "local-rehearsal", version: "1.0.0", registryRecordId: "registry-1", stagingReceiptId: "staging-1", installReceiptId: "install-1" },
      checks: { activePublisherSignatureVerified: true, revokedPublisherDenied: true, localRegistryRoundTripVerified: true, trustedInstallPassed: true, signedReadBackMatched: true, tamperedReadBackDenied: true },
    } : null,
  };
}

test("federation trust needs immutable, signed, revocable, and installable local evidence", () => {
  const state = buildArtifactFederationTrustState(input() as Parameters<typeof buildArtifactFederationTrustState>[0]);
  assert.equal(state.localStatus, "pass");
  assert.equal(state.productionStatus, "hold");
  assert.equal(state.checks.revokedOrTamperedArtifactDenied, true);
  assert.equal(state.summary.signedReadBackReceiptId, "read-back-1");
});

test("missing rehearsal denial or remote-mutation guard fails closed", () => {
  const missingRehearsal = buildArtifactFederationTrustState(input(false) as Parameters<typeof buildArtifactFederationTrustState>[0]);
  assert.equal(missingRehearsal.localStatus, "hold");
  assert.equal(missingRehearsal.checks.revokedOrTamperedArtifactDenied, false);
  const unsafe = input();
  unsafe.adapters.policy.previewAdaptersMayMutateRemote = true;
  const unsafeState = buildArtifactFederationTrustState(unsafe as Parameters<typeof buildArtifactFederationTrustState>[0]);
  assert.equal(unsafeState.localStatus, "hold");
  assert.equal(unsafeState.checks.remoteMutationDisabled, false);
});
