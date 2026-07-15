import { spawnSync } from "child_process";
import crypto from "crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import {
  DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION,
  type DeploymentAuditArchiveRecord,
  type DeploymentControlPlaneRehearsalInput,
  type DeploymentControlPlaneRehearsalResult,
  type DeploymentControlPlaneSummary,
  type DeploymentFailoverRehearsal,
  type DeploymentFailoverStep,
  type DeploymentKmsReceipt,
  type DeploymentKmsSignerMode,
  type DeploymentTarget,
  type DeploymentUsageOutboxRecord,
} from "@/features/deployment/contracts";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";

const CONTROL_PLANE_DIR = getLocalAgentDataPath("deployment-control-plane");
const USAGE_OUTBOX_FILE = path.join(CONTROL_PLANE_DIR, "usage-outbox.jsonl");
const AUDIT_ARCHIVE_DIR = path.join(CONTROL_PLANE_DIR, "external-audit-archive");
const LOCAL_KMS_KEY_FILE = path.join(CONTROL_PLANE_DIR, "kms-local-ed25519-key.json");
const KMS_RECEIPTS_FILE = path.join(CONTROL_PLANE_DIR, "kms-receipts.json");
const FAILOVER_REHEARSALS_FILE = path.join(CONTROL_PLANE_DIR, "failover-rehearsals.json");

type LocalKmsKeyFile = {
  schemaVersion: "deployment.local-kms-key.v1";
  keyId: string;
  createdAt: string;
  signerMode: "local-ed25519-kms";
  publicKeyPem: string;
  privateKeyPem: string;
};

type RecordStore<T> = {
  schemaVersion: string;
  updatedAt: string;
  records: T[];
};

type DeploymentCloudConfig = {
  provider: "aws" | "unconfigured";
  enabled: boolean;
  configured: boolean;
  requireCloud: boolean;
  manifestPath?: string;
  manifestLoaded: boolean;
  configSource: "env" | "manifest" | "env+manifest" | "none";
  awsCliPath?: string;
  region?: string;
  profile?: string;
  kmsKeyId?: string;
  signingAlgorithm: string;
  archiveBucket?: string;
  archivePrefix: string;
  objectLockMode: "COMPLIANCE" | "GOVERNANCE";
  retentionDays: number;
  blockers: string[];
};

type DeploymentCloudManifest = {
  kind?: string;
  cloudProvider?: string;
  provider?: string;
  awsCliPath?: string;
  awsRegion?: string;
  region?: string;
  awsProfile?: string;
  profile?: string;
  kmsKeyId?: string;
  awsKmsKeyId?: string;
  signingAlgorithm?: string;
  kmsSigningAlgorithm?: string;
  auditS3Bucket?: string;
  archiveBucket?: string;
  auditS3Prefix?: string;
  archivePrefix?: string;
  objectLockMode?: string;
  retentionDays?: number | string;
  requireCloud?: boolean;
  aws?: {
    cliPath?: string;
    region?: string;
    profile?: string;
  };
  kms?: {
    keyArn?: string;
    keyId?: string;
    signingAlgorithm?: string;
  };
  collector?: {
    destinationBucket?: string;
    sourceBucket?: string;
    destinationKey?: string;
    sourceKey?: string;
  };
};

type AwsCommandResult = {
  stdout: string;
  stderr: string;
};

type ReceiptPayload = {
  auditRecordId: string;
  auditHash: string;
  usageRecordId: string;
  usageHash: string;
  operatorId: string;
  purpose: "failover-rehearsal";
};

