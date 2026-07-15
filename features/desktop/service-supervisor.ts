import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const DESKTOP_SERVICE_SUPERVISOR_SCHEMA_VERSION = "desktop.service-supervisor.v1" as const;

type ServiceState = "stopped" | "starting" | "running" | "degraded";
type ServiceRecord = {
  id: string;
  label: string;
  state: ServiceState;
  generation: number;
  restartCount: number;
  lastHeartbeatAt?: string;
  updatedAt: string;
};
type Receipt = {
  id: string;
  generatedAt: string;
  status: "pass" | "failed";
  serviceId: string;
  checks: Record<string, boolean>;
  transitions: ServiceState[];
  warning: string;
};
type Store = {
  schemaVersion: typeof DESKTOP_SERVICE_SUPERVISOR_SCHEMA_VERSION;
  services: ServiceRecord[];
  receipts: Receipt[];
};

const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability");
const STORE_FILE = path.join(DATA_DIR, "desktop-service-supervisor.json");

function readStore(): Store {
  if (!existsSync(STORE_FILE)) return { schemaVersion: DESKTOP_SERVICE_SUPERVISOR_SCHEMA_VERSION, services: [], receipts: [] };
  try {
    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Partial<Store>;
    return {
      schemaVersion: DESKTOP_SERVICE_SUPERVISOR_SCHEMA_VERSION,
      services: Array.isArray(parsed.services) ? parsed.services : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
    };
  } catch {
    return { schemaVersion: DESKTOP_SERVICE_SUPERVISOR_SCHEMA_VERSION, services: [], receipts: [] };
  }
}

function writeStore(store: Store) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function persistService(service: ServiceRecord) {
  const store = readStore();
  writeStore({ ...store, services: [service, ...store.services.filter((entry) => entry.id !== service.id)] });
  return service;
}

export function transitionDesktopService(input: { serviceId: string; label?: string; action: "register" | "start" | "heartbeat" | "degrade" | "recover" | "stop" }) {
  const store = readStore();
  const current = store.services.find((entry) => entry.id === input.serviceId);
  const now = new Date().toISOString();
  if (input.action !== "register" && !current) throw new Error("Desktop service is not registered.");
  if (input.action === "register") {
    return persistService(current || { id: input.serviceId, label: input.label?.trim() || input.serviceId, state: "stopped", generation: 0, restartCount: 0, updatedAt: now });
  }
  const state: ServiceState = input.action === "start" || input.action === "recover" || input.action === "heartbeat"
    ? "running"
    : input.action === "degrade" ? "degraded" : "stopped";
  return persistService({
    ...current!,
    state,
    generation: current!.generation + (input.action === "start" || input.action === "recover" ? 1 : 0),
    restartCount: current!.restartCount + (input.action === "recover" ? 1 : 0),
    lastHeartbeatAt: input.action === "heartbeat" || input.action === "recover" ? now : current!.lastHeartbeatAt,
    updatedAt: now,
  });
}

export function rehearseDesktopServiceSupervisor() {
  const serviceId = "local-gateway-supervisor";
  const transitions: ServiceState[] = [];
  transitionDesktopService({ serviceId, label: "Local gateway", action: "register" });
  const registered = transitionDesktopService({ serviceId, action: "stop" }); transitions.push(registered.state);
  const started = transitionDesktopService({ serviceId, action: "start" }); transitions.push(started.state);
  const heartbeat = transitionDesktopService({ serviceId, action: "heartbeat" }); transitions.push(heartbeat.state);
  const degraded = transitionDesktopService({ serviceId, action: "degrade" }); transitions.push(degraded.state);
  const recovered = transitionDesktopService({ serviceId, action: "recover" }); transitions.push(recovered.state);
  const checks = {
    registeredStopped: registered.state === "stopped",
    startCreatesGeneration: started.state === "running" && started.generation >= 1,
    heartbeatRecorded: Boolean(heartbeat.lastHeartbeatAt),
    degradedVisible: degraded.state === "degraded",
    recoveryIncrementsGeneration: recovered.state === "running" && recovered.generation > started.generation,
    recoveryAudited: recovered.restartCount > 0,
  };
  const receipt: Receipt = {
    id: `desktop-supervisor-${randomUUID()}`,
    generatedAt: new Date().toISOString(),
    status: Object.values(checks).every(Boolean) ? "pass" : "failed",
    serviceId,
    checks,
    transitions,
    warning: "This validates durable supervisor state and recovery policy; it does not install or exercise a real launchd service.",
  };
  const store = readStore();
  writeStore({ ...store, receipts: [receipt, ...store.receipts].slice(0, 100) });
  return receipt;
}

export function readDesktopServiceSupervisorEvidence() {
  const store = readStore();
  return { ...store, ok: true as const, generatedAt: new Date().toISOString(), latestPassing: store.receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE };
}
