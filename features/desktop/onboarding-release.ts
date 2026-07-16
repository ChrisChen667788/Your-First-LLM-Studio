import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

import { readAppleReleaseSigningReadiness } from "@/features/desktop/apple-release-signing";
import { readDesktopExternalAcceptance } from "@/features/desktop/external-acceptance";
import {
  readDesktopDataLifecycleEvidence,
  rehearseDesktopDataLifecycle,
} from "@/features/desktop/data-lifecycle";
import { readDesktopFirstRunReadiness } from "@/features/desktop/first-run-readiness";
import {
  readDesktopPackageRehearsals,
  runDesktopPackageRehearsal,
} from "@/features/desktop/package-rehearsal";
import {
  readDesktopPermissionRepairEvidence,
  rehearseDesktopPermissionRepair,
} from "@/features/desktop/permission-repair";
import {
  readDesktopServiceSupervisorEvidence,
  rehearseDesktopServiceSupervisor,
} from "@/features/desktop/service-supervisor";
import {
  readDesktopUpdateChannelEvidence,
  rehearseDesktopUpdateChannel,
} from "@/features/desktop/update-channel";

export const DESKTOP_ONBOARDING_RELEASE_SCHEMA_VERSION =
  "desktop.onboarding-release.v1" as const;

const RC_VERSION = "1.1.0-rc.2";
const OBSERVABILITY_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const RELEASE_MANIFEST =
  process.env.FIRST_LLM_DESKTOP_RELEASE_MANIFEST ||
  path.join(OBSERVABILITY_DIR, "desktop-release-manifest.json");
const ONBOARDING_RECEIPT = path.join(OBSERVABILITY_DIR, "desktop-onboarding-release.json");
const LOCAL_CHAT_PROOF = path.join(OBSERVABILITY_DIR, "desktop-local-chat-proof.json");
const CLEAN_PROFILE_PROOF = path.join(OBSERVABILITY_DIR, "desktop-clean-profile-install.json");

type BuildManifest = {
  schemaVersion?: string;
  version?: string;
  generatedAt?: string;
  platform?: string;
  architecture?: string;
  package?: {
    embeddedApp?: boolean;
    appPath?: string;
    zipPath?: string;
    zipSha256?: string;
    dmgPath?: string;
    dmgSha256?: string;
  };
  runtime?: { nodeVersion?: string; bundled?: boolean };
  signature?: { mode?: string; verified?: boolean; gaEligible?: boolean };
  files?: Array<{ path: string; bytes: number; sha256: string }>;
};

type LocalChatProof = {
  schemaVersion?: string;
  generatedAt?: string;
  status?: "pass" | "failed";
  provider?: string;
  model?: string;
  latencyMs?: number;
  responseDigest?: string;
  error?: string;
};

type CleanProfileProof = {
  schemaVersion?: string;
  generatedAt?: string;
  status?: "pass" | "failed";
  checks?: Record<string, boolean>;
  warning?: string;
  error?: string;
};

type OnboardingStep = {
  id: string;
  label: string;
  status: "pass" | "watch" | "blocked";
  summary: string;
  evidence: string[];
};

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function statusFor(value: boolean, watch = false): OnboardingStep["status"] {
  return value ? "pass" : watch ? "watch" : "blocked";
}

