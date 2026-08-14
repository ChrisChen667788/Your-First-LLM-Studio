import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataDirectory = mkdtempSync(
  path.join(os.tmpdir(), "first-llm-session-migration-test-"),
);
process.env.LOCAL_AGENT_DATA_DIR = dataDirectory;

after(() => {
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("legacy Agent session snapshots migrate before durable validation", async () => {
  const filePath = path.join(dataDirectory, "agent-sessions.json");
  writeFileSync(
    filePath,
    `${JSON.stringify({
      schemaVersion: "0.2.1",
      updatedAt: "2026-04-09T18:29:26.361Z",
      activeSessionId: "legacy-session",
      sessions: [{ id: "legacy-session", title: "Legacy session" }],
    })}\n`,
    "utf8",
  );

  const sessionStore = await import("@/lib/agent/session-store");
  const snapshot = sessionStore.readSessionSnapshot();
  const persisted = JSON.parse(readFileSync(filePath, "utf8")) as {
    schemaVersion?: string;
  };

  assert.equal(snapshot.schemaVersion, "0.3.0");
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.activeSessionId, "legacy-session");
  assert.equal(persisted.schemaVersion, "0.3.0");
});
