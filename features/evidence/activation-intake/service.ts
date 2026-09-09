import { readExternalEvidenceActivationStore, upsertExternalEvidenceActivationManifestDurably } from "@/features/evidence/external-activation-store";
import { validateExternalEvidenceActivationManifest, type ExternalEvidenceActivationManifest } from "@/features/evidence/external-activation";
import { readExternalEvidenceRelayStore } from "@/features/evidence/external-relay-store";
import { readExternalEvidenceHandoffStore } from "@/features/evidence/external-handoff-store";
import { ActivationIntakeError, backupSchema, type ActivationLedger } from "./contracts";
import { applyActivationBatch, verifyLedgerHistory } from "./ledger";
import { projectActivationIntake } from "./read-model";
import { createActivationLedgerStore } from "./store";
import { loadActivationTrust } from "./trust";
import { sha256, type IntakeContext } from "./verify";

function validManifestLineage(manifest: ExternalEvidenceActivationManifest) {
  const configuration = readExternalEvidenceRelayStore().configurations.find((entry) => entry.id === manifest.relayConfigurationId);
  const handoff = readExternalEvidenceHandoffStore().handoffs.find((entry) => entry.id === manifest.handoffId);
  return Boolean(configuration && handoff && validateExternalEvidenceActivationManifest(manifest, configuration, handoff).ok);
}

export function loadIntakeContext(): IntakeContext {
  const trust = loadActivationTrust();
  const store = readExternalEvidenceActivationStore();
  return { trust, manifests: store.manifests.filter(validManifestLineage), decisionRequests: store.decisionRequests };
}

export function registerIntakeManifest(input: unknown) {
  loadActivationTrust();
  try {
    const manifest = input as ExternalEvidenceActivationManifest;
    if (!validateExternalEvidenceActivationManifest(input).ok || !validManifestLineage(manifest)) throw new Error("Invalid lineage.");
    return upsertExternalEvidenceActivationManifestDurably(manifest).manifest;
  } catch {
    throw new ActivationIntakeError("binding-mismatch");
  }
}

export function createActivationIntakeService(
  store = createActivationLedgerStore(),
  contextProvider: () => IntakeContext = loadIntakeContext,
) {
  function summary() {
    const ledger = store.read();
    try {
      const context = contextProvider();
      return { ok: true as const, configured: true, ...projectActivationIntake(ledger, context),
        trust: { audience: context.trust.audience, activeKeys: context.trust.keys.filter((key) => key.status === "active").length },
      };
    } catch (error) {
      if (!(error instanceof ActivationIntakeError) || error.code !== "unconfigured") throw error;
      return { ok: true as const, configured: false, revision: ledger.revision, records: ledger.records.length,
        currentRecords: 0, revoked: 0, superseded: 0, openQuarantines: ledger.quarantines.length,
        decisionReceipts: 0, manifests: [], trust: null, stateDigest: null,
        distributionStatus: "hold" as const, productionStatus: "blocked" as const,
      };
    }
  }
  function importBatch(envelopes: unknown[], expectedRevision: number, dryRun = false, now = Date.now()) {
    const context = contextProvider();
    let result: ReturnType<typeof applyActivationBatch> | undefined;
    const mutate = (ledger: ActivationLedger) => {
      verifyLedgerHistory(ledger, context);
      result = applyActivationBatch(ledger, envelopes, context, expectedRevision, now);
      return result.ledger;
    };
    if (dryRun) mutate(store.read()); else store.update(mutate);
    if (!result) throw new ActivationIntakeError("ledger-invalid", 503);
    return { ok: result.ok, dryRun, revision: result.ledger.revision, added: result.added,
      deduplicated: result.deduplicated, code: result.ok ? null : result.code,
      status: result.ok ? 200 : result.status,
      projected: projectActivationIntake(result.ledger, context, now),
    };
  }
  function backup() {
    const ledger = store.read();
    verifyLedgerHistory(ledger, contextProvider());
    return { schemaVersion: "evidence.activation-intake-backup.v1" as const, ledger, ledgerDigest: sha256(JSON.stringify(ledger)) };
  }
  function restore(input: unknown, expectedRevision: number) {
    const parsed = backupSchema.safeParse(input);
    if (!parsed.success || parsed.data.ledgerDigest !== sha256(JSON.stringify(parsed.data.ledger))) throw new ActivationIntakeError("ledger-invalid", 400);
    const context = contextProvider();
    const incoming = parsed.data.ledger;
    verifyLedgerHistory(incoming, context);
    let added = 0;
    store.update((current) => {
      verifyLedgerHistory(current, context);
      if (current.revision !== expectedRevision) throw new ActivationIntakeError("revision-conflict", 409);
      const quarantineMap = new Map(current.quarantines.map((item) => [item.id, item]));
      for (const entry of incoming.quarantines) {
        const existing = quarantineMap.get(entry.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) throw new ActivationIntakeError("replay", 409);
        quarantineMap.set(entry.id, entry);
      }
      let merged = { ...current, quarantines: [...quarantineMap.values()] };
      // Reverify every new record; merge only, never replace existing tombstones.
      for (const record of incoming.records) {
        if (merged.records.some((entry) => entry.digest === record.digest)) continue;
        const applied = applyActivationBatch(merged, [record.envelope], context, merged.revision);
        if (!applied.ok) throw new ActivationIntakeError(applied.code, applied.status);
        merged = applied.ledger;
        added++;
      }
      const changed = added > 0 || merged.quarantines.length !== current.quarantines.length;
      return { ...merged, revision: current.revision + (changed ? 1 : 0) };
    });
    return { ok: true, added, summary: summary() };
  }
  return { summary, importBatch, backup, restore };
}
