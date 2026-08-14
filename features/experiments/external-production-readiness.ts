import { existsSync, readFileSync } from "fs";
import path from "path";
import { readDeploymentControlPlane } from "@/features/deployment/control-plane";
import { readEnterpriseIdpAdapterReadiness } from "@/features/governance/enterprise-idp-adapter";
import { readPostgresRlsEvidence } from "@/features/governance/postgres-rls-evidence";
import { readEnterpriseRetrievalReadModel } from "@/features/retrieval/enterprise-service";
import { readTelemetryEvidence } from "@/features/telemetry/trace-adapter";

export const EXTERNAL_PRODUCTION_READINESS_SCHEMA_VERSION =
  "experiments.external-production-readiness.v1" as const;

function readReleaseTruth() {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "release-state.json"), "utf8"),
  ) as {
    sourceVersion: string;
    distributionStatus: "hold" | "ready";
    productionStatus: "blocked" | "ready";
    blockers: string[];
  };
}

export function readExternalProductionReadiness() {
  const release = readReleaseTruth();
  const identity = readEnterpriseIdpAdapterReadiness();
  const deployment = readDeploymentControlPlane({ requireCloud: true });
  const retrieval = readEnterpriseRetrievalReadModel();
  const telemetry = readTelemetryEvidence();
  const postgresRls = readPostgresRlsEvidence();
  const postgresConfigured = Boolean(
    process.env.FIRST_LLM_WORKSPACE_DATABASE_URL ||
      process.env.ENTERPRISE_RAG_DATABASE_URL,
  );
  const postgresRlsMigrationsPresent = [
    "002_postgres_workspace_rls.sql",
    "003_postgres_request_context.sql",
    "004_postgres_workspace_audit.sql",
  ].every((filename) =>
    existsSync(path.join(process.cwd(), "features", "governance", "migrations", filename)),
  );
  const checks = [
    {
      id: "oidc-scim",
      configured: identity.configured,
      accepted: identity.latest?.status === "pass",
      blocker:
        "Real OIDC login, JWKS rotation, SCIM deprovision, and organization sign-off are missing.",
    },
    {
      id: "postgres-rls",
      configured: postgresConfigured,
      accepted: Boolean(
        postgresConfigured &&
          postgresRlsMigrationsPresent &&
          postgresRls.latestPassing,
      ),
      blocker:
        "A deployed PostgreSQL RLS migration and concurrent-user acceptance receipt are missing.",
    },
    {
      id: "enterprise-retrieval",
      configured: retrieval.status === "configured",
      accepted: false,
      blocker:
        "Configured pgvector, embedding, cross-encoder, and ACL query receipts are missing.",
    },
    {
      id: "otel-langfuse",
      configured: telemetry.config.enabled,
      accepted: false,
      blocker: "No exported OTLP/Langfuse span receipt is available.",
    },
    {
      id: "cloud-kms-object-lock",
      configured: deployment.controlPlane.cloud.configured,
      accepted:
        deployment.controlPlane.auditArchive.immutableArchivedEvents > 0 &&
        deployment.controlPlane.kmsSigning.verifiedCloudReceipts > 0,
      blocker:
        "AWS workload identity, KMS signing, S3 Object Lock archive, and organization receipt are missing.",
    },
  ];
  const blockers = checks.filter((check) => !check.accepted).map((check) => check.blocker);
  return {
    ok: true as const,
    schemaVersion: EXTERNAL_PRODUCTION_READINESS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    release: {
      sourceVersion: release.sourceVersion,
      distributionStatus: release.distributionStatus,
      productionStatus: release.productionStatus,
    },
    status: blockers.length ? ("blocked" as const) : ("ready" as const),
    checks,
    blockers,
    evidence: {
      identity,
      retrieval,
      telemetry,
      cloud: deployment.controlPlane.cloud,
      postgresRlsMigrationsPresent,
      postgresRls,
    },
  };
}
