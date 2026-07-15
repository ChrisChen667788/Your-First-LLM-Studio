# Post-v1 Product Acceptance: Second 15-Slice Evidence

Date: 2026-07-14
Scope: local, non-cloud product acceptance across `v1.1.0` through `v1.5.1`
Aggregate result: **15 ready / 0 partial / 0 blocked**, 90% average slice completion

This batch builds on the first post-v1 hardening rehearsal. It proves local contracts, state transitions, denial paths, and cross-module evidence links. It does not promote the complete post-v1 versions or replace clean-machine, physical external-disk, real remote-node, organization identity, Apple notarization, or cloud production evidence.

## Acceptance Results

| Version | Slice | Result |
| --- | --- | --- |
| `v1.1.0` | Data migration and uninstall policy | Atomic migration, digest preservation, preserve-on-uninstall, explicit purge, and backup restore passed in an isolated fixture. |
| `v1.1.1` | External-storage atomic migration | 2 files / 4,116 bytes passed staged copy, per-tree digest, atomic destination rename, ownership manifest, and post-verification source removal. Real model paths remain plan-only. |
| `v1.1.1` | Model compatibility manifest | `qwen3:0.6b` passed GGUF/Ollama format, license, tokenizer, chat-template, 4-bit, and local memory-budget checks. |
| `v1.1.1` | Install-to-Benchmark handoff | A `milestone-formal` request for `local-qwen3-0.6b` was emitted only after linking the passing compatibility receipt. |
| `v1.2.0` | Caller-key attribution | Valid/wrong/revoked key paths, digest-only persistence, and request-ledger `callerKeyId` attribution all passed. |
| `v1.2.0` | LAN/CORS/auth/rate policy | 5 allow/deny scenarios matched expected host, origin, key, and rate-limit decisions. |
| `v1.2.1` | Backend-neutral operation port | MLX and Ollama implemented actions plus preview llama.cpp, LocalAI, vLLM, and SGLang actions all produced normalized success or actionable `operation_unsupported` results. Preview contracts are not executable-backend evidence. |
| `v1.2.1` | Remote-node capability routing | A loopback rehearsal node matched backend, memory, state, and residency policy. This is routing-contract evidence, not a real remote-machine deployment. |
| `v1.3.0` | Extension update/disable/enable | Signed `1.1.0 -> 1.2.0` update, disable, and re-enable transitions produced durable receipts. |
| `v1.3.0` | Extension secret scope | 5 exact-scope/confirmation/name/operation/extension decisions passed; no secret values were written to evidence. |
| `v1.3.1` | Workflow state diff and breakpoint replay | Fork-time events and idempotency keys were both 0; the replay then paused at a real persisted breakpoint while source state remained completed. |
| `v1.3.1` | Retrieval workflow deployment | The versioned `retrieval-grounded-answer` graph was published under a deployment slug and completed 5 replay-safe worker steps. |
| `v1.4.0` | Shared asset ACL and immutable audit export | Owner read passed, cross-workspace read was denied, and 4 asset events passed hash-chain and export-digest verification. |
| `v1.4.1` | Sweep, early stop, and judge calibration | 4 trials respected a 24 GB / 45 minute budget, selected `lr-2e-5-r16`, stopped the over-budget trial, and passed judge agreement at 0.90 versus a 0.80 threshold. |
| `v1.5.0-v1.5.1` | Artifact quality and billing linkage | A round-trip registry package linked 2 passing regression metrics to 13 request records / 611 tokens with zero reconciliation difference and a materialized claim digest. |

## Reproduction

```bash
npm run dev
npm run rehearse:post-v1-acceptance
npm run typecheck:changed
npm run smoke:routes
```

Machine-readable report:

`~/Library/Application Support/local-agent-lab/observability/post-v1-acceptance-rehearsal.json`

The acceptance rehearsal invokes `rehearse:post-v1-hardening` first so registry, regression, usage, runtime, and workflow prerequisites are real passing receipts rather than synthetic flags.

## Verification

- `npm run rehearse:post-v1-acceptance`: 15/15 ready, 90% average local acceptance completion.
- `npm run smoke:routes`: 96/96 passed after adding 15 read-only contracts to the previous 81-check baseline.
- `npm run typecheck:changed`: all 11 changed TypeScript partitions passed, including strict `admin`, `agent-api`, `agent-ui`, and aggregate `app` checks.

## Boundaries Still Open

- Desktop evidence still needs Developer ID/notarization and a clean-machine install/uninstall run.
- External-storage evidence still needs a physical external volume disconnect/reconnect and recovery rehearsal.
- llama.cpp, LocalAI, vLLM, and SGLang remain preview contracts until real endpoints pass conformance.
- The remote-node receipt uses loopback and does not count as multi-machine routing evidence.
- OIDC/SCIM, real secret vault, cloud KMS/HSM, immutable object storage, and regional failover remain fail-closed external gates.
