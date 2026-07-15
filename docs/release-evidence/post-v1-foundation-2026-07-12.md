# Post-v1 Ten-Slice Foundation Evidence

Date: 2026-07-12

## Scope

This batch advances one bounded, testable foundation slice for each planned version from `v1.1.0` through `v1.5.1`:

1. Desktop first-run readiness diagnostics.
2. Durable, idempotent model acquisition jobs with pause/resume/cancel state.
3. Local server-instance registry with fail-closed LAN authentication.
4. Runtime adapter capability and conformance registry.
5. Extension manifest, permission, signature, and trust policy.
6. Typed protected-tool workflow graph with side-effect resume validation.
7. Organization/workspace identity and access-decision preview.
8. Training backend/model/method/quantization/scheduler compatibility.
9. Unified artifact package manifest and integrity policy.
10. HA/FinOps readiness derived from durable usage, audit, signing, failover, and cloud blockers.

## Honest Status

`experiments.post-v1-foundation.v1` currently reports:

- 10 foundation rounds.
- 3 `foundation-ready`.
- 6 `partial`.
- 1 `blocked` (`v1.5.1`, because real cloud production evidence is absent).
- 14% average foundation completion.

These percentages describe only the first service/contract slice. They do not promote any planned release to complete.

## Verification

- `npm run typecheck:app`: pass.
- `npm run typecheck:admin`: pass after adding product API routes to the partition.
- `npm run smoke:routes`: pass on the complete rerun, including all ten new contracts.
- In-app browser `/experiments` check: panel rendered all ten rounds with no console errors or overlapping cards.
- Initial smoke run: 51/52 because the existing `/api/finetune` cold read exceeded 20 seconds.
- Immediate `/api/finetune` retry: pass in 0.06 seconds.
- Full smoke rerun after warmup: pass.

## Remaining Evidence

- Signed desktop application and upgrade/rollback rehearsal.
- Real transfer workers, resumable byte ranges, checksums, and external-disk migration.
- Live server daemon actions and Ollama conformance.
- Community extension signature verification and quarantine.
- Workflow execution/editor and persisted breakpoints.
- Database-level tenant isolation, OIDC/SCIM, and external secrets.
- LLaMA-Factory/PEFT runtime adapters and evaluation CI.
- Signed artifact registry round trips.
- Real workload identity, KMS/HSM, immutable archive, billing reconciliation, and multi-node failover evidence.
