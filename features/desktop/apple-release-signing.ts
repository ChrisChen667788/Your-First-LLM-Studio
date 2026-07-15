import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const APPLE_RELEASE_SIGNING_SCHEMA_VERSION = "desktop.apple-release-signing.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "local-agent-lab",
  "observability",
);
const RECEIPT_FILE = path.join(DATA_DIR, "apple-release-signing-receipt.json");

function run(command: string, args: string[], timeout = 30_000) {
  return execFileSync(command, args, {
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function toolAvailable(command: string, args: string[]) {
  try {
    run(command, args, 5_000);
    return true;
  } catch {
    return false;
  }
}

function signingIdentityCount() {
  try {
    const output = run("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]);
    const match = output.match(/(\d+) valid identities found/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

export function readAppleReleaseSigningReadiness() {
  const identity = process.env.FIRST_LLM_APPLE_SIGNING_IDENTITY?.trim() || "";
  const notaryProfile = process.env.FIRST_LLM_APPLE_NOTARY_PROFILE?.trim() || "";
  const packagePath = process.env.FIRST_LLM_DESKTOP_PACKAGE_PATH?.trim() || "";
  const tools = {
    codesign: existsSync("/usr/bin/codesign"),
    notarytool: toolAvailable("/usr/bin/xcrun", ["--find", "notarytool"]),
    stapler: toolAvailable("/usr/bin/xcrun", ["--find", "stapler"]),
  };
  const identityCount = signingIdentityCount();
  const blockers = [
    ...(!tools.codesign || !tools.notarytool || !tools.stapler ? ["Apple release command-line tools are incomplete."] : []),
    ...(!identity ? ["FIRST_LLM_APPLE_SIGNING_IDENTITY is not configured."] : []),
    ...(identityCount < 1 ? ["No valid Developer ID signing identity is available in the keychain."] : []),
    ...(!notaryProfile ? ["FIRST_LLM_APPLE_NOTARY_PROFILE is not configured."] : []),
    ...(!packagePath || !existsSync(packagePath) ? ["FIRST_LLM_DESKTOP_PACKAGE_PATH does not reference a package."] : []),
  ];
  let latestReceipt: Record<string, unknown> | null = null;
  if (existsSync(RECEIPT_FILE)) {
    try {
      latestReceipt = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as Record<string, unknown>;
    } catch {
      latestReceipt = null;
    }
  }
  return {
    ok: true as const,
    schemaVersion: APPLE_RELEASE_SIGNING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    tools,
    identityConfigured: Boolean(identity),
    identityCount,
    notaryProfileConfigured: Boolean(notaryProfile),
    packageConfigured: Boolean(packagePath && existsSync(packagePath)),
    packageName: packagePath ? path.basename(packagePath) : null,
    blockers,
    latestReceipt,
  };
}

export function runAppleReleaseSigningPipeline() {
  const readiness = readAppleReleaseSigningReadiness();
  if (!readiness.ready) throw new Error(`Apple release signing is blocked: ${readiness.blockers.join(" ")}`);
  const packagePath = process.env.FIRST_LLM_DESKTOP_PACKAGE_PATH as string;
  const profile = process.env.FIRST_LLM_APPLE_NOTARY_PROFILE as string;
  const identity = process.env.FIRST_LLM_APPLE_SIGNING_IDENTITY as string;
  const startedAt = new Date().toISOString();
  run("/usr/bin/codesign", [
    "--force", "--timestamp", "--options", "runtime", "--sign", identity, packagePath,
  ], 120_000);
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", packagePath], 120_000);
  const notarization = JSON.parse(run("/usr/bin/xcrun", [
    "notarytool", "submit", packagePath,
    "--keychain-profile", profile,
    "--wait", "--output-format", "json",
  ], 30 * 60_000)) as { id?: string; status?: string; message?: string };
  if (notarization.status !== "Accepted") {
    throw new Error(`Apple notarization did not return Accepted (${notarization.status || "unknown"}).`);
  }
  run("/usr/bin/xcrun", ["stapler", "staple", packagePath], 120_000);
  run("/usr/bin/xcrun", ["stapler", "validate", packagePath], 120_000);
  const receipt = {
    schemaVersion: APPLE_RELEASE_SIGNING_SCHEMA_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    packageName: path.basename(packagePath),
    signedWithDeveloperId: true,
    notarizationId: notarization.id || null,
    notarizationStatus: notarization.status,
    stapled: true,
    validated: true,
  };
  mkdirSync(path.dirname(RECEIPT_FILE), { recursive: true });
  writeFileSync(RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { ok: true as const, receipt, readiness: readAppleReleaseSigningReadiness() };
}
