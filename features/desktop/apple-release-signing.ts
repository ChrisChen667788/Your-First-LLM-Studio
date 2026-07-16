import { execFileSync, spawnSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";

export const APPLE_RELEASE_SIGNING_SCHEMA_VERSION = "desktop.apple-release-signing.v2" as const;
export const DESKTOP_ACCEPTANCE_REQUEST_SCHEMA_VERSION = "desktop.external-acceptance-request.v1" as const;

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "local-agent-lab",
  "observability",
);
const RECEIPT_FILE = path.join(DATA_DIR, "apple-release-signing-receipt.json");
const RELEASE_MANIFEST_FILE = process.env.FIRST_LLM_DESKTOP_RELEASE_MANIFEST || path.join(DATA_DIR, "desktop-release-manifest.json");
const ACCEPTANCE_REQUEST_FILE = path.join(DATA_DIR, "desktop-external-acceptance-request.json");
const NODE_ENTITLEMENTS = path.join(process.cwd(), "scripts", "desktop-node.entitlements.plist");

type ReleaseManifest = {
  version?: string;
  package?: { appPath?: string; appBytes?: number; zipPath?: string; dmgPath?: string; zipBytes?: number; dmgBytes?: number; zipSha256?: string; dmgSha256?: string };
  signature?: Record<string, unknown>;
  files?: Array<{ path: string; bytes: number; sha256: string }>;
};

function run(command: string, args: string[], timeout = 30_000) {
  return execFileSync(command, args, {
    encoding: "utf8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runCombined(command: string, args: string[], timeout = 30_000) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  if (result.status !== 0) throw new Error(output || `${path.basename(command)} exited with status ${result.status}.`);
  return output;
}

function toolAvailable(command: string, args: string[]) {
  try {
    run(command, args, 5_000);
    return true;
  } catch {
    return false;
  }
}

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function signingIdentities() {
  try {
    const output = run("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]);
    return output
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*\d+\)\s+([0-9A-F]+)\s+"([^"]+)"/)?.slice(1, 3))
      .filter((entry): entry is [string, string] => Boolean(entry));
  } catch {
    return [];
  }
}

function packagePaths(manifest: ReleaseManifest | null) {
  const legacyPackage = process.env.FIRST_LLM_DESKTOP_PACKAGE_PATH?.trim() || "";
  return {
    appPath: process.env.FIRST_LLM_DESKTOP_APP_PATH?.trim() || manifest?.package?.appPath || "",
    dmgPath: process.env.FIRST_LLM_DESKTOP_DMG_PATH?.trim() || legacyPackage || manifest?.package?.dmgPath || "",
    zipPath: process.env.FIRST_LLM_DESKTOP_ZIP_PATH?.trim() || manifest?.package?.zipPath || "",
  };
}

function findMachOFiles(directory: string) {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findMachOFiles(absolute));
    else if (entry.isFile()) {
      try {
        if (run("/usr/bin/file", ["-b", absolute], 5_000).includes("Mach-O")) files.push(absolute);
      } catch {
        // A non-readable release file will be rejected later by codesign verification.
      }
    }
  }
  return files.sort((left, right) => right.split(path.sep).length - left.split(path.sep).length);
}

function listFiles(directory: string, base = directory): Array<{ path: string; bytes: number; sha256: string }> {
  const files: Array<{ path: string; bytes: number; sha256: string }> = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, base));
    else if (entry.isFile()) files.push({ path: path.relative(base, absolute), bytes: statSync(absolute).size, sha256: sha256File(absolute) });
  }
  return files;
}

function updateEmbeddedManifest(appPath: string, version: string) {
  const manifestPath = path.join(appPath, "Contents", "Resources", "app", "data", "desktop-release-manifest.json");
  const manifest = readJson<Record<string, unknown>>(manifestPath);
  if (!manifest) return;
  writeFileSync(manifestPath, `${JSON.stringify({
    ...manifest,
    version,
    signature: {
      mode: "apple-developer-id-candidate",
      verified: true,
      notarizationEvidenceExternal: true,
      gaEligible: false,
      warning: "Organization-owned clean-machine acceptance is still required after notarization.",
    },
  }, null, 2)}\n`, "utf8");
}

