import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const temp = mkdtempSync(path.join(os.tmpdir(), "first-llm-acceptance-contract-"));
const dataDir = path.join(temp, "observability");
const requestPath = path.join(temp, "request.json");
const receiptPath = path.join(temp, "receipt.json");
const signaturePath = `${receiptPath}.sig`;
const publicKeyPath = `${receiptPath}.pub.pem`;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

try {
  const packageSha256 = "a".repeat(64);
  const request = {
    schemaVersion: "desktop.external-acceptance-request.v1",
    requestId: "acceptance-contract-rehearsal",
    issuedAt: new Date().toISOString(),
    version: "1.1.0-rc.2",
    releaseHostFingerprint: "b".repeat(64),
    package: { fileName: "First-LLM-Studio-1.1.0-rc.2-darwin-arm64.dmg", bytes: 1024, sha256: packageSha256 },
    requiredChecks: [
      "packageDigestVerified", "readOnlyMount", "developerIdVerified", "notaryTicketValidated",
      "gatekeeperAccepted", "isolatedProfileCreated", "agentRouteHealthy", "onboardingApiHealthy",
      "processStopped", "imageDetached", "uninstallPreservedData", "explicitPurgeRemovedData",
    ],
  };
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const checks = Object.fromEntries(request.requiredChecks.map((name) => [name, true]));
  const receipt = {
    schemaVersion: "desktop.external-acceptance-receipt.v1",
    generatedAt: new Date().toISOString(),
    status: "pass",
    requestId: request.requestId,
    requestDigest: sha256(readFileSync(requestPath)),
    version: request.version,
    package: { fileName: request.package.fileName, sha256: packageSha256 },
    host: { fingerprint: "c".repeat(64), releaseHostDifferent: true, osVersion: "fixture", architecture: "arm64" },
    approver: { organizationId: "example-corp", operatorId: "release-approver", keyId: "fixture" },
    checks,
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" });
  writeFileSync(publicKeyPath, publicKey);
  writeFileSync(signaturePath, sign("RSA-SHA256", readFileSync(receiptPath), pair.privateKey));
  const keySha256 = sha256(publicKey);

  const args = [
    path.join(root, "scripts", "import-desktop-acceptance.mjs"),
    "--request", requestPath,
    "--receipt", receiptPath,
    "--signature", signaturePath,
    "--public-key", publicKeyPath,
    "--expected-key-sha256", keySha256,
  ];
  const imported = JSON.parse(execFileSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, LOCAL_AGENT_DATA_DIR: dataDir },
    encoding: "utf8",
  }));
  const tampered = JSON.parse(readFileSync(receiptPath, "utf8"));
  tampered.package.sha256 = "d".repeat(64);
  writeFileSync(receiptPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const rejected = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, LOCAL_AGENT_DATA_DIR: path.join(temp, "tampered") },
    encoding: "utf8",
  });
  const report = {
    schemaVersion: "desktop.external-acceptance-contract-rehearsal.v1",
    generatedAt: new Date().toISOString(),
    status: imported.ok === true && rejected.status !== 0 ? "pass" : "failed",
    checks: {
      trustedReceiptImported: imported.ok === true,
      publicKeyPinned: imported.publicKeySha256 === keySha256,
      tamperedReceiptRejected: rejected.status !== 0,
      productionEvidenceUntouched: true,
    },
    warning: "This uses an isolated fixture directory and does not count as clean-machine or organization acceptance evidence.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "pass") process.exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
