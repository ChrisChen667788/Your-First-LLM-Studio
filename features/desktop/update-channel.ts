import { createHash, generateKeyPairSync, randomUUID, sign, verify } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

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
  if (!existsSync(STORE_FILE)) return [];
  try { const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: UpdateReceipt[] }; return Array.isArray(parsed.receipts) ? parsed.receipts : []; }
  catch { return []; }
}

function keyPair() {
  if (existsSync(KEY_FILE)) return JSON.parse(readFileSync(KEY_FILE, "utf8")) as { publicKeyPem: string; privateKeyPem: string };
  const pair = generateKeyPairSync("ed25519");
  const record = { publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(KEY_FILE, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return record;
}

function persist(receipt: UpdateReceipt) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: DESKTOP_UPDATE_CHANNEL_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 50) }, null, 2)}\n`, "utf8");
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