export function readDesktopOnboardingRelease() {
  const readiness = readDesktopFirstRunReadiness();
  const packages = readDesktopPackageRehearsals();
  const permissions = readDesktopPermissionRepairEvidence();
  const lifecycle = readDesktopDataLifecycleEvidence();
  const services = readDesktopServiceSupervisorEvidence();
  const updates = readDesktopUpdateChannelEvidence();
  const apple = readAppleReleaseSigningReadiness();
  const externalAcceptance = readDesktopExternalAcceptance();
  const build = readJson<BuildManifest>(RELEASE_MANIFEST);
  const localChat = readJson<LocalChatProof>(LOCAL_CHAT_PROOF);
  const cleanProfile = readJson<CleanProfileProof>(CLEAN_PROFILE_PROOF);

  const hostReady = readiness.totals.blocked === 0;
  const buildReady = Boolean(
    build?.version === RC_VERSION &&
      (build.package?.embeddedApp || (build.package?.zipSha256 && build.package?.dmgSha256)) &&
      build.runtime?.bundled &&
      build.signature?.verified,
  );
  const lifecycleReady = Boolean(
    packages.totals.passed > 0 &&
      permissions.latestPassing &&
      lifecycle.latestPassing &&
      services.latestPassing &&
      updates.latestPassing,
  );
  const localChatReady = localChat?.status === "pass";
  const cleanProfileReady = cleanProfile?.status === "pass";

  const steps: OnboardingStep[] = [
    {
      id: "host-diagnosis",
      label: "First-run host diagnosis",
      status: statusFor(hostReady),
      summary: `${readiness.totals.pass} pass, ${readiness.totals.watch} watch, ${readiness.totals.blocked} blocked checks.`,
      evidence: ["/api/desktop/readiness"],
    },
    {
      id: "permission-repair",
      label: "Permission diagnosis and repair",
      status: statusFor(Boolean(permissions.latestPassing)),
      summary: permissions.latestPassing
        ? "Approved-root repair, content preservation, and symlink denial passed."
        : "No passing permission repair receipt is available.",
      evidence: ["/api/desktop/permission-repair", permissions.path],
    },
    {
      id: "data-lifecycle",
      label: "Migration, rollback, and uninstall",
      status: statusFor(Boolean(lifecycle.latestPassing)),
      summary: lifecycle.latestPassing
        ? "Atomic migration, backup restore, uninstall-preserve, and explicit purge passed."
        : "No passing data lifecycle receipt is available.",
      evidence: ["/api/desktop/data-lifecycle", lifecycle.path],
    },
    {
      id: "background-service",
      label: "Background service lifecycle",
      status: statusFor(Boolean(services.latestPassing)),
      summary: services.latestPassing
        ? "Register, start, heartbeat, degradation, recovery, and stop policy passed."
        : "No passing supervisor lifecycle receipt is available.",
      evidence: ["/api/desktop/service-supervisor", services.path],
    },
    {
      id: "update-channel",
      label: "Signed update and rollback channel",
      status: statusFor(Boolean(updates.latestPassing)),
      summary: updates.latestPassing
        ? "Local signed stage, activation, and rollback contract passed."
        : "No passing update-channel receipt is available.",
      evidence: ["/api/desktop/update-channel", updates.paths.store],
    },
    {
      id: "desktop-package",
      label: "Self-contained desktop RC package",
      status: statusFor(buildReady),
      summary: buildReady
        ? `Bundled Node ${build?.runtime?.nodeVersion}; app, ZIP, DMG, digest manifest, and ad-hoc codesign verified.`
        : "Run npm run build:desktop-rc to materialize and verify the RC package.",
      evidence: [RELEASE_MANIFEST, build?.package?.zipPath || "", build?.package?.dmgPath || ""].filter(Boolean),
    },
    {
      id: "local-chat",
      label: "Terminal-free local chat proof",
      status: statusFor(localChatReady),
      summary: localChatReady
        ? `${localChat?.provider}/${localChat?.model} answered in ${localChat?.latencyMs} ms.`
        : localChat?.error || "Run the v1.1 desktop rehearsal against an installed local runtime.",
      evidence: [LOCAL_CHAT_PROOF],
    },
    {
      id: "clean-profile-install",
      label: "Mounted DMG and clean-profile boot",
      status: statusFor(cleanProfileReady),
      summary: cleanProfileReady
        ? "Read-only DMG mount, codesign, terminal-free launch, Agent HTTP, API contract, and cleanup passed."
        : cleanProfile?.error || "Run npm run verify:desktop-rc against the generated DMG.",
      evidence: [CLEAN_PROFILE_PROOF],
    },
    {
      id: "apple-distribution",
      label: "Developer ID and notarization",
      status: statusFor(apple.completed, true),
      summary: apple.completed
        ? "Developer ID, hardened runtime, secure timestamp, Apple notarization, staple, and Gatekeeper verification passed."
        : apple.preflightReady
          ? "Apple credentials and artifacts are ready; run the production signing pipeline."
          : "External Apple signing identity and notarization receipt remain a GA-only gate.",
      evidence: ["/api/desktop/apple-release-signing"],
    },
    {
      id: "external-acceptance",
      label: "Independent Mac and organization acceptance",
      status: statusFor(externalAcceptance.ready, true),
      summary: externalAcceptance.ready
        ? `${externalAcceptance.receipt?.organizationId}/${externalAcceptance.receipt?.operatorId} signed a complete clean-machine receipt.`
        : "A trusted receipt from a different organization-controlled Mac remains required for GA.",
      evidence: ["/api/desktop/external-acceptance", externalAcceptance.paths.receipt],
    },
  ];

  const localRcReady = hostReady && lifecycleReady && buildReady && localChatReady && cleanProfileReady;
  const gaReady = localRcReady && apple.completed && externalAcceptance.ready;
  return {
    ok: true as const,
    schemaVersion: DESKTOP_ONBOARDING_RELEASE_SCHEMA_VERSION,
    version: RC_VERSION,
    generatedAt: new Date().toISOString(),
    status: gaReady ? ("ga-ready" as const) : localRcReady ? ("rc-ready" as const) : ("evidence-needed" as const),
    localRcReady,
    gaReady,
    steps,
    totals: {
      pass: steps.filter((step) => step.status === "pass").length,
      watch: steps.filter((step) => step.status === "watch").length,
      blocked: steps.filter((step) => step.status === "blocked").length,
    },
    blockers: steps.filter((step) => step.status === "blocked").map((step) => step.summary),
    gaBlockers: [
      ...(!apple.completed ? [...apple.blockers, ...apple.completionBlockers] : []),
      ...(!externalAcceptance.ready ? externalAcceptance.blockers : []),
    ],
    build,
    localChat,
    cleanProfile,
    externalAcceptance,
    paths: {
      releaseDirectory: build?.package?.appPath ? path.dirname(build.package.appPath) : null,
      releaseManifest: RELEASE_MANIFEST,
      onboardingReceipt: ONBOARDING_RECEIPT,
      localChatProof: LOCAL_CHAT_PROOF,
      cleanProfileProof: CLEAN_PROFILE_PROOF,
      externalAcceptanceReceipt: externalAcceptance.paths.receipt,
    },
  };
}

