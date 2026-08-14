#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const releaseState = readJson("release-state.json");
const versionFile = readFileSync(path.join(root, "VERSION"), "utf8").trim();
const releaseTrainSource = readFileSync(path.join(root, "features/experiments/release-train.ts"), "utf8");

const checks = {
  schemaVersion: releaseState.schemaVersion === "first-llm-studio.release-truth.v1",
  packageVersion: packageJson.version === releaseState.sourceVersion,
  packageLockVersion: packageLock.version === releaseState.sourceVersion,
  packageLockRootVersion: packageLock.packages?.[""]?.version === releaseState.sourceVersion,
  versionFile: versionFile === releaseState.sourceVersion,
  activeMilestoneFormat: /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(releaseState.activeMilestone),
  sourceMatchesMilestone: releaseState.activeMilestone === `v${releaseState.sourceVersion}`,
  sourceStatus: releaseState.sourceStatus === "complete",
  localAcceptanceStatus: releaseState.localAcceptanceStatus === "pass",
  releaseTrainMatches: releaseTrainSource.includes(`RELEASE_TRAIN_ACTIVE_VERSION = "${releaseState.activeMilestone}"`),
  publicReleaseDeclared: /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(releaseState.latestPublicGitHubRelease),
  desktopCandidateDeclared: /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(releaseState.latestDesktopCandidate),
  releaseChannelsIndependent: Object.hasOwn(releaseState, "latestPublicGitHubRelease") && Object.hasOwn(releaseState, "latestDesktopCandidate"),
  failClosed: releaseState.distributionStatus === "hold" && releaseState.productionStatus === "blocked",
  blockersPresent: Array.isArray(releaseState.blockers) && releaseState.blockers.length >= 3,
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const report = {
  schemaVersion: "first-llm-studio.release-truth-validation.v1",
  ok: failed.length === 0,
  sourceVersion: releaseState.sourceVersion,
  activeMilestone: releaseState.activeMilestone,
  sourceStatus: releaseState.sourceStatus,
  localAcceptanceStatus: releaseState.localAcceptanceStatus,
  latestPublicGitHubRelease: releaseState.latestPublicGitHubRelease,
  latestDesktopCandidate: releaseState.latestDesktopCandidate,
  distributionStatus: releaseState.distributionStatus,
  productionStatus: releaseState.productionStatus,
  checks,
  failed,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
