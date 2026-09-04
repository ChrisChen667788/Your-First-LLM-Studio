import type { EvidenceOperationMilestoneSpec } from "@/features/evidence/operational-receipts";
import { operationalEvidenceDigest } from "@/features/evidence/operational-receipts";
import { readProviderCapabilityCatalog } from "@/features/providers/capability-application";
import { readWorkloadRoutingReadModel } from "@/features/providers/workload-routing";

export function readProviderEvidenceOperationSpecs(): EvidenceOperationMilestoneSpec[] {
  const catalog = readProviderCapabilityCatalog();
  const routing = readWorkloadRoutingReadModel();
  return [
    {
      version: "v4.0.0",
      label: "Provider Account Catalog Receipts",
      owner: "features/providers",
      track: "provider",
      contract: "providers.account-catalog-receipts.v1",
      requiredMetrics: ["advertisedModelCount", "probeLatencyMs"],
      currentSignal: {
        status: "hold",
        summary: `${catalog.totals.configuredRemote} configured remote target(s); no fresh account catalog receipt is promoted automatically.`,
        evidenceDigest: operationalEvidenceDigest(catalog),
      },
      localGate: "Probe each configured account model catalog and retain latency, advertised ids, alias decision, and digest.",
      externalGate: "Provider account ownership and billing authorization require independent review.",
    },
    {
      version: "v4.0.1",
      label: "Workload Quality Cohorts",
      owner: "features/providers",
      track: "evaluation",
      contract: "providers.workload-quality-cohorts.v1",
      requiredMetrics: ["sampleCount", "qualityScore", "successRatePct"],
      currentSignal: {
        status: routing.selectedTargetId ? "pass" : "hold",
        summary: routing.decision,
        evidenceDigest: routing.scorecardDigest,
      },
      localGate: "Attach at least 20 aligned, evaluator-bound samples to every routing candidate.",
      externalGate: "Independent quality reproduction and provider invoice reconciliation remain required.",
    },
    {
      version: "v4.0.2",
      label: "Shadow Routing and Fallback Replay",
      owner: "features/providers",
      track: "provider",
      contract: "providers.shadow-routing-replay.v1",
      requiredMetrics: ["shadowRequests", "fallbackReplays", "decisionMatches"],
      currentSignal: {
        status: "hold",
        summary: routing.failClosed
          ? "Routing correctly fails closed, but no observed shadow-request replay receipt exists."
          : "A measured route exists; shadow replay still requires an observed request cohort.",
        evidenceDigest: routing.scorecardDigest,
      },
      localGate: "Replay shadow requests through the selected and fallback targets without changing user-visible routing.",
      externalGate: "Live-traffic authorization, cost ownership, and rollout approval remain external.",
    },
  ];
}
