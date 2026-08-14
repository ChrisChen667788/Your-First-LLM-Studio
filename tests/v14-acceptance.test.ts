import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-v14-acceptance-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("enterprise identity contract pins issuer, rotates keys, and verifies signed delivery", async () => {
  const identity = await import("@/features/governance/enterprise-identity-acceptance");
  const delivery = await import("@/features/governance/identity-event-delivery");
  const contract = identity.evaluateEnterpriseIdentityContract({
    configuredIssuer: "https://identity.example.test",
    discoveredIssuer: "https://identity.example.test/",
    previousKeyIds: ["old-key"],
    currentKeyIds: ["old-key", "new-key"],
  });
  assert.equal(contract.oidcIssuerPinned, true);
  assert.equal(contract.jwksRotationSafe, true);

  const envelope = {
    deliveryId: "delivery-1",
    timestamp: Date.now(),
    body: JSON.stringify({ type: "user.deactivated" }),
  };
  const secret = "test-secret";
  const signature = delivery.signIdentityEventDelivery(envelope, secret);
  assert.equal(
    delivery.verifyIdentityEventDelivery({
      ...envelope,
      signature,
      secret,
      now: envelope.timestamp,
    }).signatureValid,
    true,
  );
  assert.throws(
    () => delivery.verifyIdentityEventDelivery({
      ...envelope,
      signature,
      secret,
      now: envelope.timestamp + 10 * 60_000,
    }),
    (error) =>
      error instanceof delivery.IdentityEventDeliveryError &&
      error.code === "identity_event_stale",
  );
});

test("distributed worker policy reclaims expired leases and fences stale owners", async () => {
  const { simulateDistributedWorkflowLeaseRecovery } = await import(
    "@/features/workflows/worker-lease-policy"
  );
  const simulation = simulateDistributedWorkflowLeaseRecovery();
  assert.deepEqual(simulation.checks, {
    exclusiveLease: true,
    expiredLeaseRecovered: true,
    staleWorkerFenced: true,
    heartbeatExtended: true,
    recoveryReceiptComplete: true,
  });
  assert.equal(
    simulation.recovered.fenceToken,
    simulation.first.fenceToken + 1,
  );
});

test("quality CI rehearsal requires frozen artifacts, three seeds, confidence, and calibration", async () => {
  const { runQualityCiGateRehearsal } = await import(
    "@/features/evaluation/quality-ci-gate"
  );
  const receipt = runQualityCiGateRehearsal();
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.statistics.seeds, 3);
  assert.equal(receipt.statistics.samples, 36);
  assert.equal(receipt.checks.ciDecisionReproducible, true);
  assert.match(receipt.decisionDigest, /^[a-f0-9]{64}$/u);
});

test("v1.4 acceptance aggregates exactly fifteen passing local slices", async () => {
  const { runV14AcceptanceBatch } = await import(
    "@/features/experiments/v14-acceptance-batch"
  );
  const receipt = runV14AcceptanceBatch();
  assert.equal(receipt.localStatus, "pass");
  assert.equal(receipt.productionStatus, "hold");
  assert.deepEqual(receipt.totals, { slices: 15, passed: 15, held: 0 });
  assert.equal(new Set(receipt.slices.map((slice) => slice.id)).size, 15);
  assert.ok(receipt.productionBlockers.length >= 3);
});
