import { readArtifactPackageFoundation } from "@/features/artifacts/package-contract";
import { readDesktopPackageRehearsals } from "@/features/desktop/package-rehearsal";
import { readAppleReleaseSigningReadiness } from "@/features/desktop/apple-release-signing";
import { readDesktopOnboardingRelease } from "@/features/desktop/onboarding-release";
import { readHaFinOpsReadiness } from "@/features/deployment/ha-finops-readiness";
import { readExtensionRegistryFoundation } from "@/features/extensions/registry";
import { readExtensionSandboxEvidence } from "@/features/extensions/process-sandbox";
import {
  readExtensionQuarantine,
  readExtensionVerificationReceipts,
} from "@/features/extensions/package-verification";
import { readTrainingCapabilityRegistry } from "@/features/finetune/training-capabilities";
import { readWorkspaceIdentityFoundation } from "@/features/governance/workspace-identity";
import { readWorkspaceAclDatabase } from "@/features/governance/workspace-acl-database";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { readModelAcquisitionRegistry } from "@/features/models/model-acquisition";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readRuntimeAdapterConformance } from "@/features/runtime/adapter-conformance";
import { readOllamaHealth } from "@/features/runtime/ollama-adapter";
import { readOllamaConformanceEvidence } from "@/features/runtime/ollama-conformance";
import { readWorkflowGraphFoundation } from "@/features/workflows/graph-contract";
import { readWorkflowExecutions } from "@/features/workflows/execution-reducer";
import { readWorkflowBreakpoints } from "@/features/workflows/breakpoint-store";

export const POST_V1_FOUNDATION_SCHEMA_VERSION =
  "experiments.post-v1-foundation.v1" as const;

export type PostV1FoundationStatus = "foundation-ready" | "partial" | "blocked";

