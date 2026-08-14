import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import {
  acceptIdentityEventDelivery,
  IdentityEventDeliveryError,
  signIdentityEventDelivery,
} from "@/features/governance/identity-event-delivery";
import { runIdentityWorkspaceMappingRehearsal } from "@/features/governance/identity-workspace-mapping";
import { rehearseSharedAssetAudit } from "@/features/governance/shared-asset-audit";
import {
  prependDurableReceipt,
  readDurableReceipts,
} from "@/features/persistence/durable-receipt-store";

export const ENTERPRISE_IDENTITY_ACCEPTANCE_SCHEMA_VERSION =
  "governance.enterprise-identity-acceptance.v1" as const;

export type EnterpriseIdentityAcceptanceChecks = {
  oidcIssuerPinned: boolean;
  jwksRotationSafe: boolean;
  signedDeliveryAccepted: boolean;
  replayDeliveryDenied: boolean;
  deprovisionAndAuditEnforced: boolean;
};

export type EnterpriseIdentityAcceptanceReceipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "hold";
  scope: "local-contract";
  checks: EnterpriseIdentityAcceptanceChecks;
  blockers: string[];
  productionBlockers: string[];
  evidence: {
    deliveryId: string;
    bodyDigest: string | null;
    mappingChecks: Record<string, boolean>;
    assetAuditReceiptId: string;
  };
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(
  DATA_DIR,
  "governance",
  "enterprise-identity-acceptance.json",
);

function normalizeIssuer(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

export function evaluateEnterpriseIdentityContract(input: {
  configuredIssuer: string;
  discoveredIssuer: string;
  previousKeyIds: string[];
  currentKeyIds: string[];
}) {
  const previous = new Set(input.previousKeyIds.filter(Boolean));
  const current = new Set(input.currentKeyIds.filter(Boolean));
  const overlappingKeys = [...previous].filter((keyId) => current.has(keyId));
  const introducedKeys = [...current].filter((keyId) => !previous.has(keyId));
  return {
    oidcIssuerPinned:
      normalizeIssuer(input.configuredIssuer).startsWith("https://") &&
      normalizeIssuer(input.configuredIssuer) ===
        normalizeIssuer(input.discoveredIssuer),
    jwksRotationSafe:
      previous.size > 0 &&
      current.size > 0 &&
      overlappingKeys.length > 0 &&
      introducedKeys.length > 0,
    overlappingKeys,
    introducedKeys,
  };
}

export function runEnterpriseIdentityAcceptance() {
  const contract = evaluateEnterpriseIdentityContract({
    configuredIssuer: "https://identity.example.test",
    discoveredIssuer: "https://identity.example.test/",
    previousKeyIds: ["signing-key-2026-07"],
    currentKeyIds: ["signing-key-2026-07", "signing-key-2026-08"],
  });
  const now = Date.now();
  const deliveryId = `identity-acceptance-${randomUUID()}`;
  const body = JSON.stringify({
    type: "scim.group.membership.updated",
    groupId: "engineering",
    subjectId: "oidc-disabled",
    active: false,
  });
  const secret = `local-identity-secret-${randomUUID()}`;
  const signature = signIdentityEventDelivery(
    { deliveryId, timestamp: now, body },
    secret,
  );
  const accepted = acceptIdentityEventDelivery({
    deliveryId,
    timestamp: now,
    body,
    signature,
    secret,
    now,
  });
  let replayDeliveryDenied = false;
  try {
    acceptIdentityEventDelivery({
      deliveryId,
      timestamp: now,
      body,
      signature,
      secret,
      now,
    });
  } catch (error) {
    replayDeliveryDenied =
      error instanceof IdentityEventDeliveryError &&
      error.code === "identity_event_replay";
  }
  const mapping = runIdentityWorkspaceMappingRehearsal();
  const assetAudit = rehearseSharedAssetAudit();
  const checks: EnterpriseIdentityAcceptanceChecks = {
    oidcIssuerPinned: contract.oidcIssuerPinned,
    jwksRotationSafe: contract.jwksRotationSafe,
    signedDeliveryAccepted: accepted.bodyDigest.length === 64,
    replayDeliveryDenied,
    deprovisionAndAuditEnforced:
      mapping.checks.inactiveScimUserDenied &&
      assetAudit.checks.auditChainVerified,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Enterprise identity check failed: ${check}.`);
  const receipt: EnterpriseIdentityAcceptanceReceipt = {
    id: `enterprise-identity-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "hold" : "pass",
    scope: "local-contract",
    checks,
    blockers,
    productionBlockers: [
      "A real OIDC issuer, JWKS rotation, and authenticated non-loopback login receipt are required.",
      "A real SCIM provider lifecycle and organization-owned signing secret are required.",
      "External immutable audit export and organization sign-off are required.",
    ],
    evidence: {
      deliveryId,
      bodyDigest: accepted.bodyDigest,
      mappingChecks: mapping.checks,
      assetAuditReceiptId: assetAudit.id,
    },
  };
  prependDurableReceipt(
    STORE_FILE,
    ENTERPRISE_IDENTITY_ACCEPTANCE_SCHEMA_VERSION,
    receipt,
    100,
  );
  return receipt;
}

export function readEnterpriseIdentityAcceptanceEvidence() {
  const receipts = readDurableReceipts<EnterpriseIdentityAcceptanceReceipt>(
    STORE_FILE,
    ENTERPRISE_IDENTITY_ACCEPTANCE_SCHEMA_VERSION,
  );
  return {
    ok: true as const,
    schemaVersion: ENTERPRISE_IDENTITY_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    receipts,
    latestPassing: receipts.find((receipt) => receipt.status === "pass") || null,
    productionBlockers:
      receipts[0]?.productionBlockers || [
        "Enterprise identity acceptance has not been rehearsed locally.",
      ],
    path: STORE_FILE,
  };
}
