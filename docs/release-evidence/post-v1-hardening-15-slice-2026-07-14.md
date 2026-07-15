# Post-v1 Hardening: 15-Slice Evidence

Date: 2026-07-14
Scope: local, non-cloud hardening acceptance for the next post-v1 implementation slices
Aggregate result: **15 ready / 0 partial / 0 blocked**, 91% average slice completion

This evidence closes the executable local contracts in this batch. It does not promote the complete post-v1 version train, replace Apple Developer ID/notarization, prove organization OIDC/SCIM rollout, or substitute for cloud KMS/HSM and immutable object-storage receipts.

## Implemented Slices

| Version | Slice | Runtime evidence |
| --- | --- | --- |
| `v1.1.0` | Signed update and rollback channel | Local Ed25519 manifest signature, stage, activation, and rollback receipt passed. The receipt explicitly states that this is not Apple notarization. |
| `v1.1.1` | Filesystem-aware dedup plan | Content-addressed, same-device, regular-file eligibility plan remains non-destructive. |
| `v1.1.1` | Atomic hardlink rehearsal | Isolated same-device hardlink replacement passed digest, inode, link-count, and atomic-rename checks. |
| `v1.1.1` | Hub session reconciliation | 3 sessions and 7 files reconciled; 5 completed files had valid paths and SHA-256 metadata, with no exhausted retry budget. |
| `v1.2.0` | Executable server lifecycle | `local-ollama` registration and real `qwen3:0.6b` hot-switch both passed. |
| `v1.2.0` | Idle-unload daemon | A dry-run tick identified the elapsed idle threshold without mutating runtime state. |
| `v1.2.1` | Runtime fleet conformance | Real Ollama `/v1/models` and `/v1/chat/completions` checks passed for `qwen3:0.6b`. An MLX entry with no active model remains informational rather than a false blocker. |
| `v1.3.0` | Atomic extension install | Signed local rehearsal bundles `1.0.0` and `1.1.0` passed verification, sandbox policy, staged expansion, and atomic activation. |
| `v1.3.0` | Extension rollback | Active `1.1.0` rolled back to installed `1.0.0` with a durable lifecycle receipt. |
| `v1.3.1` | Leased safe-node worker | The worker acquired and released leases, advanced replay-safe nodes, and stopped at the approval boundary. |
| `v1.3.1` | Side-effect-safe replay fork | The protected tool action resumed only after an explicit idempotency-key event; replay copied graph/input but no side effects. |
| `v1.4.0` | RBAC policy simulator | 7 owner/builder/viewer, denied-action, missing-membership, and cross-workspace scenarios matched expected decisions. |
| `v1.4.1` | Multi-metric regression suite | 40 paired quality samples improved by 0.080975 and 40 paired latency samples improved by 10.5; both confidence gates passed. |
| `v1.5.0` | Artifact registry round-trip | Provenance scored 100%; signed package digest and dependency pinning passed, and the 52-byte fixture passed local registry SHA-256 round-trip verification. |
| `v1.5.1` | Durable usage reconciliation | 8 real request-ledger records reconciled to 84 prompt + 314 completion = 398 total tokens, with zero difference. |

## Reproduction

```bash
npm run dev
npm run rehearse:post-v1-hardening
npm run typecheck:changed
npm run smoke:routes
```

Primary machine-readable receipt:

`~/Library/Application Support/local-agent-lab/observability/post-v1-hardening-rehearsal.json`

The dedicated rehearsal is repeatable: extension and artifact payloads are deterministic, workflow writes require an explicit idempotency key, model-file deduplication is limited to an isolated fixture, and idle unload defaults to dry-run.

## Verification Result

- `npm run typecheck:changed`: passed all 11 affected partitions (`core-shared`, `core-i18n`, `core-demo-data`, `core-agent`, `core-finetune`, `core-community`, `core-scripts`, `agent-api`, `agent-ui`, `admin`, `app`).
- `npm run smoke:routes`: 81/81 passed, including 10 UI routes, 67 API contracts, and 4 compatibility-header checks.
- Route-smoke integrity: SHA-256 verified; report stored at `output/release-smoke/route-smoke-latest.json`.
- In-app visual automation was not recorded in this run because the desktop browser-control client failed during its own runtime bootstrap (`Cannot redefine property: process`). This is not counted as visual evidence, and the API/SSR smoke result is not presented as a screenshot substitute.

## Product Surface

- `/experiments` now renders the 15-slice hardening projection with ready/partial/blocked state and direct API evidence paths.
- The aggregate contract is `/api/experiments/post-v1-hardening`.
- Individual read-models remain available under Desktop, Models, Runtime, Extensions, Workflows, Governance, Evaluation, Artifacts, and Deployment APIs.

## External Gates Kept Open

- Apple Developer ID signing, notarization, stapling, and clean-machine installation remain external release evidence.
- Organization OIDC/SCIM rollout and production Postgres policy operations remain deployment evidence, not local simulator evidence.
- Cloud KMS/HSM, workload identity, immutable object storage, and production failover remain fail-closed until real cloud receipts exist.