function hostFingerprint() {
  let source = `${os.hostname()}|${os.arch()}|${os.platform()}`;
  try {
    const output = run("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
    source = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] || source;
  } catch {
    // The hash remains host-specific enough for a fail-closed clean-machine comparison.
  }
  return createHash("sha256").update(source).digest("hex");
}

function writeAcceptanceRequest(input: {
  version: string;
  dmgPath: string;
  dmgSha256: string;
  notarizationIds: string[];
  teamId: string | null;
}) {
  const request = {
    schemaVersion: DESKTOP_ACCEPTANCE_REQUEST_SCHEMA_VERSION,
    requestId: randomUUID(),
    issuedAt: new Date().toISOString(),
    version: input.version,
    releaseHostFingerprint: hostFingerprint(),
    package: {
      fileName: path.basename(input.dmgPath),
      bytes: statSync(input.dmgPath).size,
      sha256: input.dmgSha256,
    },
    apple: {
      teamId: input.teamId,
      notarizationIds: input.notarizationIds,
      stapled: true,
      gatekeeperVerified: true,
    },
    requiredChecks: [
      "packageDigestVerified",
      "readOnlyMount",
      "developerIdVerified",
      "notaryTicketValidated",
      "gatekeeperAccepted",
      "isolatedProfileCreated",
      "agentRouteHealthy",
      "onboardingApiHealthy",
      "processStopped",
      "imageDetached",
      "uninstallPreservedData",
      "explicitPurgeRemovedData",
    ],
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(ACCEPTANCE_REQUEST_FILE, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  const outputPath = path.join(path.dirname(input.dmgPath), "desktop-external-acceptance-request.json");
  writeFileSync(outputPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  const runner = path.join(process.cwd(), "scripts", "accept-desktop-release.sh");
  if (existsSync(runner)) cpSync(runner, path.join(path.dirname(input.dmgPath), path.basename(runner)));
  return { request, path: outputPath };
}

function notarizeArtifact(artifactPath: string, profile: string, label: string, receiptDir: string) {
  const submittedSha256 = sha256File(artifactPath);
  const submission = JSON.parse(run("/usr/bin/xcrun", [
    "notarytool", "submit", artifactPath,
    "--keychain-profile", profile,
    "--wait", "--output-format", "json",
  ], 60 * 60_000)) as { id?: string; status?: string; message?: string };
  if (!submission.id) throw new Error(`Apple notarization did not return a submission id for ${label}.`);
  let log: unknown = null;
  try {
    log = JSON.parse(run("/usr/bin/xcrun", [
      "notarytool", "log", submission.id,
      "--keychain-profile", profile,
      "--output-format", "json",
    ], 120_000));
  } catch (error) {
    log = { error: error instanceof Error ? error.message : "Notary log could not be retained." };
  }
  const logPath = path.join(receiptDir, `notary-${label}-${submission.id}.json`);
  writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  if (submission.status !== "Accepted") {
    throw new Error(`Apple notarization did not return Accepted for ${label} (${submission.status || "unknown"}); inspect ${logPath}.`);
  }
  return { id: submission.id, status: submission.status, message: submission.message || null, submittedSha256, logPath };
}

export function readAppleReleaseSigningReadiness() {
  const identity = process.env.FIRST_LLM_APPLE_SIGNING_IDENTITY?.trim() || "";
  const notaryProfile = process.env.FIRST_LLM_APPLE_NOTARY_PROFILE?.trim() || "";
  const manifest = readJson<ReleaseManifest>(RELEASE_MANIFEST_FILE);
  const paths = packagePaths(manifest);
  const tools = {
    codesign: existsSync("/usr/bin/codesign"),
    notarytool: toolAvailable("/usr/bin/xcrun", ["--find", "notarytool"]),
    stapler: toolAvailable("/usr/bin/xcrun", ["--find", "stapler"]),
    spctl: existsSync("/usr/sbin/spctl"),
    hdiutil: existsSync("/usr/bin/hdiutil"),
  };
  const identities = signingIdentities();
  const identityMatched = Boolean(identity && identities.some(([hash, label]) => hash === identity || label === identity));
  const pathsReady = Boolean(paths.appPath && existsSync(paths.appPath) && paths.dmgPath && existsSync(paths.dmgPath));
  const blockers = [
    ...(!Object.values(tools).every(Boolean) ? ["Apple release command-line tools are incomplete."] : []),
    ...(!identity ? ["FIRST_LLM_APPLE_SIGNING_IDENTITY is not configured."] : []),
    ...(!identityMatched ? ["The configured Developer ID Application identity is not available in the keychain."] : []),
    ...(!notaryProfile ? ["FIRST_LLM_APPLE_NOTARY_PROFILE is not configured."] : []),
    ...(!pathsReady ? ["FIRST_LLM_DESKTOP_APP_PATH and FIRST_LLM_DESKTOP_DMG_PATH must reference the release artifacts."] : []),
  ];
  const latestReceipt = readJson<Record<string, unknown>>(RECEIPT_FILE);
  const receiptPackage = latestReceipt?.package as { dmgSha256?: string } | undefined;
  const completed = Boolean(
    latestReceipt?.status === "pass" &&
      latestReceipt.signedWithDeveloperId === true &&
      latestReceipt.stapled === true &&
      latestReceipt.gatekeeperVerified === true &&
      (latestReceipt.appNotarization as { status?: string } | undefined)?.status === "Accepted" &&
      (latestReceipt.dmgNotarization as { status?: string } | undefined)?.status === "Accepted" &&
      receiptPackage?.dmgSha256 &&
      receiptPackage.dmgSha256 === manifest?.package?.dmgSha256 &&
      manifest?.signature?.mode === "apple-developer-id-notarized",
  );
  const completionBlockers = completed ? [] : ["No current Developer ID signed, Apple-notarized, stapled, and Gatekeeper-verified package receipt is available."];
  return {
    ok: true as const,
    schemaVersion: APPLE_RELEASE_SIGNING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ready: blockers.length === 0,
    preflightReady: blockers.length === 0,
    completed,
    tools,
    identityConfigured: Boolean(identity),
    identityMatched,
    identityCount: identities.length,
    notaryProfileConfigured: Boolean(notaryProfile),
    packageConfigured: pathsReady,
    packageName: paths.dmgPath ? path.basename(paths.dmgPath) : null,
    appName: paths.appPath ? path.basename(paths.appPath) : null,
    blockers,
    latestReceipt,
    completionBlockers,
    paths: {
      receipt: RECEIPT_FILE,
      releaseManifest: RELEASE_MANIFEST_FILE,
      acceptanceRequest: ACCEPTANCE_REQUEST_FILE,
    },
  };
}

export function runAppleReleaseSigningPipeline() {
  const readiness = readAppleReleaseSigningReadiness();
  if (!readiness.ready) throw new Error(`Apple release signing is blocked: ${readiness.blockers.join(" ")}`);
  const manifest = readJson<ReleaseManifest>(RELEASE_MANIFEST_FILE);
  const { appPath, dmgPath, zipPath: configuredZip } = packagePaths(manifest);
  const profile = process.env.FIRST_LLM_APPLE_NOTARY_PROFILE as string;
  const identity = process.env.FIRST_LLM_APPLE_SIGNING_IDENTITY as string;
  const version = manifest?.version || "unknown";
  const releaseDirectory = path.dirname(dmgPath);
  const zipPath = configuredZip || path.join(releaseDirectory, `${path.basename(appPath, ".app")}-${version}.zip`);
  const startedAt = new Date().toISOString();
  let stage = "prepare";
  mkdirSync(DATA_DIR, { recursive: true });

  try {
    updateEmbeddedManifest(appPath, version);
    stage = "sign-nested-code";
    const machOFiles = findMachOFiles(appPath);
    for (const filePath of machOFiles) {
      const args = ["--force", "--timestamp", "--options", "runtime", "--sign", identity];
      if (filePath === path.join(appPath, "Contents", "Resources", "runtime", "bin", "node")) {
        args.push("--entitlements", NODE_ENTITLEMENTS);
      }
      args.push(filePath);
      run("/usr/bin/codesign", args, 120_000);
    }
    run("/usr/bin/codesign", ["--force", "--timestamp", "--options", "runtime", "--sign", identity, appPath], 120_000);
    const appSignature = runCombined("/usr/bin/codesign", ["--display", "--verbose=4", appPath]);
    runCombined("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath], 120_000);
    const teamId = appSignature.match(/TeamIdentifier=([^\s]+)/)?.[1] || null;

    stage = "notarize-app";
    rmSync(zipPath, { force: true });
    run("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath], 10 * 60_000);
    const appNotary = notarizeArtifact(zipPath, profile, "app", releaseDirectory);
    run("/usr/bin/xcrun", ["stapler", "staple", appPath], 120_000);
    run("/usr/bin/xcrun", ["stapler", "validate", appPath], 120_000);
    runCombined("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=4", appPath], 120_000);
    rmSync(zipPath, { force: true });
    run("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath], 10 * 60_000);

    stage = "package-dmg";
    const dmgStage = path.join(releaseDirectory, ".developer-id-dmg-stage");
    rmSync(dmgStage, { recursive: true, force: true });
    mkdirSync(dmgStage, { recursive: true });
    cpSync(appPath, path.join(dmgStage, path.basename(appPath)), { recursive: true });
    rmSync(dmgPath, { force: true });
    run("/usr/bin/hdiutil", ["create", "-quiet", "-fs", "HFS+", "-volname", "First LLM Studio", "-srcfolder", dmgStage, dmgPath], 10 * 60_000);
    rmSync(dmgStage, { recursive: true, force: true });
    run("/usr/bin/codesign", ["--force", "--timestamp", "--sign", identity, dmgPath], 120_000);
    runCombined("/usr/bin/codesign", ["--verify", "--strict", "--verbose=4", dmgPath], 120_000);

    stage = "notarize-dmg";
    const dmgNotary = notarizeArtifact(dmgPath, profile, "dmg", releaseDirectory);
    run("/usr/bin/xcrun", ["stapler", "staple", dmgPath], 120_000);
    run("/usr/bin/xcrun", ["stapler", "validate", dmgPath], 120_000);
    runCombined("/usr/sbin/spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=4", dmgPath], 120_000);

    stage = "write-receipt";
    const zipSha256 = sha256File(zipPath);
    const dmgSha256 = sha256File(dmgPath);
    const appFiles = listFiles(appPath);
    const acceptance = writeAcceptanceRequest({
      version,
      dmgPath,
      dmgSha256,
      notarizationIds: [appNotary.id, dmgNotary.id],
      teamId,
    });
    if (manifest) {
      const nextManifest: ReleaseManifest = {
        ...manifest,
        package: {
          ...manifest.package,
          appPath,
          appBytes: appFiles.reduce((total, file) => total + file.bytes, 0),
          zipPath,
          zipBytes: statSync(zipPath).size,
          zipSha256,
          dmgPath,
          dmgBytes: statSync(dmgPath).size,
          dmgSha256,
        },
        signature: {
          mode: "apple-developer-id-notarized",
          verified: true,
          hardenedRuntime: true,
          secureTimestamp: true,
          notarized: true,
          stapled: true,
          gatekeeperVerified: true,
          teamId,
          gaEligible: false,
          warning: "A trusted external clean-machine organization receipt is still required for GA.",
        },
        files: appFiles,
      };
      writeFileSync(RELEASE_MANIFEST_FILE, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
      writeFileSync(path.join(releaseDirectory, "release-manifest.json"), `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
    }
    const receipt = {
      schemaVersion: APPLE_RELEASE_SIGNING_SCHEMA_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "pass",
      version,
      packageName: path.basename(dmgPath),
      signedWithDeveloperId: true,
      identityTeamId: teamId,
      nestedMachOCount: machOFiles.length,
      hardenedRuntime: true,
      secureTimestamp: true,
      appNotarization: appNotary,
      dmgNotarization: dmgNotary,
      stapled: true,
      gatekeeperVerified: true,
      package: { zipPath, zipSha256, dmgPath, dmgSha256 },
      externalAcceptanceRequest: acceptance.path,
    };
    writeFileSync(RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return { ok: true as const, receipt, readiness: readAppleReleaseSigningReadiness() };
  } catch (error) {
    const failure = {
      schemaVersion: APPLE_RELEASE_SIGNING_SCHEMA_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      stage,
      error: error instanceof Error ? error.message : "Apple release signing failed.",
    };
    writeFileSync(RECEIPT_FILE, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
    throw error;
  }
}
