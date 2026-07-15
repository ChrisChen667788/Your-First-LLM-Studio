export const DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION =
  "deployment.control-plane.v1" as const;

export type DeploymentTarget = {
  id: string;
  kind: "local" | "remote";
  status: "available" | "unconfigured";
  endpoint?: string;
  model?: string;
};

export type DeploymentUsageOutboxStatus =
  | "pending"
  | "delivered"
  | "failed";

export type DeploymentUsageOutboxRecord = {
  id: string;
  createdAt: string;
  status: DeploymentUsageOutboxStatus;
  operatorId: string;
  tenantId: string;
  targetId: string;
  eventType: "token-usage";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  idempotencyKey: string;
  payloadHash: string;
};

export type DeploymentAuditArchiveRecord = {
  id: string;
  createdAt: string;
  eventType: "failover.rehearsal" | "registry.read-model" | "usage.outbox";
  operatorId: string;
  subject: string;
  action: string;
  source: "first-llm-studio";
  usageRecordId?: string;
  archivePath: string;
  immutableHash: string;
  archiveProvider?: "local-filesystem" | "aws-s3-object-lock";
  archiveUri?: string;
  bucket?: string;
  objectKey?: string;
  versionId?: string;
  objectLockMode?: "COMPLIANCE" | "GOVERNANCE";
  retainUntil?: string;
  immutable?: boolean;
};

export type DeploymentKmsSignerMode =
  | "local-ed25519-kms"
  | "aws-kms"
  | "external-kms";

export type DeploymentKmsReceipt = {
  id: string;
  createdAt: string;
  signerMode: DeploymentKmsSignerMode;
  keyId: string;
  payloadHash: string;
  signature: string;
  algorithm: string;
  verified: boolean;
  auditRecordId: string;
  usageRecordId: string;
  signingAlgorithm?: string;
  providerRegion?: string;
};

export type DeploymentFailoverStepStatus =
  | "completed"
  | "skipped"
  | "failed";

export type DeploymentFailoverStep = {
  id: string;
  status: DeploymentFailoverStepStatus;
  at: string;
  summary: string;
};

export type DeploymentFailoverRehearsal = {
  id: string;
  createdAt: string;
  operatorId: string;
  primaryRegion: string;
  standbyRegion: string;
  oldPrimaryFenced: boolean;
  standbyPromoted: boolean;
  usageRecordId: string;
  auditRecordId: string;
  receiptId: string;
  measuredRpoMs: number;
  measuredRtoMs: number;
  steps: DeploymentFailoverStep[];
  status: "completed" | "failed";
};

export type DeploymentControlPlaneSummary = {
  ok: true;
  schemaVersion: typeof DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION;
  generatedAt: string;
  revision: string;
  targets: DeploymentTarget[];
  audit: DeploymentAuditArchiveRecord[];
  controlPlane: {
    dataDir: string;
    registry: {
      mode: "local-read-model";
      readOnly: boolean;
      targetCount: number;
    };
    usageOutbox: {
      path: string;
      records: number;
      pending: number;
      delivered: number;
      failed: number;
      latestRecordId?: string;
    };
    auditArchive: {
      path: string;
      provider: "local-filesystem" | "aws-s3-object-lock" | "unconfigured";
      archivedEvents: number;
      immutableArchivedEvents: number;
      latestArchivePath?: string;
      latestHash?: string;
      latestVersionId?: string;
      latestRetainUntil?: string;
    };
    kmsSigning: {
      path: string;
      signerMode: DeploymentKmsSignerMode;
      receipts: number;
      verifiedReceipts: number;
      verifiedCloudReceipts: number;
      latestReceiptId?: string;
      latestKeyId?: string;
    };
    failover: {
      path: string;
      rehearsals: number;
      latestRehearsalId?: string;
      latestRpoMs?: number;
      latestRtoMs?: number;
    };
    cloud: {
      provider: "aws" | "unconfigured";
      configured: boolean;
      requireCloud: boolean;
      manifestPath?: string;
      manifestLoaded: boolean;
      configSource: "env" | "manifest" | "env+manifest" | "none";
      awsCliPath?: string;
      region?: string;
      kmsKeyId?: string;
      signingAlgorithm?: string;
      archiveBucket?: string;
      archivePrefix?: string;
      objectLockMode?: "COMPLIANCE" | "GOVERNANCE";
      retentionDays?: number;
      archiveMode: "aws-s3-object-lock" | "local-filesystem";
      signerMode: DeploymentKmsSignerMode;
      blockers: string[];
    };
  };
  readiness: {
    completionPct: number;
    blockers: string[];
  };
  localReadiness: {
    completionPct: number;
    blockers: string[];
  };
  productionReadiness: {
    completionPct: number;
    blockers: string[];
  };
  evidence: string[];
};

export type DeploymentControlPlaneRehearsalInput = {
  action: "rehearse-production-control-plane";
  requireCloud?: boolean;
  cloudProvider?: "aws";
  operatorId?: string;
  tenantId?: string;
  targetId?: string;
  primaryRegion?: string;
  standbyRegion?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
};

export type DeploymentControlPlaneRehearsalResult = {
  ok: true;
  schemaVersion: typeof DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION;
  generatedAt: string;
  result: {
    usage: DeploymentUsageOutboxRecord;
    audit: DeploymentAuditArchiveRecord;
    receipt: DeploymentKmsReceipt;
    failover: DeploymentFailoverRehearsal;
  };
  summary: DeploymentControlPlaneSummary;
};
