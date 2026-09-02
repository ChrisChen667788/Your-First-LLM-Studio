import { createHash } from "node:crypto";

import {
  readExtensionSandboxCapabilities,
  readExtensionSandboxEvidence,
} from "@/features/extensions/process-sandbox";

export const SECURE_SANDBOX_FABRIC_SCHEMA_VERSION =
  "extensions.secure-sandbox-fabric.v1" as const;

export type SandboxWorkloadRequest = {
  workloadId: string;
  filesystemReadPaths: string[];
  filesystemWritePaths: string[];
  networkHosts: string[];
  secretRefs: string[];
  cpuLimit: number;
  memoryMb: number;
  timeoutSeconds: number;
  artifactOutputPath?: string;
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function evaluateSandboxWorkload(input: SandboxWorkloadRequest) {
  const violations = [
    ...(input.filesystemReadPaths.some((entry) => !entry.startsWith("/workspace/readonly/"))
      ? ["Read paths must stay inside /workspace/readonly."]
      : []),
    ...(input.filesystemWritePaths.some((entry) => !entry.startsWith("/workspace/output/"))
      ? ["Write paths must stay inside /workspace/output."]
      : []),
    ...(input.networkHosts.length ? ["Direct network access requires a broker policy."] : []),
    ...(input.secretRefs.length ? ["Direct secret injection requires a broker policy."] : []),
    ...(input.cpuLimit <= 0 || input.cpuLimit > 8 ? ["CPU limit must be between 1 and 8."] : []),
    ...(input.memoryMb < 128 || input.memoryMb > 16_384
      ? ["Memory must be between 128 MB and 16384 MB."]
      : []),
    ...(input.timeoutSeconds <= 0 || input.timeoutSeconds > 3_600
      ? ["Timeout must be between 1 and 3600 seconds."]
      : []),
    ...(input.artifactOutputPath && !input.artifactOutputPath.startsWith("/workspace/output/")
      ? ["Artifact output must stay inside /workspace/output."]
      : []),
  ];
  const withoutDigest = {
    workloadId: input.workloadId,
    executionAllowed: violations.length === 0,
    violations,
    policy: {
      readOnlyInput: true,
      boundedOutput: true,
      networkBrokerRequired: true,
      secretBrokerRequired: true,
      teardownRequired: true,
    },
  };
  return { ...withoutDigest, policyDigest: digest(withoutDigest) };
}

export function readSecureSandboxFabricEvidence() {
  const capabilities = readExtensionSandboxCapabilities();
  const evidence = readExtensionSandboxEvidence();
  const allowedProbe = evaluateSandboxWorkload({
    workloadId: "reference-safe-workload",
    filesystemReadPaths: ["/workspace/readonly/input.json"],
    filesystemWritePaths: ["/workspace/output/result.json"],
    networkHosts: [],
    secretRefs: [],
    cpuLimit: 2,
    memoryMb: 1_024,
    timeoutSeconds: 120,
    artifactOutputPath: "/workspace/output/result.json",
  });
  const deniedProbe = evaluateSandboxWorkload({
    workloadId: "reference-denied-workload",
    filesystemReadPaths: ["/etc/passwd"],
    filesystemWritePaths: ["/tmp/escape"],
    networkHosts: ["api.example.com"],
    secretRefs: ["secret/provider-key"],
    cpuLimit: 99,
    memoryMb: 99_999,
    timeoutSeconds: 9_999,
  });
  return {
    ok: true as const,
    schemaVersion: SECURE_SANDBOX_FABRIC_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceStatus: allowedProbe.executionAllowed && !deniedProbe.executionAllowed ? "pass" as const : "hold" as const,
    localStatus: evidence.latestOsEnforcedPassing ? "pass" as const : "hold" as const,
    productionStatus: "hold" as const,
    capabilities,
    probes: { allowed: allowedProbe, denied: deniedProbe },
    latestOsEnforcedPassing: evidence.latestOsEnforcedPassing,
    disclosure:
      "Policy validation happens before launch. A managed remote sandbox still needs executor-specific network, secret, artifact, resource, and teardown receipts.",
  };
}
