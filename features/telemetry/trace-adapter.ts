import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import os from "os";
import path from "path";
import {
  readDurableJsonStore,
  updateDurableJsonStore,
} from "@/features/persistence/durable-json-store";

export const TELEMETRY_ADAPTER_SCHEMA_VERSION =
  "telemetry.otlp-adapter.v1" as const;

type TelemetryReceipt = {
  id: string;
  name: string;
  startedAt: string;
  durationMs: number;
  status: "ok" | "error";
  exporter: "otlp" | "langfuse-otlp" | "disabled";
  error?: string;
};

type TelemetryStore = {
  schemaVersion: typeof TELEMETRY_ADAPTER_SCHEMA_VERSION;
  receipts: TelemetryReceipt[];
};

const DATA_DIR =
  process.env.LOCAL_AGENT_DATA_DIR ||
  path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "local-agent-lab",
    "observability",
  );
const STORE_FILE = path.join(DATA_DIR, "telemetry-span-receipts.json");
const storeOptions = {
  filePath: STORE_FILE,
  initial: (): TelemetryStore => ({
    schemaVersion: TELEMETRY_ADAPTER_SCHEMA_VERSION,
    receipts: [],
  }),
  validate: (value: unknown): value is TelemetryStore => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<TelemetryStore>;
    return (
      candidate.schemaVersion === TELEMETRY_ADAPTER_SCHEMA_VERSION &&
      Array.isArray(candidate.receipts)
    );
  },
};

let sdk: NodeSDK | null = null;
let spanProcessor: BatchSpanProcessor | null = null;
let sdkFingerprint = "";

function parseHeaders(value: string | undefined) {
  const headers: Record<string, string> = {};
  for (const item of (value || "").split(",")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    headers[item.slice(0, separator).trim()] = item.slice(separator + 1).trim();
  }
  return headers;
}

function traceEndpoint(base: string) {
  const normalized = base.replace(/\/$/, "");
  return normalized.endsWith("/v1/traces")
    ? normalized
    : `${normalized}/v1/traces`;
}

export function resolveTelemetryConfig() {
  const otlpBase = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const langfuseBase = process.env.LANGFUSE_BASE_URL?.trim();
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  const commonHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  if (otlpBase) {
    return {
      enabled: true as const,
      exporter: "otlp" as const,
      endpoint: traceEndpoint(otlpBase),
      headers: commonHeaders,
      serviceName: process.env.OTEL_SERVICE_NAME || "first-llm-studio",
      environment:
        process.env.LANGFUSE_TRACING_ENVIRONMENT ||
        process.env.DEPLOYMENT_ENVIRONMENT ||
        "local",
      blockers: [] as string[],
    };
  }

  if (langfuseBase && publicKey && secretKey) {
    return {
      enabled: true as const,
      exporter: "langfuse-otlp" as const,
      endpoint: `${langfuseBase.replace(/\/$/, "")}/api/public/otel/v1/traces`,
      headers: {
        ...commonHeaders,
        Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
        "x-langfuse-ingestion-version": "4",
      },
      serviceName: process.env.OTEL_SERVICE_NAME || "first-llm-studio",
      environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || "local",
      blockers: [] as string[],
    };
  }

  return {
    enabled: false as const,
    exporter: "disabled" as const,
    endpoint: null,
    headers: {} as Record<string, string>,
    serviceName: process.env.OTEL_SERVICE_NAME || "first-llm-studio",
    environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || "local",
    blockers: [
      "Set OTEL_EXPORTER_OTLP_ENDPOINT, or configure LANGFUSE_BASE_URL plus LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY.",
    ],
  };
}

function ensureTelemetrySdk() {
  const config = resolveTelemetryConfig();
  if (!config.enabled || !config.endpoint) return config;
  const fingerprint = `${config.exporter}:${config.endpoint}:${config.serviceName}`;
  if (sdk && sdkFingerprint === fingerprint) return config;

  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
    headers: config.headers,
  });
  spanProcessor = new BatchSpanProcessor(exporter, {
    maxQueueSize: 2_048,
    maxExportBatchSize: 256,
    scheduledDelayMillis: 1_000,
    exportTimeoutMillis: 10_000,
  });
  sdk = new NodeSDK({
    serviceName: config.serviceName,
    spanProcessors: [spanProcessor],
  });
  sdk.start();
  sdkFingerprint = fingerprint;
  return config;
}

function recordReceipt(receipt: TelemetryReceipt) {
  updateDurableJsonStore(storeOptions, (store) => ({
    ...store,
    receipts: [receipt, ...store.receipts].slice(0, 500),
  }));
}

export async function withTelemetrySpan<T>(
  name: string,
  attributes: Attributes,
  runner: () => Promise<T>,
) {
  const config = ensureTelemetrySdk();
  const startedAt = new Date();
  const startedMs = Date.now();

  if (!config.enabled) {
    try {
      const result = await runner();
      recordReceipt({
        id: crypto.randomUUID(),
        name,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        status: "ok",
        exporter: "disabled",
      });
      return result;
    } catch (error) {
      recordReceipt({
        id: crypto.randomUUID(),
        name,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        status: "error",
        exporter: "disabled",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  const tracer = trace.getTracer("first-llm-studio");
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    span.setAttribute("deployment.environment.name", config.environment);
    try {
      const result = await runner();
      span.setStatus({ code: SpanStatusCode.OK });
      recordReceipt({
        id: crypto.randomUUID(),
        name,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        status: "ok",
        exporter: config.exporter,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      span.recordException(error instanceof Error ? error : new Error(message));
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      recordReceipt({
        id: crypto.randomUUID(),
        name,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedMs,
        status: "error",
        exporter: config.exporter,
        error: message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function readTelemetryEvidence() {
  const config = resolveTelemetryConfig();
  const store = readDurableJsonStore(storeOptions);
  return {
    ok: true as const,
    schemaVersion: TELEMETRY_ADAPTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    config: {
      enabled: config.enabled,
      exporter: config.exporter,
      endpointConfigured: Boolean(config.endpoint),
      serviceName: config.serviceName,
      environment: config.environment,
      blockers: config.blockers,
    },
    totals: {
      spans: store.receipts.length,
      scheduledForExport: store.receipts.filter(
        (receipt) => receipt.exporter !== "disabled",
      ).length,
      errors: store.receipts.filter((receipt) => receipt.status === "error")
        .length,
    },
    latest: store.receipts[0] || null,
    path: STORE_FILE,
  };
}

export async function shutdownTelemetry() {
  if (!sdk) return;
  const current = sdk;
  const currentProcessor = spanProcessor;
  sdk = null;
  spanProcessor = null;
  sdkFingerprint = "";
  await currentProcessor?.forceFlush();
  await current.shutdown();
}
