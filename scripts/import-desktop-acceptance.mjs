import { createHash, verify } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument near ${key || "end of command"}.`);
    values[key.slice(2)] = value;
  }
  return values;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const args = parseArgs(process.argv.slice(2));
for (const name of ["request", "receipt", "signature", "public-key", "expected-key-sha256"]) {
  if (!args[name]) throw new Error(`--${name} is required.`);
}
if (!/^[a-f0-9]{64}$/i.test(args["expected-key-sha256"])) throw new Error("--expected-key-sha256 must be a SHA-256 hex digest confirmed through an independent channel.");

const requestBytes = readFileSync(args.request);
const receiptBytes = readFileSync(args.receipt);
const signature = readFileSync(args.signature);
const publicKey = readFileSync(args["public-key"]);
const request = JSON.parse(requestBytes.toString("utf8"));
const receipt = JSON.parse(receiptBytes.toString("utf8"));
const publicKeySha256 = sha256(publicKey);

if (publicKeySha256 !== args["expected-key-sha256"].toLowerCase()) throw new Error("Organization public key does not match the out-of-band trust fingerprint.");
if (!verify("RSA-SHA256", receiptBytes, publicKey, signature)) throw new Error("Organization receipt signature is invalid.");
if (request.schemaVersion !== "desktop.external-acceptance-request.v1" || receipt.schemaVersion !== "desktop.external-acceptance-receipt.v1") throw new Error("Unsupported acceptance contract version.");
if (receipt.status !== "pass" || receipt.requestId !== request.requestId || receipt.version !== request.version) throw new Error("Receipt identity does not match the acceptance request.");
if (receipt.requestDigest !== sha256(requestBytes)) throw new Error("Receipt does not bind the exact request bytes.");
if (receipt.package?.sha256 !== request.package?.sha256 || receipt.package?.fileName !== request.package?.fileName) throw new Error("Receipt package digest does not match the notarized DMG request.");
if (!receipt.host?.releaseHostDifferent || receipt.host?.fingerprint === request.releaseHostFingerprint) throw new Error("Receipt was not generated on a different Mac.");
if (!receipt.approver?.organizationId || !receipt.approver?.operatorId || /^(local|test|rehearsal|fixture|unknown)/i.test(receipt.approver.organizationId) || /^(local|test|rehearsal|fixture|unknown)/i.test(receipt.approver.operatorId)) throw new Error("Durable organization and operator identities are required.");
if (!Array.isArray(request.requiredChecks) || !request.requiredChecks.every((name) => receipt.checks?.[name] === true)) throw new Error("External clean-machine checks are incomplete.");

const dataDir = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
mkdirSync(dataDir, { recursive: true });
const targetReceipt = path.join(dataDir, "desktop-external-acceptance-receipt.json");
copyFileSync(args.request, path.join(dataDir, "desktop-external-acceptance-request.json"));
copyFileSync(args.receipt, targetReceipt);
copyFileSync(args.signature, `${targetReceipt}.sig`);
copyFileSync(args["public-key"], `${targetReceipt}.pub.pem`);
writeFileSync(path.join(dataDir, "desktop-external-acceptance-trust.json"), `${JSON.stringify({
  schemaVersion: "desktop.external-acceptance-trust.v1",
  importedAt: new Date().toISOString(),
  expectedPublicKeySha256: publicKeySha256,
  verifiedOutOfBand: true,
  requestId: request.requestId,
  organizationId: receipt.approver.organizationId,
  operatorId: receipt.approver.operatorId,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: true,
  schemaVersion: "desktop.external-acceptance-import.v1",
  requestId: request.requestId,
  organizationId: receipt.approver.organizationId,
  operatorId: receipt.approver.operatorId,
  publicKeySha256,
  dataDir,
}, null, 2));
