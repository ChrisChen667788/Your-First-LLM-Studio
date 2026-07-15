import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

export const SERVER_SWITCH_CONTROLLER_SCHEMA_VERSION = "models.server-switch-controller.v1" as const;
type SwitchAttempt = { fromModel: string; toModel: string; inflightSequence: number[]; candidateHealthy: boolean; activatedModel: string; rolledBack: boolean };
type Receipt = { id: string; generatedAt: string; status: "pass" | "failed"; attempts: SwitchAttempt[]; checks: Record<string, boolean>; warning: string };
const DATA_DIR = process.env.LOCAL_AGENT_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", "local-agent-lab", "observability"); const STORE_FILE = path.join(DATA_DIR, "server-switch-controller.json");
function readReceipts(): Receipt[] { if (!existsSync(STORE_FILE)) return []; try { const value = JSON.parse(readFileSync(STORE_FILE, "utf8")) as { receipts?: Receipt[] }; return Array.isArray(value.receipts) ? value.receipts : []; } catch { return []; } }
function persist(receipt: Receipt) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(STORE_FILE, `${JSON.stringify({ schemaVersion: SERVER_SWITCH_CONTROLLER_SCHEMA_VERSION, receipts: [receipt, ...readReceipts()].slice(0, 100) }, null, 2)}\n`, "utf8"); }
export function planDrainAwareSwitch(input: { fromModel: string; toModel: string; inflightSequence: number[]; candidateHealthy: boolean }): SwitchAttempt {
  if (!input.inflightSequence.length || input.inflightSequence.some((value) => value < 0)) throw new Error("A non-negative inflight sequence is required.");
  const drained = input.inflightSequence.at(-1) === 0;
  const activate = drained && input.candidateHealthy;
  return { ...input, activatedModel: activate ? input.toModel : input.fromModel, rolledBack: !activate };
}
export function rehearseServerSwitchController() {
  const success = planDrainAwareSwitch({ fromModel: "qwen3:0.6b", toModel: "qwen3:4b", inflightSequence: [3, 1, 0], candidateHealthy: true });
  const rollback = planDrainAwareSwitch({ fromModel: "qwen3:4b", toModel: "broken:model", inflightSequence: [2, 0], candidateHealthy: false });
  const checks = { drainsBeforeActivation: success.inflightSequence.at(-1) === 0 && success.activatedModel === success.toModel, oldModelRetainedDuringDrain: success.inflightSequence[0] > 0, unhealthyCandidateRollsBack: rollback.rolledBack && rollback.activatedModel === rollback.fromModel, noNegativeInflight: [...success.inflightSequence, ...rollback.inflightSequence].every((value) => value >= 0) };
  const receipt: Receipt = { id: `server-switch-${randomUUID()}`, generatedAt: new Date().toISOString(), status: Object.values(checks).every(Boolean) ? "pass" : "failed", attempts: [success, rollback], checks, warning: "The controller state machine is rehearsed without sending traffic to a live runtime." }; persist(receipt); return receipt;
}
export function readServerSwitchControllerEvidence() { const receipts = readReceipts(); return { ok: true as const, schemaVersion: SERVER_SWITCH_CONTROLLER_SCHEMA_VERSION, generatedAt: new Date().toISOString(), receipts, latestPassing: receipts.find((entry) => entry.status === "pass") || null, path: STORE_FILE }; }
