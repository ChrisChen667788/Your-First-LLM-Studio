import { readArtifactProvenanceEvidence } from "@/features/artifacts/provenance-gate";
import { readAppleReleaseSigningReadiness } from "@/features/desktop/apple-release-signing";
import { readEvaluationStatisticsEvidence } from "@/features/evaluation/statistics-gate";
import { readExtensionInstallPlans } from "@/features/extensions/install-planner";
import { readExtensionSandboxEvidence } from "@/features/extensions/process-sandbox";
import { readIdentityProvisioningReadiness } from "@/features/governance/identity-provisioning";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { readModelContentAddressIndex } from "@/features/models/content-address-index";
import { readHubTransferSessions } from "@/features/models/hub-transfer-session";
import { readServerInstanceRegistry } from "@/features/models/server-instance-registry";
import { readServerRequestLedger } from "@/features/models/server-request-ledger";
import { readOpenAiCompatibleConformance } from "@/features/runtime/openai-compatible-conformance";
import { readWorkflowGraphRegistry } from "@/features/workflows/graph-registry";

export const POST_V1_CLOSURE_SCHEMA_VERSION = "experiments.post-v1-closure.v1" as const;
type SliceStatus = "ready" | "partial" | "blocked";

export function readPostV1ClosureEvidence() {
  const apple = readAppleReleaseSigningReadiness();
  const hub = readHubTransferSessions();
  const content = readModelContentAddressIndex();
  const servers = readServerInstanceRegistry();
  const requests = readServerRequestLedger();
  const conformance = readOpenAiCompatibleConformance();
  const installPlans = readExtensionInstallPlans();
  const sandbox = readExtensionSandboxEvidence();
  const workflows = readWorkflowGraphRegistry();
  const identity = readIdentityProvisioningReadiness();
  const postgres = readPostgresRlsEvidence();
  const evaluation = readEvaluationStatisticsEvidence();
  const artifacts = readArtifactProvenanceEvidence();
  const postgresContextPassing = Boolean((postgres.latestPassing as { checks?: { requestContextTransactionLocal?: boolean } } | null)?.checks?.requestContextTransactionLocal);
  const slices: Array<{ id: string; version: string; label: string; status: SliceStatus; completionPct: number; summary: string; evidence: string[]; blockers: string[] }> = [
    { id: "desktop-signing", version: "v1.1.0", label: "Developer ID release pipeline", status: apple.completed ? "ready" : "blocked", completionPct: apple.completed ? 100 : 55, summary: `Apple release tools: ${Object.values(apple.tools).filter(Boolean).length}/${Object.keys(apple.tools).length}; identities: ${apple.identityCount}; notarized receipt: ${apple.completed ? "yes" : "no"}.`, evidence: ["/api/desktop/apple-release-signing"], blockers: apple.completed ? [] : [...apple.blockers, ...apple.completionBlockers] },
    { id: "hub-retry", version: "v1.1.1", label: "Hub retry and backoff", status: hub.capabilities.includes("persistent-retry-backoff") ? "ready" : "partial", completionPct: 100, summary: `${hub.sessions.length} durable multi-file session(s) with bounded retry state.`, evidence: ["/api/models/hub-transfers"], blockers: [] },
    { id: "content-index", version: "v1.1.1", label: "Content-address reconciliation", status: content.totals.objects ? "ready" : "partial", completionPct: content.totals.objects ? 90 : 65, summary: `${content.totals.objects} digest object(s), ${content.totals.duplicateCopies} duplicate copy candidate(s).`, evidence: ["/api/models/content-index"], blockers: content.blockers },
    { id: "server-safety", version: "v1.2.0", label: "Local Server safety policy", status: servers.totals.unauthenticatedLan === 0 && servers.totals.unsafeTrustedHosts === 0 ? "ready" : "blocked", completionPct: 90, summary: `${servers.totals.instances} server(s); ${servers.totals.unauthenticatedLan} unauthenticated LAN exposure(s).`, evidence: ["/api/models/server-instances"], blockers: servers.totals.unauthenticatedLan ? ["Unauthenticated LAN server exists."] : [] },
    { id: "request-ledger", version: "v1.2.0", label: "Server request ledger", status: requests.totals.requests ? "ready" : "partial", completionPct: requests.totals.requests ? 90 : 65, summary: `${requests.totals.requests} request(s), ${requests.totals.promptTokens + requests.totals.completionTokens} token(s) accounted.`, evidence: ["/api/models/server-instances/requests"], blockers: requests.totals.requests ? [] : ["No server request evidence has been recorded."] },
    { id: "runtime-conformance", version: "v1.2.1", label: "OpenAI-compatible conformance", status: conformance.latestPassing ? "ready" : "partial", completionPct: conformance.latestPassing ? 100 : 70, summary: `${conformance.reports.length} model-level conformance report(s).`, evidence: ["/api/runtime/openai-conformance"], blockers: conformance.latestPassing ? [] : ["No passing OpenAI-compatible model report exists."] },
    { id: "extension-plan", version: "v1.3.0", label: "Dependency install planner", status: installPlans.totals.ready ? "ready" : "partial", completionPct: installPlans.totals.ready ? 90 : 65, summary: `${installPlans.totals.ready} ready and ${installPlans.totals.blocked} blocked install plan(s).`, evidence: ["/api/extensions/install-plan"], blockers: installPlans.totals.ready ? [] : ["No ready extension install plan exists."] },
    { id: "sandbox-policy", version: "v1.3.0", label: "Permission sandbox policy", status: sandbox.latestPassing ? "ready" : "partial", completionPct: sandbox.latestPassing ? 85 : 60, summary: `Node permission rehearsal is ${sandbox.latestPassing ? "passing" : "missing"}; privileged permissions remain container-gated.`, evidence: ["/api/extensions/sandbox"], blockers: sandbox.blockers },
    { id: "graph-registry", version: "v1.3.1", label: "Versioned graph registry", status: workflows.totals.published ? "ready" : "partial", completionPct: workflows.totals.published ? 90 : 65, summary: `${workflows.totals.published} immutable published graph version(s).`, evidence: ["/api/workflows"], blockers: [] },
    { id: "workflow-deploy", version: "v1.3.1", label: "Deploy-as-API ingress", status: workflows.totals.deployments ? "ready" : "partial", completionPct: workflows.totals.deployments ? 85 : 60, summary: `${workflows.totals.deployments} API deployment slug(s); execution remains durable and step-driven.`, evidence: ["/api/workflows/deploy/protected-tool-resume"], blockers: ["Background model/tool worker execution remains pending."] },
    { id: "oidc-jwks", version: "v1.4.0", label: "OIDC JWKS validation", status: identity.oidc.configured ? "partial" : "blocked", completionPct: identity.oidc.configured ? 75 : 55, summary: `OIDC discovery/JWKS/issuer/audience/expiry/nonce validation is ${identity.oidc.configured ? "configured" : "unconfigured"}.`, evidence: ["/api/governance/identity"], blockers: identity.blockers.filter((blocker) => blocker.includes("OIDC")) },
    { id: "scim-lifecycle", version: "v1.4.0", label: "SCIM lifecycle", status: identity.scim.configured ? "partial" : "blocked", completionPct: identity.scim.configured ? 75 : 55, summary: `${identity.scim.users} user(s), ${identity.scim.groups} group(s); PATCH/deprovision endpoints are fail-closed.`, evidence: ["/api/scim/v2/Users", "/api/scim/v2/Groups"], blockers: identity.blockers.filter((blocker) => blocker.includes("SCIM")) },
    { id: "postgres-context", version: "v1.4.0", label: "Transaction-local RLS context", status: postgresContextPassing ? "ready" : "partial", completionPct: postgresContextPassing ? 100 : 70, summary: `Postgres RLS request context is ${postgresContextPassing ? "transaction-local and passing" : "awaiting rehearsal"}.`, evidence: [postgres.path], blockers: postgresContextPassing ? [] : ["Run the Postgres RLS rehearsal after migration 003."] },
    { id: "evaluation-ci", version: "v1.4.1", label: "Evaluation statistics gate", status: evaluation.latestPassing ? "ready" : "partial", completionPct: evaluation.latestPassing ? 90 : 65, summary: `${evaluation.reports.length} paired evaluation report(s) with confidence bounds.`, evidence: ["/api/evaluation/statistics"], blockers: evaluation.latestPassing ? [] : ["No passing minimum-sample confidence report exists."] },
    { id: "artifact-provenance", version: "v1.5.0", label: "Artifact provenance gate", status: artifacts.latestPassing ? "ready" : "partial", completionPct: artifacts.latestPassing ? 90 : 65, summary: `${artifacts.receipts.length} provenance receipt(s); digest and signature are server-verified.`, evidence: ["/api/artifacts/packages"], blockers: artifacts.latestPassing ? [] : ["No artifact has passed digest, signature, dependency, secret-scan, and evidence checks."] },
  ];
  return {
    ok: true as const,
    schemaVersion: POST_V1_CLOSURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    slices,
    totals: {
      slices: slices.length,
      ready: slices.filter((slice) => slice.status === "ready").length,
      partial: slices.filter((slice) => slice.status === "partial").length,
      blocked: slices.filter((slice) => slice.status === "blocked").length,
      averageCompletionPct: Math.round(slices.reduce((sum, slice) => sum + slice.completionPct, 0) / slices.length),
    },
  };
}
