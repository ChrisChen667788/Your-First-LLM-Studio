import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "1.1.0-rc.1";
const nodeVersion = process.env.FIRST_LLM_DESKTOP_NODE_VERSION || "22.23.1";
const distDirName = ".next-build";
const distDir = path.join(root, distDirName);
const outputDir = path.join(root, "output", "desktop-release", version);
const appPath = path.join(outputDir, "First LLM Studio.app");
const zipPath = path.join(outputDir, `First-LLM-Studio-${version}-darwin-arm64.zip`);
const dmgPath = path.join(outputDir, `First-LLM-Studio-${version}-darwin-arm64.dmg`);
const cacheDir = path.join(os.homedir(), ".cache", "first-llm-studio-desktop");
const runtimeArchive = path.join(cacheDir, `node-v${nodeVersion}-darwin-arm64.tar.gz`);
const runtimeExtractRoot = path.join(cacheDir, `node-v${nodeVersion}-darwin-arm64`);
const observabilityDir =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    timeout: options.timeout || 15 * 60_000,
    ...options,
  });
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(destination, bytes);
}

async function prepareRuntime() {
  mkdirSync(cacheDir, { recursive: true });
  const archiveName = path.basename(runtimeArchive);
  const baseUrl = `https://nodejs.org/dist/v${nodeVersion}`;
  const checksumsPath = path.join(cacheDir, `SHASUMS256-v${nodeVersion}.txt`);
  if (!existsSync(checksumsPath)) await download(`${baseUrl}/SHASUMS256.txt`, checksumsPath);
  if (!existsSync(runtimeArchive)) await download(`${baseUrl}/${archiveName}`, runtimeArchive);
  const expectedLine = readFileSync(checksumsPath, "utf8")
    .split(/\r?\n/)
    .find((line) => line.endsWith(`  ${archiveName}`));
  if (!expectedLine) throw new Error(`Official Node checksum is missing for ${archiveName}.`);
  const expected = expectedLine.split(/\s+/)[0];
  const actual = sha256File(runtimeArchive);
  if (actual !== expected) throw new Error(`Node runtime checksum mismatch: expected ${expected}, received ${actual}.`);
  if (!existsSync(path.join(runtimeExtractRoot, "bin", "node"))) {
    rmSync(runtimeExtractRoot, { recursive: true, force: true });
    run("/usr/bin/tar", ["-xzf", runtimeArchive, "-C", cacheDir]);
  }
  return { expectedSha256: expected, archivePath: runtimeArchive };
}

function findServerRoot(directory) {
  const direct = path.join(directory, "server.js");
  if (existsSync(direct)) return directory;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = findServerRoot(path.join(directory, entry.name));
    if (candidate) return candidate;
  }
  return null;
}

function listFiles(directory, base = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, base));
    else if (entry.isFile()) {
      const stat = statSync(absolute);
      files.push({ path: path.relative(base, absolute), bytes: stat.size, sha256: sha256File(absolute) });
    } else if (entry.isSymbolicLink()) {
      throw new Error(`Release bundle contains an unexpected symbolic link: ${absolute}`);
    }
  }
  return files;
}

