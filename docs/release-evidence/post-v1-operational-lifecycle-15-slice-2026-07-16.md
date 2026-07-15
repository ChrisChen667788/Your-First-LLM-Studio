# Post-v1 Operational Lifecycle: Third 15-Slice Evidence

Date: 2026-07-16
Scope: local, non-cloud lifecycle acceptance across `v1.1.0` through `v1.5.1`
Aggregate result: **15 ready / 0 partial / 0 blocked**, 92% average slice completion

This batch moves the post-v1 foundations from contract availability into explicit operational state machines. It validates denial paths, recovery, rollback, retention, fencing, approval, promotion, and settlement locally. It does not mark the planned post-v1 releases as shipped and does not replace real launchd, hub-network, physical-storage, multi-node, public-registry, external billing, identity, or cloud evidence.

## Acceptance Results

| Version | Slice | Result |
| --- | --- | --- |
| `v1.1.0` | Background-service lifecycle | Registered, started, heartbeated, degraded, and recovered the local-gateway supervisor state; generation and restart audit increased. |
| `v1.1.0` | Permission repair | Detected owner-write loss, repaired mode `500 -> 700`, preserved content digest, and denied symbolic-link repair in an isolated fixture. |
| `v1.1.1` | Authenticated source manifest | Materialized a pinned three-file Hugging Face manifest with HTTPS URLs, byte counts, SHA-256 values, and no persisted token value. |
| `v1.1.1` | Transfer concurrency scheduler | Enforced global `2` / per-host `1` concurrency, priority ordering, retry backoff, and cancellation exclusion. |
| `v1.1.1` | Ownership-safe model removal | Atomic quarantine, shared hardlink preservation, rollback, and final orphan cleanup passed without touching installed models. |
| `v1.2.0` | Drain-aware hot switch | A `3 -> 1 -> 0` in-flight drain activated the healthy candidate; an unhealthy candidate retained the previous model. |
| `v1.2.0` | Request-log retention/export | A seven-day projection retained one fresh entry, removed one expired entry, replaced caller key identity with a hash alias, and materialized an export digest. |
| `v1.2.1` | Remote heartbeat lease/fencing | Expired the stale primary, selected the fresh standby, and advanced fencing generation from `7` to `8` with one eligible node. |
| `v1.3.0` | Extension permission grant/revoke | Denied an unconfirmed write grant, allowed a confirmed grant, then denied it after revocation. |
| `v1.3.0` | Quarantine review/release | Released a package only after signature, sandbox, and dependency checks; denied and rejected a failing package with operator evidence. |
| `v1.3.1` | Workflow deploy auth/version pin | Allowed only the exact slug/version/scope, denied wrong version/scope and revoked keys, and persisted only the token digest. |
| `v1.4.0` | Four-eyes access review | Denied requester self-approval and accepted a time-bounded decision from an independent security administrator with reason evidence. |
| `v1.4.1` | Reproducible baseline promotion | Pinned model/adapter/dataset/prompt/scorer/judge/seed, promoted quality `0.82 -> 0.85`, latency `520 -> 490`, and judge agreement `0.90`. |
| `v1.5.0` | Artifact install lifecycle | Verified package digests, upgraded, rolled back to `1.0.0`, denied active-version unpublish, and withdrew inactive `1.1.0`. |
| `v1.5.1` | Durable usage settlement | Persisted `pending -> failed -> delivered`, retained retry metadata, recorded an external receipt, and suppressed the duplicate idempotency key. |

## Reproduction

```bash
npm run dev
npm run rehearse:post-v1-lifecycle
npm run typecheck:changed
npm run smoke:routes
```

Machine-readable report:

`~/Library/Application Support/local-agent-lab/observability/post-v1-lifecycle-rehearsal.json`

The lifecycle rehearsal invokes `rehearse:post-v1-acceptance`, which in turn establishes the earlier hardening prerequisites before these fifteen transitions execute.

## Verification

- `npm run rehearse:post-v1-lifecycle`: 15/15 ready, 92% average local lifecycle completion.
- `npm run smoke:routes`: 112/112 passed; 10 UI routes, 98 API contracts, and 4 compatibility-header checks.
- Route-smoke integrity: verified SHA-256 `9c7f26fb8976eab26af9d2a3103b9bef920b0d5a75182512b25d366e4c650e56`, with eight consecutive passing reports.
- `npm run typecheck:changed`: all 11 changed TypeScript partitions passed, including strict `admin`, `agent-api`, `agent-ui`, and aggregate `app` checks.

## Boundaries Still Open

- Desktop service and permission receipts do not install launchd or exercise macOS privacy prompts on a clean signed build.
- Source-manifest authentication is shape-only; no Hugging Face or ModelScope network transfer was made in this batch.
- Model cleanup uses an isolated hardlink fixture rather than installed model directories or a physical external disk.
- Hot-switch and failover are controller/lease rehearsals, not live traffic or multi-machine evidence.
- Extension quarantine does not publish a package into an external community registry.
- Workflow access keys are local digest-backed records, not organization identity or an external vault.
- Artifact lifecycle is a fixture registry transition, and usage settlement uses a local external-receipt stand-in rather than a billing provider.
- OIDC/SCIM, real KMS/HSM, immutable object storage, regional failover, and organizational sign-off remain fail-closed external gates.
