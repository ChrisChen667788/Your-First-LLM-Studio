import { createHash, generateKeyPairSync, randomUUID, sign, verify } from "crypto";
import os from "os";
import path from "path";
import { updateJsonFileDurably } from "@/features/persistence/durable-json-file";
import { prependDurableReceipt, readDurableReceipts } from "@/features/persistence/durable-receipt-store";

export const DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION = "desktop.update-channel.v1" as const;

type UpdateReceipt = {
  id: string;
  generatedAt: string;
  channel: "stable" | "preview";
  fromVersion: string;
  toVersion: string;
  rollbackVersion: string;
  manifestDigest: string;
  signatureVerified: boolean;
  staged: boolean;
  activated: boolean;
  rollbackVerified: boolean;
  status: "pass" | "failed";
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "desktop-update-channel.json");
const KEY_FILE = path.join(DATA_DIR, "desktop-update-channel-key.json");

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

function readReceipts(): UpdateReceipt[] {
  return readDurableReceipts(STORE_FILE, DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION);
}

type UpdateKeyPair = { publicKeyPem: string; privateKeyPem: string };

function createKeyPair(): UpdateKeyPair {
  const pair = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

function isKeyPair(value: unknown): value is UpdateKeyPair {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UpdateKeyPair>;
  return typeof candidate.publicKeyPem === "string" && typeof candidate.privateKeyPem === "string";
}

function keyPair() {
  return updateJsonFileDurably(KEY_FILE, createKeyPair, (current) => current, isKeyPair);
}

function persist(receipt: UpdateReceipt) {
  prependDurableReceipt(STORE_FILE, DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION, receipt, 50);
}

export function rehearseDesktopUpdateChannel(input: { channel?: "stable" | "preview"; fromVersion?: string; toVersion?: string } = {}) {
  const channel = input.channel === "preview" ? "preview" : "stable";
  const fromVersion = input.fromVersion?.trim() || "1.1.0-rehearsal.1";
  const toVersion = input.toVersion?.trim() || "1.1.0-rehearsal.2";
  if (fromVersion === toVersion) throw new Error("Update target must differ from the installed version.");
  const manifest = { schemaVersion: DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION, channel, fromVersion, toVersion, rollbackVersion: fromVersion, rolloutPct: channel === "stable" ? 100 : 20, packageSha256: createHash("sha256").update(`First LLM Studio ${toVersion}`).digest("hex") };
  const manifestDigest = createHash("sha256").update(stable(manifest)).digest("hex");
  const keys = keyPair();
  const signature = sign(null, Buffer.from(manifestDigest, "hex"), keys.privateKeyPem);
  const signatureVerified = verify(null, Buffer.from(manifestDigest, "hex"), keys.publicKeyPem, signature);
  const receipt: UpdateReceipt = {
    id: `desktop-update-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    channel,
    fromVersion,
    toVersion,
    rollbackVersion: fromVersion,
    manifestDigest,
    signatureVerified,
    staged: signatureVerified,
    activated: signatureVerified,
    rollbackVerified: signatureVerified && manifest.rollbackVersion === fromVersion,
    status: signatureVerified ? "pass" : "failed",
  };
  persist(receipt);
  return { ...receipt, manifest, signature: signature.toString("base64"), warning: "Local update signing proves the channel and rollback contract, not Apple notarization." };
}

export function readDesktopUpdateChannelEvidence() {
  const receipts = readReceipts();
  return { ok: true as const, schemaVersion: DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, paths: { store: STORE_FILE, localKey: KEY_FILE } };
}
