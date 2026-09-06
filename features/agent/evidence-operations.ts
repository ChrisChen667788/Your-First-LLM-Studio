import { readAgentHarnessConformance } from "@/features/agent/harness-conformance";
import { readInteractionCacheEvidence } from "@/features/agent/interaction-cache";
import { readIsolatedAgentTeamEvidence } from "@/features/agent/isolated-team-service";
import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalReadModelDigest } from "@/features/evidence/operational-receipts";
import { readSecureSandboxFabricEvidence } from "@/features/extensions/secure-sandbox-fabric";

export function readAgentEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const harness = readAgentHarnessConformance();
  const cache = readInteractionCacheEvidence();
  const teams = readIsolatedAgentTeamEvidence();
  const sandbox = readSecureSandboxFabricEvidence();
  return [
    {
      version: "v4.0.3",
      label: "Live Agent Harness Matrix",
      owner: "features/agent",
      track: "agent",
      contract: "agent.live-harness-matrix.v1",
      requiredMetrics: ["scenarios", "passed", "duplicateEffects"],
      currentSignal: {
        status: "hold",
        summary: `${harness.totals.passed}/${harness.totals.scenarios} deterministic scenarios pass; live provider/runtime coverage is not yet evidenced.`,
        evidenceDigest: operationalReadModelDigest(harness),
      },
      localGate: "Run protected tools, resume, cancellation, usage, and reconnect scenarios on every eligible target.",
      externalGate: "Independent worker and provider-side request receipts remain required.",
    },
    {
      version: "v4.0.4",
      label: "Cache and Billing Attribution",
      owner: "features/agent",
      track: "agent",
      contract: "agent.cache-billing-attribution.v1",
      requiredMetrics: ["requests", "cacheHits", "cachedTokens", "billedTokens"],
      currentSignal: {
        status: "hold",
        summary: `${cache.attribution.hits} cache hit(s) and ${cache.attribution.misses} miss(es); provider billing reconciliation is absent.`,
        evidenceDigest: operationalReadModelDigest(cache),
      },
      localGate: "Join request-chain cache observations to provider-native cached-token and billing records.",
      externalGate: "Provider invoices remain the financial system of record.",
    },
    {
      version: "v4.0.5",
      label: "Multi-Agent Worker Isolation",
      owner: "features/agent",
      track: "agent",
      contract: "agent.worker-isolation-receipts.v1",
      requiredMetrics: ["workers", "conflicts", "mergeReviews"],
      currentSignal: {
        status: "hold",
        summary: `${teams.agents.length} reference agent(s); isolated worker execution and controlled merge receipts are missing.`,
        evidenceDigest: operationalReadModelDigest(teams),
      },
      localGate: "Run separate workers with bounded leases, file claims, crash recovery, conflict detection, and reviewed merge.",
      externalGate: "Independent worker-host identity and repository-owner approval remain external.",
    },
    {
      version: "v4.0.6",
      label: "Sandbox Runtime Attestation",
      owner: "features/extensions",
      track: "agent",
      contract: "extensions.sandbox-runtime-attestation.v1",
      requiredMetrics: ["executions", "deniedScopes", "teardownPasses"],
      currentSignal: {
        status: sandbox.localStatus,
        summary: `Preferred isolation ${sandbox.capabilities.preferredIsolation}; source policy and local evidence remain separately visible.`,
        evidenceDigest: operationalReadModelDigest(sandbox),
      },
      localGate: "Retain per-execution filesystem, network, secret, resource, artifact, and teardown receipts.",
      externalGate: "Linux, Windows, hosted sandbox, and independent penetration evidence remain external.",
    },
  ];
}