export async function readPostV1Foundation() {
  const desktopPackages = readDesktopPackageRehearsals();
  const appleSigning = readAppleReleaseSigningReadiness();
  const desktopRelease = readDesktopOnboardingRelease();
  const acquisition = readModelAcquisitionRegistry();
  const hubTransfers = readHubTransferSessions();
  const servers = readServerInstanceRegistry();
  const runtimes = readRuntimeAdapterConformance();
  const ollama = await readOllamaHealth();
  const ollamaConformance = readOllamaConformanceEvidence();
  const extensions = readExtensionRegistryFoundation();
  const extensionQuarantine = readExtensionQuarantine();
  const extensionReceipts = readExtensionVerificationReceipts();
  const extensionSandbox = readExtensionSandboxEvidence();
  const workflows = readWorkflowGraphFoundation();
  const workflowExecutions = readWorkflowExecutions();
  const workflowBreakpoints = readWorkflowBreakpoints();
  const governance = readWorkspaceIdentityFoundation();
  const workspaceDatabase = readWorkspaceAclDatabase();
  const postgresRls = readPostgresRlsEvidence();
  const identityProvisioning = readIdentityProvisioningReadiness();
  const training = readTrainingCapabilityRegistry();
  const artifacts = readArtifactPackageFoundation();
  const haFinOps = readHaFinOpsReadiness();
  const rounds: Array<{
    version: string;
    label: string;
    status: PostV1FoundationStatus;
    completionPct: number;
    summary: string;
    evidence: string[];
    blockers: string[];
  }> = [
    {
      version: "v1.1.0",
      label: "Desktop Onboarding",
      status: desktopRelease.gaReady ? "foundation-ready" : desktopRelease.localRcReady ? "partial" : "blocked",
      completionPct: desktopRelease.gaReady ? 100 : desktopRelease.localRcReady ? 92 : desktopPackages.totals.passed > 0 ? 65 : 25,
      summary: `Desktop ${desktopRelease.status}; ${desktopRelease.totals.pass}/${desktopRelease.steps.length} onboarding steps pass and Apple notarization is ${appleSigning.ready ? "ready" : "an external GA gate"}.`,
      evidence: ["/api/desktop/onboarding-release", "/api/desktop/apple-release-signing", desktopRelease.paths.releaseManifest, desktopPackages.paths.directory],
      blockers: [...desktopRelease.blockers, ...desktopRelease.gaBlockers],
    },
    {
      version: "v1.1.1",
      label: "Model Hub Lifecycle",
      status: "foundation-ready",
      completionPct: acquisition.totals.completed > 0 && hubTransfers.sessions.length > 0 ? 42 : acquisition.totals.completed > 0 ? 30 : 18,
      summary: `${acquisition.totals.completed} file transfer(s) completed across ${hubTransfers.sessions.length} Hugging Face/ModelScope session(s).`,
      evidence: ["/api/models/acquisitions", "/api/models/hub-transfers", acquisition.paths.registry],
      blockers: acquisition.totals.completed > 0 ? [] : ["No completed Range transfer and checksum evidence exists yet."],
    },
    {
      version: "v1.2.0",
      label: "Local Server Fleet",
      status: servers.totals.unauthenticatedLan ? "blocked" : "foundation-ready",
      completionPct: 15,
      summary: `${servers.totals.instances} server instance(s) in the durable registry.`,
      evidence: ["/api/models/server-instances", servers.paths.registry],
      blockers: servers.totals.unauthenticatedLan ? ["An unauthenticated LAN server is registered."] : [],
    },
    {
      version: "v1.2.1",
      label: "Runtime Fabric",
      status: "partial",
      completionPct: ollamaConformance.latestPassing ? 44 : ollama.available ? 28 : 18,
      summary: `${runtimes.totals.implemented} implemented adapter(s); Ollama ${ollama.version || "unknown"} model conformance is ${ollamaConformance.latestPassing ? "passing" : "not yet passing"}.`,
      evidence: ["/api/runtime/adapters", "/api/runtime/ollama", "/api/runtime/ollama/conformance", ollamaConformance.path],
      blockers: ollamaConformance.latestPassing ? [] : [ollama.error?.message || "No passing Ollama model conformance report exists."],
    },
    {
      version: "v1.3.0",
      label: "MCP and Extensions",
      status: "partial",
      completionPct: extensionSandbox.latestPassing ? 40 : extensionReceipts.accepted > 0 ? 28 : 18,
      summary: `${extensionReceipts.accepted} signed package(s) accepted; process sandbox rehearsal is ${extensionSandbox.latestPassing ? "passing" : "missing"}.`,
      evidence: ["/api/extensions", "/api/extensions/sandbox", extensionReceipts.directory, extensionQuarantine.directory],
      blockers: extensions.blockers,
    },
    {
      version: "v1.3.1",
      label: "Workflow Graph Studio",
      status: "partial",
      completionPct: workflowExecutions.executions.some((execution) => execution.status === "completed") ? 42 : 25,
      summary: `${workflows.graphs.length} graph(s), ${workflowExecutions.executions.length} durable execution(s), ${workflowBreakpoints.breakpoints.length} persisted breakpoint record(s).`,
      evidence: ["/workflows", "/api/workflows", workflowExecutions.path, workflowBreakpoints.path],
      blockers: workflows.blockers,
    },
    {
      version: "v1.4.0",
      label: "Team Governance",
      status: "partial",
      completionPct: postgresRls.latestPassing ? 42 : workspaceDatabase.localAccess.allowed ? 28 : 15,
      summary: `Workspace identity is ${governance.mode}; Postgres RLS rehearsal is ${postgresRls.latestPassing ? "passing" : "missing"}; OIDC/SCIM have ${identityProvisioning.blockers.length} configuration blocker(s).`,
      evidence: ["/api/governance", "/api/governance/identity", postgresRls.path, workspaceDatabase.databasePath],
      blockers: [...governance.blockers, ...identityProvisioning.blockers],
    },
    {
      version: "v1.4.1",
      label: "Quality and Training Lab",
      status: "partial",
      completionPct: 12,
      summary: `${training.totals.backends} training backend(s), ${training.totals.implemented} implemented and ${training.totals.planned} planned.`,
      evidence: ["/api/finetune/training-capabilities"],
      blockers: ["LLaMA-Factory and Transformers PEFT execution adapters are not connected."],
    },
    {
      version: "v1.5.0",
      label: "Artifact Marketplace",
      status: "partial",
      completionPct: 10,
      summary: `${artifacts.supportedKinds.length} artifact package kinds share one digest/signature/evidence contract.`,
      evidence: ["/api/artifacts/packages"],
      blockers: artifacts.blockers,
    },
    {
      version: "v1.5.1",
      label: "Enterprise HA and FinOps",
      status: haFinOps.productionReadiness.blockers.length ? "blocked" : "partial",
      completionPct: haFinOps.productionReadiness.completionPct,
      summary: `${haFinOps.metrics.usageRecords} usage record(s), ${haFinOps.metrics.failoverRehearsals} failover rehearsal(s), ${haFinOps.metrics.verifiedCloudReceipts} cloud receipt(s).`,
      evidence: ["/api/deployment", "/api/experiments/post-v1-foundation"],
      blockers: haFinOps.blockers,
    },
  ];
  return {
    ok: true as const,
    schemaVersion: POST_V1_FOUNDATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    rounds,
    totals: {
      rounds: rounds.length,
      foundationReady: rounds.filter((round) => round.status === "foundation-ready").length,
      partial: rounds.filter((round) => round.status === "partial").length,
      blocked: rounds.filter((round) => round.status === "blocked").length,
      averageCompletionPct: Math.round(rounds.reduce((sum, round) => sum + round.completionPct, 0) / rounds.length),
    },
  };
}
