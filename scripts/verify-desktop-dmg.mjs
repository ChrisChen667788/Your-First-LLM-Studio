import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const version = "1.1.0-rc.1";
const dmgPath = path.join(root, "output", "desktop-release", version, `First-LLM-Studio-${version}-darwin-arm64.dmg`);
const mountPoint = mkdtempSync(path.join(os.tmpdir(), "first-llm-dmg-"));
const profileDir = mkdtempSync(path.join(os.tmpdir(), "first-llm-profile-"));
const dataDir =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const port = Number(process.env.FIRST_LLM_DESKTOP_VERIFY_PORT || 3111);
const checks = {
  dmgMountedReadOnly: false,
  codeSignatureVerified: false,
  terminalFreeLaunch: false,
  agentRouteHealthy: false,
  onboardingApiHealthy: false,
  isolatedProfileCreated: false,
  processStopped: false,
  imageDetached: false,
};
let serverPid;
let error;

try {
  if (!existsSync(dmgPath)) throw new Error(`Desktop DMG is missing: ${dmgPath}`);
  execFileSync("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-mountpoint", mountPoint, dmgPath], { stdio: "pipe" });
  checks.dmgMountedReadOnly = true;
  const appPath = path.join(mountPoint, "First LLM Studio.app");
  const signature = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { encoding: "utf8" });
  if (signature.status !== 0) throw new Error((signature.stderr || signature.stdout || "Mounted app codesign failed.").trim());
  checks.codeSignatureVerified = true;
  execFileSync(path.join(appPath, "Contents", "MacOS", "first-llm-studio"), [], {
    env: {
      ...process.env,
      FIRST_LLM_STUDIO_PORT: String(port),
      FIRST_LLM_STUDIO_NO_BROWSER: "1",
      LOCAL_AGENT_DATA_DIR: profileDir,
    },
    stdio: "pipe",
    timeout: 60_000,
  });
  checks.terminalFreeLaunch = true;
  const pidFile = path.join(profileDir, "desktop-server.pid");
  serverPid = Number(readFileSync(pidFile, "utf8").trim());
  const agent = await fetch(`http://127.0.0.1:${port}/agent`, { signal: AbortSignal.timeout(15_000) });
  checks.agentRouteHealthy = agent.status === 200;
  const api = await fetch(`http://127.0.0.1:${port}/api/desktop/onboarding-release`, { signal: AbortSignal.timeout(15_000) });
  const body = await api.json();
  checks.onboardingApiHealthy = api.status === 200 && body.schemaVersion === "desktop.onboarding-release.v1" && body.version === version;
  checks.isolatedProfileCreated = existsSync(pidFile) && existsSync(path.join(profileDir, "desktop-server.log"));
} catch (caught) {
  error = caught instanceof Error ? caught.message : "Desktop clean-profile verification failed.";
} finally {
  if (serverPid) {
    try {
      process.kill(serverPid, "SIGTERM");
      checks.processStopped = true;
    } catch {
      checks.processStopped = false;
    }
  }
  const detached = spawnSync("/usr/bin/hdiutil", ["detach", mountPoint, "-quiet"], { encoding: "utf8" });
  checks.imageDetached = detached.status === 0;
  rmSync(mountPoint, { recursive: true, force: true });
  rmSync(profileDir, { recursive: true, force: true });
}

const receipt = {
  schemaVersion: "desktop.clean-profile-install.v1",
  generatedAt: new Date().toISOString(),
  version,
  status: Object.values(checks).every(Boolean) ? "pass" : "failed",
  checks,
  package: { dmgPath },
  warning: "This uses an isolated profile on the release host; it is not a separate clean-machine or organization receipt.",
  error,
};
mkdirSync(dataDir, { recursive: true });
const receiptPath = path.join(dataDir, "desktop-clean-profile-install.json");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: receipt.status === "pass", receiptPath, receipt }, null, 2));
if (receipt.status !== "pass") process.exitCode = 1;
