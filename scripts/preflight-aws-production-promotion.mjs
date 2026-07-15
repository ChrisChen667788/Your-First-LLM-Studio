#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_CONFIG_PATHS = [
  "/secure/runtime/aws-production-promotion.json",
  "/secure/runtime/aws-deployment-control-plane.json",
];

function parseArgs(argv) {
  const args = {
    config: process.env.FIRST_LLM_DEPLOYMENT_CONFIG || process.env.FIRST_LLM_PRODUCTION_PROMOTION_CONFIG,
    dryRun: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--config") {
      args.config = argv[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--json") {
      args.json = true;
    }
  }
  return args;
}

function expandHome(value) {
  if (!value) return undefined;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

function normalizeObjectLockMode(value) {
  return String(value || "COMPLIANCE").toUpperCase() === "GOVERNANCE" ? "GOVERNANCE" : "COMPLIANCE";
}

function dirnameLikeKey(value) {
  if (!value) return undefined;
  const normalized = String(value).replace(/^\/+|\/+$/g, "");
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex > 0 ? normalized.slice(0, slashIndex) : undefined;
}

function asPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPlaceholderValue(value) {
  if (!value) return false;
  const text = String(value);
  return (
    text.includes("<") ||
    text.includes("/absolute/path/to/aws") ||
    text.includes("123456789012") ||
    text.includes("00000000-0000-0000-0000-000000000000")
  );
}

function sanitizeCliError(message) {
  return message.replace(/(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)=[^\s]+/g, "$1=<redacted>");
}

function redactArn(value) {
  if (!value) return undefined;
  return String(value).replace(/:user\/.+|:role\/.+|:assumed-role\/.+/, ":<principal>");
}

function maskAccount(value) {
  if (!value) return undefined;
  return String(value).replace(/.(?=.{4})/g, "*");
}

function resolveManifestPath(inputPath) {
  if (inputPath) return expandHome(inputPath);
  return DEFAULT_CONFIG_PATHS.find((candidate) => existsSync(candidate));
}

function readManifest(configPath) {
  if (!configPath) {
    return {
      path: undefined,
      loaded: false,
      value: {},
      blockers: ["No deployment config was provided. Pass --config or set FIRST_LLM_DEPLOYMENT_CONFIG."],
    };
  }
  if (!existsSync(configPath)) {
    return {
      path: configPath,
      loaded: false,
      value: {},
      blockers: [`Deployment config not found: ${configPath}`],
    };
  }
  try {
    return {
      path: configPath,
      loaded: true,
      value: JSON.parse(readFileSync(configPath, "utf8")),
      blockers: [],
    };
  } catch (error) {
    return {
      path: configPath,
      loaded: false,
      value: {},
      blockers: [`Deployment config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function buildConfig(manifestState) {
  const manifest = manifestState.value || {};
  const provider = firstString(
    process.env.FIRST_LLM_DEPLOYMENT_CLOUD_PROVIDER,
    manifest.cloudProvider,
    manifest.provider,
    manifest.kind === "aws-production-promotion" ? "aws" : undefined,
  );
  const awsCliPath = expandHome(firstString(process.env.FIRST_LLM_AWS_CLI_PATH, manifest.awsCliPath, manifest.aws?.cliPath)) || "aws";
  const region = firstString(
    process.env.FIRST_LLM_AWS_REGION,
    process.env.AWS_REGION,
    process.env.AWS_DEFAULT_REGION,
    manifest.aws?.region,
    manifest.awsRegion,
    manifest.region,
  );
  const profile = firstString(process.env.FIRST_LLM_AWS_PROFILE, process.env.AWS_PROFILE, manifest.aws?.profile, manifest.awsProfile, manifest.profile);
  const kmsKeyId = firstString(
    process.env.FIRST_LLM_AWS_KMS_KEY_ID,
    process.env.FIRST_LLM_DEPLOYMENT_KMS_KEY_ID,
    manifest.awsKmsKeyId,
    manifest.kmsKeyId,
    manifest.kms?.keyArn,
    manifest.kms?.keyId,
  );
  const archiveBucket = firstString(
    process.env.FIRST_LLM_AUDIT_S3_BUCKET,
    process.env.FIRST_LLM_DEPLOYMENT_AUDIT_BUCKET,
    manifest.auditS3Bucket,
    manifest.archiveBucket,
    manifest.collector?.destinationBucket,
    manifest.collector?.sourceBucket,
  );
  const archivePrefix =
    firstString(
      process.env.FIRST_LLM_AUDIT_S3_PREFIX,
      process.env.FIRST_LLM_DEPLOYMENT_AUDIT_PREFIX,
      manifest.auditS3Prefix,
      manifest.archivePrefix,
      dirnameLikeKey(manifest.collector?.destinationKey),
      dirnameLikeKey(manifest.collector?.sourceKey),
    ) || "first-llm-studio/deployment-audit";
  const signingAlgorithm =
    firstString(
      process.env.FIRST_LLM_AWS_KMS_SIGNING_ALGORITHM,
      manifest.kms?.signingAlgorithm,
      manifest.kmsSigningAlgorithm,
      manifest.signingAlgorithm,
    ) || "RSASSA_PSS_SHA_256";
  const objectLockMode = normalizeObjectLockMode(firstString(process.env.FIRST_LLM_AUDIT_OBJECT_LOCK_MODE, manifest.objectLockMode));
  const retentionDays = asPositiveInteger(firstString(process.env.FIRST_LLM_AUDIT_RETENTION_DAYS, manifest.retentionDays), 365);
  const blockers = [
    ...manifestState.blockers,
    ...(provider === "aws" || kmsKeyId || archiveBucket ? [] : ["Cloud provider is not set to aws."]),
    ...(isPlaceholderValue(awsCliPath) ? ["AWS CLI path is still a placeholder."] : []),
    ...(isPlaceholderValue(kmsKeyId) ? ["KMS key id is still a placeholder."] : []),
    ...(kmsKeyId ? [] : ["Missing FIRST_LLM_AWS_KMS_KEY_ID or manifest.kmsKeyId."]),
    ...(archiveBucket ? [] : ["Missing FIRST_LLM_AUDIT_S3_BUCKET or manifest.auditS3Bucket."]),
    ...(retentionDays > 0 ? [] : ["Retention days must be a positive integer."]),
  ];
  return {
    provider: provider || "unconfigured",
    awsCliPath,
    region,
    profile,
    kmsKeyId,
    archiveBucket,
    archivePrefix,
    signingAlgorithm,
    objectLockMode,
    retentionDays,
    blockers,
  };
}

function buildAwsEnv(config) {
  const env = {
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

function runAws(config, args) {
  const result = spawnSync(config.awsCliPath, args, {
    encoding: "utf8",
    env: buildAwsEnv(config),
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) {
    return {
      ok: false,
      error: `AWS CLI failed to start: ${result.error.message}`,
      stdout: "",
      stderr: "",
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      error: sanitizeCliError((result.stderr || result.stdout || `exit status ${result.status}`).trim()),
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  }
  return {
    ok: true,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function parseJson(output) {
  if (!output.trim()) return {};
  try {
    return JSON.parse(output);
  } catch {
    return {};
  }
}

function check(name, fn) {
  try {
    return fn();
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function runPreflight(config) {
  const checks = [];
  checks.push(check("aws-cli", () => {
    const result = runAws(config, ["--version"]);
    return {
      name: "aws-cli",
      ok: result.ok,
      details: result.ok ? (result.stdout || result.stderr).trim() : undefined,
      error: result.ok ? undefined : result.error,
    };
  }));
  checks.push(check("sts-identity", () => {
    const result = runAws(config, ["sts", "get-caller-identity", "--output", "json"]);
    const data = parseJson(result.stdout);
    return {
      name: "sts-identity",
      ok: result.ok,
      account: maskAccount(data.Account),
      arn: redactArn(data.Arn),
      userId: data.UserId ? `***${String(data.UserId).slice(-4)}` : undefined,
      error: result.ok ? undefined : result.error,
    };
  }));
  checks.push(check("kms-key", () => {
    if (!config.kmsKeyId) {
      return { name: "kms-key", ok: false, error: "Missing KMS key id." };
    }
    const result = runAws(config, ["kms", "describe-key", "--key-id", config.kmsKeyId, "--output", "json"]);
    const data = parseJson(result.stdout);
    const metadata = data.KeyMetadata || {};
    const algorithms = Array.isArray(metadata.SigningAlgorithms) ? metadata.SigningAlgorithms : [];
    const keyUsageOk = metadata.KeyUsage === "SIGN_VERIFY";
    const algorithmOk = algorithms.includes(config.signingAlgorithm);
    return {
      name: "kms-key",
      ok: result.ok && keyUsageOk && algorithmOk,
      keyUsage: metadata.KeyUsage,
      signingAlgorithm: config.signingAlgorithm,
      signingAlgorithmSupported: algorithmOk,
      error: result.ok
        ? keyUsageOk && algorithmOk
          ? undefined
          : "KMS key must use SIGN_VERIFY and support the configured signing algorithm."
        : result.error,
    };
  }));
  checks.push(check("s3-object-lock", () => {
    if (!config.archiveBucket) {
      return { name: "s3-object-lock", ok: false, error: "Missing audit S3 bucket." };
    }
    const result = runAws(config, [
      "s3api",
      "get-bucket-object-lock-configuration",
      "--bucket",
      config.archiveBucket,
      "--output",
      "json",
    ]);
    const data = parseJson(result.stdout);
    const enabled = data.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled";
    return {
      name: "s3-object-lock",
      ok: result.ok && enabled,
      objectLockEnabled: enabled,
      mode: config.objectLockMode,
      retentionDays: config.retentionDays,
      error: result.ok ? (enabled ? undefined : "S3 Object Lock is not enabled for this bucket.") : result.error,
    };
  }));
  return checks;
}

function outputResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`AWS production promotion preflight: ${result.ok ? "PASS" : "BLOCKED"}`);
  console.log(`Config: ${result.manifest.path || "env only"} (${result.manifest.loaded ? "loaded" : "not loaded"})`);
  for (const blocker of result.blockers) {
    console.log(`- blocker: ${blocker}`);
  }
  for (const item of result.checks) {
    console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"}${item.error ? ` - ${item.error}` : ""}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const manifest = readManifest(resolveManifestPath(args.config));
const config = buildConfig(manifest);
const checks = args.dryRun || config.blockers.length ? [] : runPreflight(config);
const checkBlockers = checks.filter((item) => !item.ok).map((item) => `${item.name}: ${item.error || "failed"}`);
const result = {
  ok: config.blockers.length === 0 && checkBlockers.length === 0,
  dryRun: args.dryRun,
  generatedAt: new Date().toISOString(),
  manifest: {
    path: manifest.path,
    loaded: manifest.loaded,
  },
  config: {
    provider: config.provider,
    awsCliPath: config.awsCliPath,
    region: config.region,
    profile: config.profile,
    kmsKeyId: config.kmsKeyId ? `${String(config.kmsKeyId).slice(0, 24)}...` : undefined,
    archiveBucket: config.archiveBucket,
    archivePrefix: config.archivePrefix,
    signingAlgorithm: config.signingAlgorithm,
    objectLockMode: config.objectLockMode,
    retentionDays: config.retentionDays,
  },
  blockers: [...config.blockers, ...checkBlockers],
  checks,
};

outputResult(result, args.json);

if (!args.dryRun && !result.ok) {
  process.exit(1);
}
