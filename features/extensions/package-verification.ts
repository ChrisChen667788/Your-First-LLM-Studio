import { createHash, verify } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import {
  readExtensionTrustPolicy,
  validateExtensionManifest,
  type ExtensionManifest,
} from "@/features/extensions/registry";

export const EXTENSION_PACKAGE_VERIFICATION_SCHEMA_VERSION =
  "extensions.package-verification.v1" as const;

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const QUARANTINE_DIR = path.join(DATA_DIR, "extension-quarantine");
const RECEIPT_DIR = path.join(DATA_DIR, "extension-verification-receipts");

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

function readTrustRoots() {
  try {
    const parsed = JSON.parse(process.env.FIRST_LLM_EXTENSION_TRUST_ROOTS_JSON || "{}") as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function quarantinePackage(input: {
  manifest: ExtensionManifest;
  payload: Buffer;
  reasons: string[];
  digest: string;
}) {
  mkdirSync(QUARANTINE_DIR, { recursive: true });
  const id = `${Date.now()}-${safeId(input.manifest.id || "unknown-extension")}`;
  const directory = path.join(QUARANTINE_DIR, id);
  mkdirSync(directory, { recursive: true });
  const payloadPath = path.join(directory, "package.bin");
  const receiptPath = path.join(directory, "quarantine-receipt.json");
  writeFileSync(payloadPath, input.payload, { mode: 0o600 });
  writeFileSync(
    receiptPath,
    `${JSON.stringify({
      schemaVersion: EXTENSION_PACKAGE_VERIFICATION_SCHEMA_VERSION,
      quarantinedAt: new Date().toISOString(),
      manifest: input.manifest,
      digest: input.digest,
      reasons: input.reasons,
      executable: false,
    }, null, 2)}\n`,
    "utf8",
  );
  return { id, directory, payloadPath, receiptPath };
}

export function readExtensionQuarantine() {
  mkdirSync(QUARANTINE_DIR, { recursive: true });
  const records = readdirSync(QUARANTINE_DIR)
    .sort()
    .reverse()
    .slice(0, 50)
    .map((id) => {
      const receiptPath = path.join(QUARANTINE_DIR, id, "quarantine-receipt.json");
      if (!existsSync(receiptPath)) return null;
      try {
        return JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((record): record is Record<string, unknown> => Boolean(record));
  return {
    schemaVersion: "extensions.quarantine.v1" as const,
    directory: QUARANTINE_DIR,
    records,
    count: records.length,
  };
}

export function readExtensionVerificationReceipts() {
  mkdirSync(RECEIPT_DIR, { recursive: true });
  const receipts = readdirSync(RECEIPT_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 50)
    .map((name) => {
      try {
        return JSON.parse(readFileSync(path.join(RECEIPT_DIR, name), "utf8")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((receipt): receipt is Record<string, unknown> => Boolean(receipt));
  return {
    schemaVersion: "extensions.verification-receipts.v1" as const,
    directory: RECEIPT_DIR,
    receipts,
    count: receipts.length,
    accepted: receipts.filter((receipt) => receipt.accepted === true).length,
    rejected: receipts.filter((receipt) => receipt.accepted === false).length,
  };
}

export function verifyExtensionPackage(input: {
  manifest: ExtensionManifest;
  payloadBase64: string;
  publicKeyPem?: string;
  quarantineOnFailure?: boolean;
}) {
  const payload = Buffer.from(input.payloadBase64 || "", "base64");
  if (!payload.length) throw new Error("Extension package payload is required.");
  if (payload.length > 10 * 1024 * 1024) throw new Error("Extension package exceeds the 10 MB verification limit.");
  const policy = readExtensionTrustPolicy();
  const manifestValidation = validateExtensionManifest(input.manifest, policy);
  const digest = createHash("sha256").update(payload).digest("hex");
  const errors = [...manifestValidation.errors];
  if (input.manifest.digest !== digest) errors.push("Package digest does not match the manifest.");
  const trustRoots = readTrustRoots();
  const configuredKey = trustRoots[input.manifest.publisher];
  const localRehearsalKey =
    process.env.NODE_ENV !== "production" && input.manifest.publisher.startsWith("local-rehearsal")
      ? input.publicKeyPem
      : undefined;
  const publicKeyPem = configuredKey || localRehearsalKey;
  const trustMode = configuredKey
    ? "configured-publisher-root"
    : localRehearsalKey
      ? "local-rehearsal-root"
      : "untrusted";
  let signatureVerified = false;
  if (!publicKeyPem) {
    errors.push("No trusted publisher public key is configured.");
  } else if (!input.manifest.signature) {
    errors.push("Package signature is missing.");
  } else {
    try {
      signatureVerified = verify(
        null,
        Buffer.from(digest, "hex"),
        publicKeyPem,
        Buffer.from(input.manifest.signature, "base64"),
      );
      if (!signatureVerified) errors.push("Package signature verification failed.");
    } catch {
      errors.push("Package signature could not be parsed or verified.");
    }
  }
  const accepted = errors.length === 0 && signatureVerified;
  const quarantine =
    !accepted && input.quarantineOnFailure !== false
      ? quarantinePackage({ manifest: input.manifest, payload, reasons: errors, digest })
      : null;
  mkdirSync(RECEIPT_DIR, { recursive: true });
  const receipt = {
    schemaVersion: EXTENSION_PACKAGE_VERIFICATION_SCHEMA_VERSION,
    verifiedAt: new Date().toISOString(),
    extensionId: input.manifest.id,
    publisher: input.manifest.publisher,
    version: input.manifest.version,
    digest,
    signatureVerified,
    trustMode,
    accepted,
    executable: false,
    errors,
    quarantineId: quarantine?.id || null,
  };
  const receiptPath = path.join(
    RECEIPT_DIR,
    `${Date.now()}-${safeId(input.manifest.id)}-${accepted ? "accepted" : "rejected"}.json`,
  );
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return {
    ok: accepted,
    schemaVersion: EXTENSION_PACKAGE_VERIFICATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    digest,
    signatureVerified,
    trustMode,
    accepted,
    executable: false,
    errors,
    warnings: manifestValidation.warnings,
    quarantine,
    receiptPath,
  };
}