export function rehearseDesktopOnboardingRelease() {
  const packageReceipt = runDesktopPackageRehearsal();
  const permissionReceipt = rehearseDesktopPermissionRepair();
  const lifecycleReceipt = rehearseDesktopDataLifecycle();
  const serviceReceipt = rehearseDesktopServiceSupervisor();
  const updateReceipt = rehearseDesktopUpdateChannel({
    channel: "preview",
    fromVersion: "1.0.0",
    toVersion: RC_VERSION,
  });
  const evidence = readDesktopOnboardingRelease();
  const receipt = {
    schemaVersion: "desktop.onboarding-rehearsal.v1",
    generatedAt: new Date().toISOString(),
    status: [packageReceipt, permissionReceipt, lifecycleReceipt, serviceReceipt, updateReceipt].every(
      (entry) => entry.status === "pass",
    )
      ? "pass"
      : "failed",
    receipts: {
      package: packageReceipt.id,
      permission: permissionReceipt.id,
      lifecycle: lifecycleReceipt.id,
      service: serviceReceipt.id,
      update: updateReceipt.id,
    },
    localRcReady: evidence.localRcReady,
    gaReady: evidence.gaReady,
    warning:
      "Local lifecycle and ad-hoc package evidence do not replace Developer ID notarization or a clean-machine organization receipt.",
  };
  mkdirSync(OBSERVABILITY_DIR, { recursive: true });
  writeFileSync(ONBOARDING_RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { receipt, evidence: readDesktopOnboardingRelease() };
}
