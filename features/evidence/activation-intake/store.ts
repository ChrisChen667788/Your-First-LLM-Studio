import { existsSync, readFileSync, statSync } from "node:fs";
import { updateJsonFileDurably } from "@/features/persistence/durable-json-file";
import { getLocalAgentDataPath } from "@/lib/agent/data-dir";
import { ActivationIntakeError, emptyActivationLedger, type ActivationLedger } from "./contracts";
import { validateActivationLedger } from "./ledger";

export function createActivationLedgerStore(filePath = getLocalAgentDataPath("experiments", "activation-intake.json")) {
  function read(): ActivationLedger {
    // A replay ledger must not silently roll back to a backup that lacks revocations.
    if (!existsSync(filePath)) {
      if (existsSync(`${filePath}.bak`)) throw new ActivationIntakeError("ledger-invalid", 503);
      return emptyActivationLedger();
    }
    try {
      if (statSync(filePath).size > 32 * 1024 * 1024) throw new Error("Oversized ledger.");
      const ledger: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      if (!validateActivationLedger(ledger)) throw new Error("Invalid ledger.");
      return ledger;
    } catch {
      throw new ActivationIntakeError("ledger-invalid", 503);
    }
  }
  return {
    read,
    update(mutate: (ledger: ActivationLedger) => ActivationLedger) {
      read();
      return updateJsonFileDurably(filePath, emptyActivationLedger, mutate, validateActivationLedger);
    },
  };
}