function writeAppBundle(serverRoot) {
  rmSync(outputDir, { recursive: true, force: true });
  const contents = path.join(appPath, "Contents");
  const macosDir = path.join(contents, "MacOS");
  const resourcesDir = path.join(contents, "Resources");
  const appDir = path.join(resourcesDir, "app");
  const runtimeDir = path.join(resourcesDir, "runtime");
  mkdirSync(macosDir, { recursive: true });
  cpSync(serverRoot, appDir, { recursive: true });
  rmSync(path.join(appDir, "output"), { recursive: true, force: true });
  mkdirSync(path.join(runtimeDir, "bin"), { recursive: true });
  cpSync(path.join(runtimeExtractRoot, "bin", "node"), path.join(runtimeDir, "bin", "node"));
  cpSync(path.join(runtimeExtractRoot, "LICENSE"), path.join(runtimeDir, "LICENSE"));

  const standaloneDist = path.join(appDir, distDirName);
  mkdirSync(standaloneDist, { recursive: true });
  cpSync(path.join(distDir, "static"), path.join(standaloneDist, "static"), { recursive: true });
  if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(appDir, "public"), { recursive: true });
  mkdirSync(path.join(appDir, "scripts"), { recursive: true });
  for (const name of ["local_model_gateway.py", "start-local-gateway.sh"]) {
    cpSync(path.join(root, "scripts", name), path.join(appDir, "scripts", name));
  }
  mkdirSync(path.join(appDir, "data"), { recursive: true });
  writeFileSync(
    path.join(appDir, "data", "desktop-release-manifest.json"),
    `${JSON.stringify({
      schemaVersion: "desktop.embedded-release-manifest.v1",
      version,
      generatedAt: new Date().toISOString(),
      platform: "darwin",
      architecture: "arm64",
      package: { embeddedApp: true, appPath: "First LLM Studio.app" },
      runtime: { bundled: true, nodeVersion, architecture: "darwin-arm64" },
      signature: { mode: "apple-adhoc-local-rc", verified: true, gaEligible: false },
    }, null, 2)}\n`,
    "utf8",
  );

  writeFileSync(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>First LLM Studio</string>
  <key>CFBundleExecutable</key><string>first-llm-studio</string>
  <key>CFBundleIdentifier</key><string>cn.firstllm.studio</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>First LLM Studio</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1.0</string>
  <key>CFBundleVersion</key><string>11001</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><false/>
</dict></plist>
`,
    "utf8",
  );

  const launcherPath = path.join(macosDir, "first-llm-studio");
  writeFileSync(
    launcherPath,
    `#!/bin/bash
set -euo pipefail
CONTENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$CONTENTS_DIR/Resources/app"
NODE_BIN="$CONTENTS_DIR/Resources/runtime/bin/node"
DATA_DIR="\${LOCAL_AGENT_DATA_DIR:-$HOME/Library/Application Support/local-agent-lab/observability}"
PORT="\${FIRST_LLM_STUDIO_PORT:-3011}"
LOG_FILE="$DATA_DIR/desktop-server.log"
PID_FILE="$DATA_DIR/desktop-server.pid"
mkdir -p "$DATA_DIR"
if ! /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$PORT/agent" >/dev/null 2>&1; then
  cd "$APP_DIR"
  /usr/bin/nohup /usr/bin/env PORT="$PORT" HOSTNAME="127.0.0.1" LOCAL_AGENT_DATA_DIR="$DATA_DIR" FIRST_LLM_DESKTOP_RELEASE_MANIFEST="$APP_DIR/data/desktop-release-manifest.json" "$NODE_BIN" "$APP_DIR/server.js" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 120); do
    /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$PORT/agent" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi
if [[ "\${FIRST_LLM_STUDIO_NO_BROWSER:-0}" != "1" ]]; then
  /usr/bin/open "http://127.0.0.1:$PORT/agent"
fi
`,
    "utf8",
  );
  chmodSync(launcherPath, 0o755);
}

async function main() {
  if (!process.argv.includes("--skip-next-build")) run("/usr/bin/env", ["npm", "run", "build"], { timeout: 30 * 60_000 });
  const standaloneRoot = path.join(distDir, "standalone");
  if (!existsSync(standaloneRoot)) throw new Error(`Next standalone output is missing: ${standaloneRoot}`);
  const serverRoot = findServerRoot(standaloneRoot);
  if (!serverRoot) throw new Error("Could not locate server.js in the Next standalone output.");
  const runtime = await prepareRuntime();
  writeAppBundle(serverRoot);

  run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath]);
  const verify = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], {
    encoding: "utf8",
  });
  if (verify.status !== 0) throw new Error((verify.stderr || verify.stdout || "Ad-hoc codesign verification failed.").trim());

  run("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);
  const dmgStage = path.join(outputDir, "dmg-stage");
  mkdirSync(dmgStage, { recursive: true });
  cpSync(appPath, path.join(dmgStage, path.basename(appPath)), { recursive: true });
  run("/usr/bin/hdiutil", ["create", "-quiet", "-fs", "HFS+", "-volname", "First LLM Studio", "-srcfolder", dmgStage, dmgPath]);
  rmSync(dmgStage, { recursive: true, force: true });

  const manifest = {
    schemaVersion: "desktop.release-manifest.v1",
    version,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    package: {
      appPath,
      appBytes: listFiles(appPath).reduce((sum, file) => sum + file.bytes, 0),
      zipPath,
      zipBytes: statSync(zipPath).size,
      zipSha256: sha256File(zipPath),
      dmgPath,
      dmgBytes: statSync(dmgPath).size,
      dmgSha256: sha256File(dmgPath),
    },
    runtime: {
      bundled: true,
      nodeVersion,
      architecture: "darwin-arm64",
      archiveSha256: runtime.expectedSha256,
      archivePath: runtime.archivePath,
    },
    signature: {
      mode: "apple-adhoc-local-rc",
      verified: true,
      gaEligible: false,
      warning: "Ad-hoc codesign validates bundle integrity locally; it is not Developer ID signing or Apple notarization.",
    },
    launcher: {
      terminalFree: true,
      defaultRoute: "/agent",
      defaultPort: 3011,
      dataDirectory: "~/Library/Application Support/local-agent-lab/observability",
    },
    files: listFiles(appPath),
  };
  const manifestPath = path.join(outputDir, "release-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  mkdirSync(observabilityDir, { recursive: true });
  writeFileSync(path.join(observabilityDir, "desktop-release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, package: manifest.package, signature: manifest.signature }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