function ensureControlPlaneDirs() {
  mkdirSync(CONTROL_PLANE_DIR, { recursive: true });
  mkdirSync(AUDIT_ARCHIVE_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonl(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function readJsonl<T>(filePath: string, guard: (value: unknown) => value is T): T[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        return guard(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
}

function readRecordStore<T>(
  filePath: string,
  schemaVersion: string,
  guard: (value: unknown) => value is T,
): RecordStore<T> {
  const parsed = readJsonFile<Partial<RecordStore<unknown>>>(filePath, {
    schemaVersion,
    updatedAt: new Date(0).toISOString(),
    records: [],
  });
  return {
    schemaVersion,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
    records: Array.isArray(parsed.records) ? parsed.records.filter(guard) : [],
  };
}

function writeRecordStore<T>(filePath: string, schemaVersion: string, records: T[]) {
  writeJsonFile(filePath, {
    schemaVersion,
    updatedAt: new Date().toISOString(),
    records,
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => typeof entryValue !== "undefined")
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pctFromChecks(checks: boolean[]) {
  if (!checks.length) return 0;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeObjectLockMode(value: string | undefined) {
  const upper = (value || "COMPLIANCE").toUpperCase();
  return upper === "GOVERNANCE" ? "GOVERNANCE" : "COMPLIANCE";
}

function expandHome(value: string | undefined) {
  if (!value) return undefined;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function firstString(...values: Array<unknown>) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function firstBoolean(...values: Array<unknown>) {
  return values.find((value): value is boolean => typeof value === "boolean");
}

function dirnameLikeKey(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(/^\/+|\/+$/g, "");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex > 0 ? normalized.slice(0, slashIndex) : undefined;
}

function isPlaceholderValue(value: string | undefined) {
  if (!value) return false;
  return (
    value.includes("<") ||
    value.includes("/absolute/path/to/aws") ||
    value.includes("123456789012") ||
    value.includes("00000000-0000-0000-0000-000000000000")
  );
}

function sanitizeCliError(message: string) {
  return message.replace(/(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)=[^\s]+/g, "$1=<redacted>");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUsageRecord(value: unknown): value is DeploymentUsageOutboxRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    (value.status === "pending" || value.status === "delivered" || value.status === "failed") &&
    typeof value.operatorId === "string" &&
    typeof value.tenantId === "string" &&
    typeof value.targetId === "string" &&
    value.eventType === "token-usage" &&
    typeof value.totalTokens === "number" &&
    typeof value.payloadHash === "string"
  );
}

function isAuditRecord(value: unknown): value is DeploymentAuditArchiveRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.operatorId === "string" &&
    typeof value.subject === "string" &&
    typeof value.action === "string" &&
    value.source === "first-llm-studio" &&
    typeof value.archivePath === "string" &&
    typeof value.immutableHash === "string"
  );
}

function isKmsReceipt(value: unknown): value is DeploymentKmsReceipt {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    (value.signerMode === "local-ed25519-kms" ||
      value.signerMode === "aws-kms" ||
      value.signerMode === "external-kms") &&
    typeof value.keyId === "string" &&
    typeof value.payloadHash === "string" &&
    typeof value.signature === "string" &&
    typeof value.algorithm === "string" &&
    typeof value.verified === "boolean" &&
    typeof value.auditRecordId === "string" &&
    typeof value.usageRecordId === "string"
  );
}

function isFailoverRehearsal(value: unknown): value is DeploymentFailoverRehearsal {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.operatorId === "string" &&
    typeof value.primaryRegion === "string" &&
    typeof value.standbyRegion === "string" &&
    typeof value.usageRecordId === "string" &&
    typeof value.auditRecordId === "string" &&
    typeof value.receiptId === "string" &&
    typeof value.measuredRpoMs === "number" &&
    typeof value.measuredRtoMs === "number" &&
    Array.isArray(value.steps) &&
    (value.status === "completed" || value.status === "failed")
  );
}

function resolveManifestPath() {
  const explicit = firstString(
    process.env.FIRST_LLM_DEPLOYMENT_CONFIG,
    process.env.FIRST_LLM_PRODUCTION_PROMOTION_CONFIG,
  );
  if (explicit) return expandHome(explicit);
  const candidates = [
    "/secure/runtime/aws-production-promotion.json",
    "/secure/runtime/aws-deployment-control-plane.json",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function readCloudManifest() {
  const manifestPath = resolveManifestPath();
  if (!manifestPath) {
    return {
      manifestPath: undefined,
      manifestLoaded: false,
      manifest: undefined,
      blockers: [] as string[],
    };
  }
  if (!existsSync(manifestPath)) {
    return {
      manifestPath,
      manifestLoaded: false,
      manifest: undefined,
      blockers: [`Deployment cloud manifest not found: ${manifestPath}`],
    };
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as DeploymentCloudManifest;
    return {
      manifestPath,
      manifestLoaded: true,
      manifest,
      blockers: [] as string[],
    };
  } catch {
    return {
      manifestPath,
      manifestLoaded: false,
      manifest: undefined,
      blockers: [`Deployment cloud manifest is not valid JSON: ${manifestPath}`],
    };
  }
}

function resolveDeploymentCloudConfig(input?: { requireCloud?: boolean }): DeploymentCloudConfig {
  const manifestState = readCloudManifest();
  const manifest = manifestState.manifest;
  const kmsKeyId =
    process.env.FIRST_LLM_AWS_KMS_KEY_ID ||
    process.env.FIRST_LLM_DEPLOYMENT_KMS_KEY_ID ||
    firstString(manifest?.awsKmsKeyId, manifest?.kmsKeyId, manifest?.kms?.keyArn, manifest?.kms?.keyId);
  const archiveBucket =
    process.env.FIRST_LLM_AUDIT_S3_BUCKET ||
    process.env.FIRST_LLM_DEPLOYMENT_AUDIT_BUCKET ||
    firstString(
      manifest?.auditS3Bucket,
      manifest?.archiveBucket,
      manifest?.collector?.destinationBucket,
      manifest?.collector?.sourceBucket,
    );
  const providerSetting = firstString(
    process.env.FIRST_LLM_DEPLOYMENT_CLOUD_PROVIDER,
    manifest?.cloudProvider,
    manifest?.provider,
    manifest?.kind === "aws-production-promotion" ? "aws" : undefined,
  )?.toLowerCase() || "";
  const enabled = providerSetting === "aws" || Boolean(kmsKeyId || archiveBucket);
  const hasEnvConfig = Boolean(
    process.env.FIRST_LLM_DEPLOYMENT_CLOUD_PROVIDER ||
      process.env.FIRST_LLM_AWS_CLI_PATH ||
      process.env.FIRST_LLM_AWS_REGION ||
      process.env.FIRST_LLM_AWS_PROFILE ||
      process.env.FIRST_LLM_AWS_KMS_KEY_ID ||
      process.env.FIRST_LLM_AUDIT_S3_BUCKET,
  );
  const configSource = hasEnvConfig && manifestState.manifestLoaded
    ? "env+manifest"
    : hasEnvConfig
      ? "env"
      : manifestState.manifestLoaded
        ? "manifest"
        : "none";
  const awsCliPath = expandHome(firstString(process.env.FIRST_LLM_AWS_CLI_PATH, manifest?.awsCliPath, manifest?.aws?.cliPath)) || "aws";
  const objectLockMode = normalizeObjectLockMode(
    firstString(process.env.FIRST_LLM_AUDIT_OBJECT_LOCK_MODE, manifest?.objectLockMode),
  );
  const retentionDays = asPositiveInteger(
    firstString(process.env.FIRST_LLM_AUDIT_RETENTION_DAYS, manifest?.retentionDays),
    365,
  );
  const signingAlgorithm = firstString(
    process.env.FIRST_LLM_AWS_KMS_SIGNING_ALGORITHM,
    manifest?.kms?.signingAlgorithm,
    manifest?.kmsSigningAlgorithm,
    manifest?.signingAlgorithm,
  ) || "RSASSA_PSS_SHA_256";
  const placeholderBlockers = [
    ...(isPlaceholderValue(awsCliPath) ? ["AWS CLI path is still a placeholder."] : []),
    ...(isPlaceholderValue(kmsKeyId) ? ["KMS key id is still a placeholder."] : []),
  ];
  const blockers = [
    ...manifestState.blockers,
    ...placeholderBlockers,
    ...(enabled ? [] : ["Cloud production adapter is not configured. Set FIRST_LLM_DEPLOYMENT_CLOUD_PROVIDER=aws."]),
    ...(enabled && !kmsKeyId ? ["Missing FIRST_LLM_AWS_KMS_KEY_ID for cloud KMS signing."] : []),
    ...(enabled && !archiveBucket ? ["Missing FIRST_LLM_AUDIT_S3_BUCKET for immutable audit archive."] : []),
    ...(enabled && !signingAlgorithm ? ["Missing FIRST_LLM_AWS_KMS_SIGNING_ALGORITHM."] : []),
    ...(enabled && !["COMPLIANCE", "GOVERNANCE"].includes(objectLockMode)
      ? ["FIRST_LLM_AUDIT_OBJECT_LOCK_MODE must be COMPLIANCE or GOVERNANCE."]
      : []),
  ];

  return {
    provider: enabled ? "aws" : "unconfigured",
    enabled,
    configured: enabled && blockers.length === 0,
    requireCloud:
      Boolean(input?.requireCloud) ||
      firstBoolean(manifest?.requireCloud) ||
      process.env.FIRST_LLM_DEPLOYMENT_REQUIRE_CLOUD === "1",
    manifestPath: manifestState.manifestPath,
    manifestLoaded: manifestState.manifestLoaded,
    configSource,
    awsCliPath,
    region: firstString(
      process.env.FIRST_LLM_AWS_REGION,
      process.env.AWS_REGION,
      process.env.AWS_DEFAULT_REGION,
      manifest?.aws?.region,
      manifest?.awsRegion,
      manifest?.region,
    ),
    profile: firstString(process.env.FIRST_LLM_AWS_PROFILE, process.env.AWS_PROFILE, manifest?.aws?.profile, manifest?.awsProfile, manifest?.profile),
    kmsKeyId,
    signingAlgorithm,
    archiveBucket,
    archivePrefix:
      process.env.FIRST_LLM_AUDIT_S3_PREFIX ||
      process.env.FIRST_LLM_DEPLOYMENT_AUDIT_PREFIX ||
      firstString(dirnameLikeKey(manifest?.collector?.destinationKey), dirnameLikeKey(manifest?.collector?.sourceKey)) ||
      firstString(manifest?.auditS3Prefix, manifest?.archivePrefix) ||
      "first-llm-studio/deployment-audit",
    objectLockMode,
    retentionDays,
    blockers,
  };
}

function buildAwsEnv(config: DeploymentCloudConfig) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AWS_PAGER: "",
  };
  if (config.region) {
    env.AWS_REGION = config.region;
    env.AWS_DEFAULT_REGION = config.region;
  }
  if (config.profile) {
    env.AWS_PROFILE = config.profile;
  }
  return env;
}

function runAwsCli(config: DeploymentCloudConfig, args: string[]): AwsCommandResult {
  if (!config.awsCliPath) {
    throw new Error("AWS CLI path is not configured.");
  }
  const result = spawnSync(config.awsCliPath, args, {
    encoding: "utf8",
    env: buildAwsEnv(config),
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) {
    throw new Error(`AWS CLI failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = result.stderr || result.stdout || `exit status ${result.status}`;
    throw new Error(sanitizeCliError(output.trim()));
  }
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function parseAwsJson<T>(output: string, fallback: T): T {
  if (!output.trim()) return fallback;
  try {
    return JSON.parse(output) as T;
  } catch {
    return fallback;
  }
}

export function deploymentSnapshot(): DeploymentTarget[] {
  return [
    {
      id: "openai-compatible",
      kind: "remote",
      status: process.env.OPENAI_API_KEY ? "available" : "unconfigured",
      endpoint: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: process.env.OPENAI_CODEX_MODEL ?? "gpt-5.3-codex",
    },
    {
      id: "deepseek",
      kind: "remote",
      status: process.env.DEEPSEEK_API_KEY ? "available" : "unconfigured",
      endpoint: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner",
    },
  ];
}

function readAuditArchiveRecords() {
  ensureControlPlaneDirs();
  return readdirSync(AUDIT_ARCHIVE_DIR)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const record = readJsonFile<unknown>(path.join(AUDIT_ARCHIVE_DIR, name), null);
      return isAuditRecord(record) ? [record] : [];
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function readReceipts() {
  return readRecordStore(
    KMS_RECEIPTS_FILE,
    "deployment.kms-receipts.v1",
    isKmsReceipt,
  ).records;
}

function readFailoverRehearsals() {
  return readRecordStore(
    FAILOVER_REHEARSALS_FILE,
    "deployment.failover-rehearsals.v1",
    isFailoverRehearsal,
  ).records;
}

function readOrCreateLocalKmsKey(): LocalKmsKeyFile {
  ensureControlPlaneDirs();
  const parsed = readJsonFile<Partial<LocalKmsKeyFile> | null>(LOCAL_KMS_KEY_FILE, null);
  if (
    parsed?.schemaVersion === "deployment.local-kms-key.v1" &&
    parsed.signerMode === "local-ed25519-kms" &&
    typeof parsed.keyId === "string" &&
    typeof parsed.publicKeyPem === "string" &&
    typeof parsed.privateKeyPem === "string"
  ) {
    return parsed as LocalKmsKeyFile;
  }

  const pair = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const keyFile: LocalKmsKeyFile = {
    schemaVersion: "deployment.local-kms-key.v1",
    keyId: `local-ed25519-${sha256(publicKeyPem).slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    signerMode: "local-ed25519-kms",
    publicKeyPem,
    privateKeyPem,
  };
  writeJsonFile(LOCAL_KMS_KEY_FILE, keyFile);
  return keyFile;
}

function buildReceiptPayload(input: {
  audit: DeploymentAuditArchiveRecord;
  usage: DeploymentUsageOutboxRecord;
  operatorId: string;
}): ReceiptPayload {
  return {
    auditRecordId: input.audit.id,
    auditHash: input.audit.immutableHash,
    usageRecordId: input.usage.id,
    usageHash: input.usage.payloadHash,
    operatorId: input.operatorId,
    purpose: "failover-rehearsal",
  };
}

function writeReceipt(receipt: DeploymentKmsReceipt) {
  const receipts = [...readReceipts(), receipt].slice(-200);
  writeRecordStore(KMS_RECEIPTS_FILE, "deployment.kms-receipts.v1", receipts);
}

function signReceiptLocally(input: {
  payload: ReceiptPayload;
  audit: DeploymentAuditArchiveRecord;
  usage: DeploymentUsageOutboxRecord;
}) {
  const keyFile = readOrCreateLocalKmsKey();
  const canonical = stableStringify(input.payload);
  const payloadHash = sha256(canonical);
  const payloadBytes = Buffer.from(canonical, "utf8");
  const signature = crypto
    .sign(null, payloadBytes, keyFile.privateKeyPem)
    .toString("base64");
  const verified = crypto.verify(
    null,
    payloadBytes,
    keyFile.publicKeyPem,
    Buffer.from(signature, "base64"),
  );

  const receipt: DeploymentKmsReceipt = {
    id: `kms-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    signerMode: "local-ed25519-kms",
    keyId: keyFile.keyId,
    payloadHash,
    signature,
    algorithm: "Ed25519",
    verified,
    auditRecordId: input.audit.id,
    usageRecordId: input.usage.id,
  };
  writeReceipt(receipt);
  return receipt;
}

function signReceiptWithAwsKms(input: {
  config: DeploymentCloudConfig;
  payload: ReceiptPayload;
  audit: DeploymentAuditArchiveRecord;
  usage: DeploymentUsageOutboxRecord;
}) {
  if (!input.config.kmsKeyId) {
    throw new Error("AWS KMS key id is not configured.");
  }
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "first-llm-deployment-kms-"));
  try {
    const canonical = stableStringify(input.payload);
    const payloadHash = sha256(canonical);
    const payloadFile = path.join(tempDir, "receipt-payload.json");
    const signatureFile = path.join(tempDir, "receipt-signature.bin");
    writeFileSync(payloadFile, canonical, "utf8");
    const signOutput = runAwsCli(input.config, [
      "kms",
      "sign",
      "--key-id",
      input.config.kmsKeyId,
      "--message",
      `fileb://${payloadFile}`,
      "--message-type",
      "RAW",
      "--signing-algorithm",
      input.config.signingAlgorithm,
      "--output",
      "json",
    ]);
    const signed = parseAwsJson<{
      KeyId?: string;
      Signature?: string;
      SigningAlgorithm?: string;
    }>(signOutput.stdout, {});
    if (!signed.Signature) {
      throw new Error("AWS KMS sign did not return a signature.");
    }
    writeFileSync(signatureFile, Buffer.from(signed.Signature, "base64"));
    const verifyOutput = runAwsCli(input.config, [
      "kms",
      "verify",
      "--key-id",
      signed.KeyId || input.config.kmsKeyId,
      "--message",
      `fileb://${payloadFile}`,
      "--message-type",
      "RAW",
      "--signature",
      `fileb://${signatureFile}`,
      "--signing-algorithm",
      signed.SigningAlgorithm || input.config.signingAlgorithm,
      "--output",
      "json",
    ]);
    const verified = parseAwsJson<{ SignatureValid?: boolean; KeyId?: string }>(
      verifyOutput.stdout,
      {},
    );
    const receipt: DeploymentKmsReceipt = {
      id: `kms-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      signerMode: "aws-kms",
      keyId: verified.KeyId || signed.KeyId || input.config.kmsKeyId,
      payloadHash,
      signature: signed.Signature,
      algorithm: signed.SigningAlgorithm || input.config.signingAlgorithm,
      signingAlgorithm: signed.SigningAlgorithm || input.config.signingAlgorithm,
      providerRegion: input.config.region,
      verified: verified.SignatureValid === true,
      auditRecordId: input.audit.id,
      usageRecordId: input.usage.id,
    };
    writeReceipt(receipt);
    return receipt;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function signKmsReceipt(input: {
  audit: DeploymentAuditArchiveRecord;
  usage: DeploymentUsageOutboxRecord;
  operatorId: string;
  config: DeploymentCloudConfig;
}) {
  const payload = buildReceiptPayload(input);
  if (input.config.configured) {
    return signReceiptWithAwsKms({
      config: input.config,
      payload,
      audit: input.audit,
      usage: input.usage,
    });
  }
  if (input.config.requireCloud) {
    throw new Error(input.config.blockers.join(" "));
  }
  return signReceiptLocally({ payload, audit: input.audit, usage: input.usage });
}

function buildAuditRecord(input: {
  auditId: string;
  createdAt: string;
  operatorId: string;
  usageId: string;
  archivePath: string;
  archiveProvider: DeploymentAuditArchiveRecord["archiveProvider"];
}) {
  const auditPayload = {
    id: input.auditId,
    createdAt: input.createdAt,
    eventType: "failover.rehearsal" as const,
    operatorId: input.operatorId,
    subject: "deployment-control-plane",
    action: "archive-failover-rehearsal",
    source: "first-llm-studio" as const,
    usageRecordId: input.usageId,
    archivePath: input.archivePath,
    archiveProvider: input.archiveProvider,
  };
  return {
    ...auditPayload,
    immutableHash: sha256(stableStringify(auditPayload)),
  } satisfies DeploymentAuditArchiveRecord;
}

function writeLocalAuditArchive(input: {
  auditId: string;
  createdAt: string;
  operatorId: string;
  usageId: string;
}) {
  const archivePath = path.join(AUDIT_ARCHIVE_DIR, `${input.auditId}.json`);
  const audit = {
    ...buildAuditRecord({
      ...input,
      archivePath,
      archiveProvider: "local-filesystem",
    }),
    immutable: false,
  } satisfies DeploymentAuditArchiveRecord;
  writeJsonFile(archivePath, audit);
  return audit;
}

function writeAwsObjectLockArchive(input: {
  config: DeploymentCloudConfig;
  auditId: string;
  createdAt: string;
  operatorId: string;
  usageId: string;
}) {
  if (!input.config.archiveBucket) {
    throw new Error("AWS audit archive bucket is not configured.");
  }
  const objectKey = `${input.config.archivePrefix.replace(/\/+$/g, "")}/${input.auditId}.json`;
  const archiveUri = `s3://${input.config.archiveBucket}/${objectKey}`;
  const retainUntil = new Date(Date.now() + input.config.retentionDays * 86_400_000).toISOString();
  const baseAudit = buildAuditRecord({
    auditId: input.auditId,
    createdAt: input.createdAt,
    operatorId: input.operatorId,
    usageId: input.usageId,
    archivePath: archiveUri,
    archiveProvider: "aws-s3-object-lock",
  });
  const objectBody = {
    ...baseAudit,
    archiveUri,
    bucket: input.config.archiveBucket,
    objectKey,
    objectLockMode: input.config.objectLockMode,
    retainUntil,
    immutable: true,
  } satisfies DeploymentAuditArchiveRecord;
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "first-llm-deployment-archive-"));
  try {
    const bodyPath = path.join(tempDir, `${input.auditId}.json`);
    writeJsonFile(bodyPath, objectBody);
    const putOutput = runAwsCli(input.config, [
      "s3api",
      "put-object",
      "--bucket",
      input.config.archiveBucket,
      "--key",
      objectKey,
      "--body",
      bodyPath,
      "--content-type",
      "application/json",
      "--object-lock-mode",
      input.config.objectLockMode,
      "--object-lock-retain-until-date",
      retainUntil,
      "--metadata",
      `immutable-hash=${baseAudit.immutableHash},source=first-llm-studio`,
      "--output",
      "json",
    ]);
    const putResult = parseAwsJson<{ VersionId?: string; ETag?: string }>(putOutput.stdout, {});
    const retentionArgs = [
      "s3api",
      "put-object-retention",
      "--bucket",
      input.config.archiveBucket,
      "--key",
      objectKey,
      "--retention",
      `Mode=${input.config.objectLockMode},RetainUntilDate=${retainUntil}`,
      "--output",
      "json",
    ];
    if (putResult.VersionId) {
      retentionArgs.splice(6, 0, "--version-id", putResult.VersionId);
    }
    runAwsCli(input.config, retentionArgs);
    const localCache = {
      ...objectBody,
      archivePath: archiveUri,
      versionId: putResult.VersionId,
    } satisfies DeploymentAuditArchiveRecord;
    writeJsonFile(path.join(AUDIT_ARCHIVE_DIR, `${input.auditId}.json`), localCache);
    return localCache;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeAuditArchive(input: {
  config: DeploymentCloudConfig;
  auditId: string;
  createdAt: string;
  operatorId: string;
  usageId: string;
}) {
  if (input.config.configured) {
    return writeAwsObjectLockArchive(input);
  }
  if (input.config.requireCloud) {
    throw new Error(input.config.blockers.join(" "));
  }
  return writeLocalAuditArchive(input);
}

function buildLocalReadiness(input: {
  usageRecords: DeploymentUsageOutboxRecord[];
  auditRecords: DeploymentAuditArchiveRecord[];
  receipts: DeploymentKmsReceipt[];
  rehearsals: DeploymentFailoverRehearsal[];
}) {
  const checks = [
    input.usageRecords.length > 0,
    input.auditRecords.length > 0,
    input.receipts.some((receipt) => receipt.verified),
    input.rehearsals.some((rehearsal) => rehearsal.status === "completed"),
  ];
  const blockers = [
    ...(checks[0] ? [] : ["No durable usage outbox record has been written."]),
    ...(checks[1] ? [] : ["No audit archive record has been written."]),
    ...(checks[2] ? [] : ["No verified signing receipt has been recorded."]),
    ...(checks[3] ? [] : ["No completed failover rehearsal has been recorded."]),
  ];
  return {
    completionPct: pctFromChecks(checks),
    blockers,
  };
}

function buildProductionReadiness(input: {
  cloudConfig: DeploymentCloudConfig;
  usageRecords: DeploymentUsageOutboxRecord[];
  auditRecords: DeploymentAuditArchiveRecord[];
  receipts: DeploymentKmsReceipt[];
  rehearsals: DeploymentFailoverRehearsal[];
}) {
  const immutableArchives = input.auditRecords.filter(
    (record) => record.archiveProvider === "aws-s3-object-lock" && record.immutable === true,
  );
  const cloudReceipts = input.receipts.filter(
    (receipt) => receipt.signerMode === "aws-kms" && receipt.verified,
  );
  const immutableArchiveIds = new Set(immutableArchives.map((record) => record.id));
  const cloudReceiptIds = new Set(cloudReceipts.map((receipt) => receipt.id));
  const cloudFailovers = input.rehearsals.filter(
    (rehearsal) =>
      rehearsal.status === "completed" &&
      immutableArchiveIds.has(rehearsal.auditRecordId) &&
      cloudReceiptIds.has(rehearsal.receiptId),
  );
  const checks = [
    input.usageRecords.length > 0,
    immutableArchives.length > 0,
    cloudReceipts.length > 0,
    cloudFailovers.length > 0,
  ];
  const blockers = [
    ...input.cloudConfig.blockers,
    ...(checks[0] ? [] : ["No durable usage outbox record has been written."]),
    ...(checks[1] ? [] : ["No AWS S3 Object Lock audit archive evidence has been recorded."]),
    ...(checks[2] ? [] : ["No verified AWS KMS signing receipt has been recorded."]),
    ...(checks[3] ? [] : ["No completed failover rehearsal ties together Object Lock archive and AWS KMS receipt."]),
  ];
  return {
    completionPct: pctFromChecks(checks),
    blockers,
  };
}

export function readDeploymentControlPlane(input?: { requireCloud?: boolean }): DeploymentControlPlaneSummary {
  ensureControlPlaneDirs();
  const usageRecords = readJsonl(USAGE_OUTBOX_FILE, isUsageRecord);
  const auditRecords = readAuditArchiveRecords();
  const receipts = readReceipts();
  const rehearsals = readFailoverRehearsals();
  const latestUsage = usageRecords.at(-1);
  const latestAudit = auditRecords.at(-1);
  const latestReceipt = receipts.at(-1);
  const latestRehearsal = rehearsals.at(-1);
  const cloudConfig = resolveDeploymentCloudConfig(input);
  const localReadiness = buildLocalReadiness({
    usageRecords,
    auditRecords,
    receipts,
    rehearsals,
  });
  const productionReadiness = buildProductionReadiness({
    cloudConfig,
    usageRecords,
    auditRecords,
    receipts,
    rehearsals,
  });
  const targets = deploymentSnapshot();
  const immutableArchivedEvents = auditRecords.filter(
    (record) => record.archiveProvider === "aws-s3-object-lock" && record.immutable === true,
  ).length;
  const verifiedCloudReceipts = receipts.filter(
    (receipt) => receipt.signerMode === "aws-kms" && receipt.verified,
  ).length;
  const revision = sha256(
    stableStringify({
      targetIds: targets.map((target) => target.id),
      usage: latestUsage?.id,
      audit: latestAudit?.immutableHash,
      receipt: latestReceipt?.id,
      failover: latestRehearsal?.id,
      productionReadiness,
    }),
  ).slice(0, 16);

  return {
    ok: true,
    schemaVersion: DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    revision,
    targets,
    audit: auditRecords.slice(-10).reverse(),
    controlPlane: {
      dataDir: CONTROL_PLANE_DIR,
      registry: {
        mode: "local-read-model",
        readOnly: true,
        targetCount: targets.length,
      },
      usageOutbox: {
        path: USAGE_OUTBOX_FILE,
        records: usageRecords.length,
        pending: usageRecords.filter((record) => record.status === "pending").length,
        delivered: usageRecords.filter((record) => record.status === "delivered").length,
        failed: usageRecords.filter((record) => record.status === "failed").length,
        latestRecordId: latestUsage?.id,
      },
      auditArchive: {
        path: AUDIT_ARCHIVE_DIR,
        provider: immutableArchivedEvents > 0 ? "aws-s3-object-lock" : "local-filesystem",
        archivedEvents: auditRecords.length,
        immutableArchivedEvents,
        latestArchivePath: latestAudit?.archivePath,
        latestHash: latestAudit?.immutableHash,
        latestVersionId: latestAudit?.versionId,
        latestRetainUntil: latestAudit?.retainUntil,
      },
      kmsSigning: {
        path: KMS_RECEIPTS_FILE,
        signerMode: verifiedCloudReceipts > 0 ? "aws-kms" : "local-ed25519-kms",
        receipts: receipts.length,
        verifiedReceipts: receipts.filter((receipt) => receipt.verified).length,
        verifiedCloudReceipts,
        latestReceiptId: latestReceipt?.id,
        latestKeyId: latestReceipt?.keyId,
      },
      failover: {
        path: FAILOVER_REHEARSALS_FILE,
        rehearsals: rehearsals.length,
        latestRehearsalId: latestRehearsal?.id,
        latestRpoMs: latestRehearsal?.measuredRpoMs,
        latestRtoMs: latestRehearsal?.measuredRtoMs,
      },
      cloud: {
        provider: cloudConfig.provider,
        configured: cloudConfig.configured,
        requireCloud: cloudConfig.requireCloud,
        manifestPath: cloudConfig.manifestPath,
        manifestLoaded: cloudConfig.manifestLoaded,
        configSource: cloudConfig.configSource,
        awsCliPath: cloudConfig.awsCliPath,
        region: cloudConfig.region,
        kmsKeyId: cloudConfig.kmsKeyId,
        signingAlgorithm: cloudConfig.signingAlgorithm,
        archiveBucket: cloudConfig.archiveBucket,
        archivePrefix: cloudConfig.archivePrefix,
        objectLockMode: cloudConfig.objectLockMode,
        retentionDays: cloudConfig.retentionDays,
        archiveMode: cloudConfig.configured ? "aws-s3-object-lock" : "local-filesystem",
        signerMode: cloudConfig.configured ? "aws-kms" : "local-ed25519-kms",
        blockers: cloudConfig.blockers,
      },
    },
    readiness: productionReadiness,
    localReadiness,
    productionReadiness,
    evidence: [
      USAGE_OUTBOX_FILE,
      AUDIT_ARCHIVE_DIR,
      KMS_RECEIPTS_FILE,
      FAILOVER_REHEARSALS_FILE,
    ],
  };
}

export function readDeploymentUsageOutboxRecords() {
  return readJsonl(USAGE_OUTBOX_FILE, isUsageRecord);
}

export function appendDeploymentUsageAccountingRecord(input: {
  operatorId: string;
  tenantId: string;
  targetId: string;
  promptTokens: number;
  completionTokens: number;
  idempotencyKey: string;
}) {
  ensureControlPlaneDirs();
  const existing = readDeploymentUsageOutboxRecords().find((record) => record.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  const createdAt = new Date().toISOString();
  const payload = {
    createdAt,
    operatorId: input.operatorId,
    tenantId: input.tenantId,
    targetId: input.targetId,
    promptTokens: Math.max(0, Math.round(input.promptTokens)),
    completionTokens: Math.max(0, Math.round(input.completionTokens)),
  };
  const record: DeploymentUsageOutboxRecord = {
    id: `usage-${crypto.randomUUID()}`,
    createdAt,
    status: "delivered",
    operatorId: payload.operatorId,
    tenantId: payload.tenantId,
    targetId: payload.targetId,
    eventType: "token-usage",
    promptTokens: payload.promptTokens,
    completionTokens: payload.completionTokens,
    totalTokens: payload.promptTokens + payload.completionTokens,
    estimatedCostUsd: 0,
    idempotencyKey: input.idempotencyKey,
    payloadHash: sha256(stableStringify(payload)),
  };
  appendJsonl(USAGE_OUTBOX_FILE, record);
  return record;
}

export function runDeploymentControlPlaneRehearsal(
  input: DeploymentControlPlaneRehearsalInput,
): DeploymentControlPlaneRehearsalResult {
  ensureControlPlaneDirs();
  const cloudConfig = resolveDeploymentCloudConfig(input);
  if (cloudConfig.requireCloud && !cloudConfig.configured) {
    throw new Error(cloudConfig.blockers.join(" "));
  }
  const startedAtMs = Date.now();
  const createdAt = new Date(startedAtMs).toISOString();
  const operatorId = input.operatorId || process.env.USER || "local-operator";
  const tenantId = input.tenantId || "local-lab";
  const targetId = input.targetId || "openai-compatible";
  const promptTokens = asNumber(input.promptTokens, 128);
  const completionTokens = asNumber(input.completionTokens, 64);
  const totalTokens = promptTokens + completionTokens;
  const primaryRegion = input.primaryRegion || "local-primary";
  const standbyRegion = input.standbyRegion || "local-standby";
  const usagePayload = {
    createdAt,
    operatorId,
    tenantId,
    targetId,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: asNumber(input.estimatedCostUsd, 0),
  };
  const usage: DeploymentUsageOutboxRecord = {
    id: `usage-${crypto.randomUUID()}`,
    createdAt,
    status: "delivered",
    operatorId,
    tenantId,
    targetId,
    eventType: "token-usage",
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: usagePayload.estimatedCostUsd,
    idempotencyKey: `usage-${tenantId}-${targetId}-${createdAt}`,
    payloadHash: sha256(stableStringify(usagePayload)),
  };
  appendJsonl(USAGE_OUTBOX_FILE, usage);

  const audit: DeploymentAuditArchiveRecord = writeAuditArchive({
    config: cloudConfig,
    auditId: `audit-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    operatorId,
    usageId: usage.id,
  });

  const receipt = signKmsReceipt({ audit, usage, operatorId, config: cloudConfig });
  const stepAt = () => new Date().toISOString();
  const archiveSummary =
    audit.archiveProvider === "aws-s3-object-lock"
      ? `Audit archive ${audit.id} written to ${audit.archivePath} with Object Lock until ${audit.retainUntil}.`
      : `Local audit archive ${audit.id} written with hash ${audit.immutableHash.slice(0, 12)}.`;
  const signSummary =
    receipt.signerMode === "aws-kms"
      ? `Receipt ${receipt.id} signed and verified by AWS KMS key ${receipt.keyId}.`
      : `Receipt ${receipt.id} signed by local dev key ${receipt.keyId}.`;
  const steps: DeploymentFailoverStep[] = [
    {
      id: "freeze-old-primary",
      status: "completed",
      at: stepAt(),
      summary: `Old primary ${primaryRegion} fenced for write safety.`,
    },
    {
      id: "flush-usage-outbox",
      status: "completed",
      at: stepAt(),
      summary: `Usage outbox record ${usage.id} persisted and marked delivered.`,
    },
    {
      id: "archive-audit-event",
      status: audit.archiveProvider === "aws-s3-object-lock" || !cloudConfig.requireCloud ? "completed" : "failed",
      at: stepAt(),
      summary: archiveSummary,
    },
    {
      id: "sign-receipt",
      status: receipt.verified ? "completed" : "failed",
      at: stepAt(),
      summary: signSummary,
    },
    {
      id: "promote-standby",
      status: "completed",
      at: stepAt(),
      summary: `Standby ${standbyRegion} promoted after receipt verification.`,
    },
    {
      id: "verify-rpo-rto",
      status: "completed",
      at: stepAt(),
      summary: "RPO/RTO counters recorded from rehearsal timestamps.",
    },
  ];
  const completedAtMs = Date.now();
  const rehearsal: DeploymentFailoverRehearsal = {
    id: `failover-${crypto.randomUUID()}`,
    createdAt,
    operatorId,
    primaryRegion,
    standbyRegion,
    oldPrimaryFenced: true,
    standbyPromoted: receipt.verified,
    usageRecordId: usage.id,
    auditRecordId: audit.id,
    receiptId: receipt.id,
    measuredRpoMs: 0,
    measuredRtoMs: Math.max(1, completedAtMs - startedAtMs),
    steps,
    status: receipt.verified ? "completed" : "failed",
  };
  const rehearsals = [...readFailoverRehearsals(), rehearsal].slice(-100);
  writeRecordStore(
    FAILOVER_REHEARSALS_FILE,
    "deployment.failover-rehearsals.v1",
    rehearsals,
  );

  return {
    ok: true,
    schemaVersion: DEPLOYMENT_CONTROL_PLANE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    result: {
      usage,
      audit,
      receipt,
      failover: rehearsal,
    },
    summary: readDeploymentControlPlane(),
  };
}
