import { createHash, verify as verifySignature } from "crypto";
import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

export const DESKTOP_EXTERNAL_ACCEPTANCE_SCHEMA_VERSION = "desktop.external-acceptance.v1" as const;
const REQUEST_SCHEMA = "desktop.external-acceptance-request.v1";
const RECEIPT_SCHEMA = "desktop.external-acceptance-receipt.v1";

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "local-agent-lab",
  "observability",
);
const REQUEST_FILE = process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_REQUEST_PATH || path.join(DATA_DIR, "desktop-external-acceptance-request.json");
const RECEIPT_FILE = process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_RECEIPT_PATH || path.join(DATA_DIR, "desktop-external-acceptance-receipt.json");
const SIGNATURE_FILE = process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_SIGNATURE_PATH || `${RECEIPT_FILE}.sig`;
const PUBLIC_KEY_FILE = process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_PUBLIC_KEY_PATH || `${RECEIPT_FILE}.pub.pem`;
const TRUST_FILE = path.join(DATA_DIR, "desktop-external-acceptance-trust.json");

type AcceptanceRequest = {
  schemaVersion?: string;
  requestId?: string;
  version?: string;
  releaseHostFingerprint?: string;
  package?: { fileName?: string; bytes?: number; sha256?: string };
  requiredChecks?: string[];
};

type AcceptanceReceipt = {
  schemaVersion?: string;
  generatedAt?: string;
  status?: string;
  requestId?: string;
  requestDigest?: string;
  version?: string;
  package?: { fileName?: string; sha256?: string };
  host?: { fingerprint?: string; releaseHostDifferent?: boolean; osVersion?: string; architecture?: string };
  approver?: { organizationId?: string; operatorId?: string; keyId?: string };
  checks?: Record<string, boolean>;
};

type TrustRecord = {
  schemaVersion?: string;
  expectedPublicKeySha256?: string;
  verifiedOutOfBand?: boolean;
  importedAt?: string;
};

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function sha256(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isDurableIdentity(value: string | undefined) {
  return Boolean(value && !/^(local|test|rehearsal|fixture|unknown)/i.test(value));
}

export function readDesktopExternalAcceptance() {
  const request = readJson<AcceptanceRequest>(REQUEST_FILE);
  const receipt = readJson<AcceptanceReceipt>(RECEIPT_FILE);
  const trust = readJson<TrustRecord>(TRUST_FILE);
  const requestBytes = existsSync(REQUEST_FILE) ? readFileSync(REQUEST_FILE) : null;
  const receiptBytes = existsSync(RECEIPT_FILE) ? readFileSync(RECEIPT_FILE) : null;
  const signature = existsSync(SIGNATURE_FILE) ? readFileSync(SIGNATURE_FILE) : null;
  const publicKey = existsSync(PUBLIC_KEY_FILE) ? readFileSync(PUBLIC_KEY_FILE) : null;
  const expectedKeySha256 = process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_KEY_SHA256?.trim() || trust?.expectedPublicKeySha256 || "";
  const actualKeySha256 = publicKey ? sha256(publicKey) : "";

  let signatureVerified = false;
  if (receiptBytes && signature && publicKey) {
    try {
      signatureVerified = verifySignature("RSA-SHA256", receiptBytes, publicKey, signature);
    } catch {
      signatureVerified = false;
    }
  }

  const requiredChecks = request?.requiredChecks || [];
  const checksComplete = requiredChecks.length > 0 && requiredChecks.every((name) => receipt?.checks?.[name] === true);
  const requestDigestMatched = Boolean(requestBytes && receipt?.requestDigest === sha256(requestBytes));
  const packageMatched = Boolean(
    request?.package?.sha256 &&
      request.package.sha256 === receipt?.package?.sha256 &&
      request.package.fileName === receipt?.package?.fileName,
  );
  const hostIndependent = Boolean(
    request?.releaseHostFingerprint &&
      receipt?.host?.fingerprint &&
      request.releaseHostFingerprint !== receipt.host.fingerprint &&
      receipt.host.releaseHostDifferent,
  );
  const identityTrusted = Boolean(
    isDurableIdentity(receipt?.approver?.organizationId) &&
      isDurableIdentity(receipt?.approver?.operatorId),
  );
  const keyPinned = Boolean(
    expectedKeySha256 &&
      actualKeySha256 &&
      expectedKeySha256 === actualKeySha256 &&
      (process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_KEY_SHA256 || trust?.verifiedOutOfBand),
  );
  const contractMatched = Boolean(
    request?.schemaVersion === REQUEST_SCHEMA &&
      receipt?.schemaVersion === RECEIPT_SCHEMA &&
      receipt.status === "pass" &&
      request.requestId === receipt.requestId &&
      request.version === receipt.version,
  );

  const blockers = [
    ...(!request ? ["No notarized desktop acceptance request is available."] : []),
    ...(!receipt ? ["No external clean-machine acceptance receipt is imported."] : []),
    ...(!publicKey || !signature ? ["The organization receipt signature material is incomplete."] : []),
    ...(!expectedKeySha256 ? ["The organization public-key fingerprint is not pinned out of band."] : []),
    ...(request && receipt && !contractMatched ? ["The receipt does not match the acceptance request contract."] : []),
    ...(request && receipt && !requestDigestMatched ? ["The signed receipt does not bind the exact acceptance request bytes."] : []),
    ...(request && receipt && !packageMatched ? ["The external receipt package digest does not match the notarized DMG."] : []),
    ...(receipt && !hostIndependent ? ["Acceptance was not proven on a different physical or virtual Mac."] : []),
    ...(receipt && !identityTrusted ? ["A durable organization and operator identity are required."] : []),
    ...(receipt && !checksComplete ? ["The external clean-machine check set is incomplete."] : []),
    ...(receiptBytes && !signatureVerified ? ["The external receipt signature is invalid."] : []),
    ...(publicKey && expectedKeySha256 && !keyPinned ? ["The receipt public key does not match the pinned organization trust anchor."] : []),
  ];

  return {
    ok: true as const,
    schemaVersion: DESKTOP_EXTERNAL_ACCEPTANCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    checks: {
      contractMatched,
      requestDigestMatched,
      packageMatched,
      hostIndependent,
      identityTrusted,
      checksComplete,
      signatureVerified,
      keyPinned,
    },
    blockers,
    receipt: receipt ? {
      generatedAt: receipt.generatedAt || null,
      version: receipt.version || null,
      organizationId: receipt.approver?.organizationId || null,
      operatorId: receipt.approver?.operatorId || null,
      host: receipt.host || null,
      package: receipt.package || null,
    } : null,
    trust: {
      configured: Boolean(expectedKeySha256),
      expectedKeySha256: expectedKeySha256 || null,
      actualKeySha256: actualKeySha256 || null,
      verifiedOutOfBand: Boolean(process.env.FIRST_LLM_DESKTOP_ACCEPTANCE_KEY_SHA256 || trust?.verifiedOutOfBand),
      importedAt: trust?.importedAt || null,
    },
    paths: {
      request: REQUEST_FILE,
      receipt: RECEIPT_FILE,
      signature: SIGNATURE_FILE,
      publicKey: PUBLIC_KEY_FILE,
      trust: TRUST_FILE,
    },
  };
}
