# Activation Operations Guide

## Configure

The operations layer requires both `FIRST_LLM_EVIDENCE_TRUST_PATH` and
`FIRST_LLM_ACTIVATION_OPERATIONS_POLICY_PATH`. Both files belong outside the
repository and are read as regular, non-symlink files with no group/other write
permission. The policy binds to the deterministic trust snapshot digest. Changing
keys therefore requires an operator-controlled policy update and a new manifest.

The trust file contains public Ed25519 keys, roles, stage grants, and domain
grants. It must not contain private keys, bearer tokens, or raw evidence. The
policy contains the exact eight activation stages and fourteen source milestones,
plus bounded clock skew, quarantine lease, decision retention, and rotation grace
windows. The schemas and digest rules are in
`features/evidence/activation-operations/contracts.ts` and `canonical.ts`.

## Rotate Authority Keys

Provision the successor public key in the trust file before importing a signed
rotation envelope. The current manifest authority signs a rotation body with
predecessor fingerprint, successor issuer/key ID, successor fingerprint, and a
rotation digest. Import it through the v5.6 intake route, then run the operations
preflight and admission command. Only one transition may be admitted for a
manifest. A rotation makes the old manifest stale for review; issue a new
manifest after the controlled authority completes its own rotation ceremony.

The local service does not generate or store private keys, remotely discover
trust, or declare the successor authoritative. Revocation of the old key remains
an external control-plane action; historical signatures are retained for audit,
while current projections reject revoked keys.

## Quarantine and Decisions

Every rejected batch is represented by a manifest-scoped digest-only case. An
operator claims it with an optimistic operations revision. A live lease fences
other operators; expiry returns the case to open. Release requires the claiming
operator and current revision. A signed authority resolution is still required
to close the underlying intake case.

A decision envelope can be admitted only when the current projection has all
global stages, fourteen matching independent evidence pairs, no conflict, no
open case, and the exact request binding. The first admission consumes that
request. A later decision, even with a new nonce and valid signature, is denied.
An accepted decision is an audit fact, not a local deployment command.

## Commands

```bash
npm run evidence:activation-operations -- --action status
npm run evidence:activation-operations -- --action preflight-rotation --envelope-digest <64-hex>
npm run evidence:activation-operations -- --action admit-rotation --envelope-digest <64-hex> --expected-revision <n>
npm run evidence:activation-operations -- --action claim-quarantine --case-id <64-hex> --expected-revision <n>
npm run evidence:activation-operations -- --action release-quarantine --case-id <64-hex> --expected-revision <n>
npm run evidence:activation-operations -- --action admit-decision --envelope-digest <64-hex> --expected-revision <n>
npm run evidence:activation-operations -- --action export --output /secure/activation-operations.json
npm run evidence:activation-operations -- --action restore --file /secure/activation-operations.json --expected-revision <n>
```

Use `FIRST_LLM_OPERATOR_TOKEN` for remote HTTPS and
`FIRST_LLM_OPERATOR_ID` for claim ownership. Do not put credentials into URLs,
files, or source control. `status` is read-only. Export requires operator
authorization. Restore first verifies bundle checksum, trust snapshot, policy,
and every signed ledger record; it then merges operation metadata only when the
current ledger already contains the referenced records. It never replaces newer
state or removes tombstones.

## Evidence Meaning

The API exposes `configured`, `trustSnapshotDigest`, `policyDigest`, rotation,
conflict, quarantine and decision-consumption state. `eligibleForReview` means
the local operational checks passed. It does not mean an organization accepted
the workload, the archive is immutable, the distribution channel approved a
release, or production authorized a transition. The service intentionally keeps
distribution at `HOLD` and production at `BLOCKED`.
