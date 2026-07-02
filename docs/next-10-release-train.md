# Next 10 Release Train

Last updated: 2026-07-02

This release train is the active product contract after `v0.4.2`. It is mirrored in code by:

- `features/experiments/release-train.ts`
- `app/api/experiments/release-train/route.ts`
- `features/experiments/ReleaseTrainPanel.tsx`

## Version Train

| Version | Track | Status | Target | Core outcome |
| --- | --- | --- | --- | --- |
| `v0.5.0` | Ops | Active | 2026-07 | Provider Health Desk v2, retry/timeout visibility, release evidence grouping, Adapter Export closure. |
| `v0.5.1` | Release | Planned | 2026-07 | Public docs route, demo capture automation, contributor flow, Distillation v1. |
| `v0.6.0` | Models | Planned | 2026-08 | Unified Model Hub for install, verify, runtime state, hardware fit, and local server controls. |
| `v0.6.1` | Models | Planned | 2026-08 | Durable Runtime Profile Registry, profile apply contract, Developer API panel, token and latency accounting. |
| `v0.7.0` | RAG | Planned | 2026-08 | Enterprise RAG Starter with vector adapter, hybrid recall, reranker, citations, ACL, and eval sets. |
| `v0.7.1` | RAG | Planned | 2026-09 | RAG-first playground with replay, citation inspection, permission preview, and benchmark handoff. |
| `v0.8.0` | Fine-tune | Planned | 2026-09 | Professional LoRA loop: durable recipe, eval, best checkpoint, chart markers, export, and adapter attach. |
| `v0.8.1` | Fine-tune | Planned | 2026-09 | Adapter lifecycle registry, merge/quantized export plans, attach rollback, and lineage evidence. |
| `v0.9.0` | Deployment | Planned | 2026-10 | Production control plane for registry, audit, quota, telemetry, KMS signing, and failover rehearsal. |
| `v1.0.0` | Release | Planned | 2026-10 | GA release with coherent Agent, Model Hub, RAG, Fine-tune, Benchmark, Compare, Ops, and evidence contracts. |

## Current Slice

The active version is `v0.5.0`.

Completed in this development slice:

- Added a typed release train contract and `/api/experiments/release-train`.
- Added a release train panel to `/experiments`.
- Promoted Model Hub runtime operations to `models.runtime-operations.v2`.
- Added runtime operation capabilities and Developer API guide fields.
- Added endpoint/key status, chat/models URLs, curl snippet, token accounting fields, and latency fields to the Model Hub runtime panel.
- Added Provider Health retry/timeout policy read-models with provider kind, suggested policy template, first-token timeout, total timeout, stream idle timeout, retry budget, and fallback profile.
- Added Provider Health policy cards to Admin and extended route smoke to guard the policy contract.
- Added `benchmark.release-evidence-summary.v1` so pinned benchmark evidence now groups stored runs, missing runs, target coverage, failed/skipped samples, success rate, and release-note draft lines.
- Surfaced the benchmark release-note summary in both `/benchmarks` and Admin, and added route smoke coverage for `/api/admin/benchmark/evidence`.
- Extended route smoke to guard both the release train API and runtime operations v2 contract.

Next implementation slice:

- Extend release evidence grouping to fine-tune adapter exports and Provider Ops evidence sources.
- Move Model Hub runtime server controls from the side panel into the primary model cards.
- Start Provider Ops evidence grouping and promotion-gate source rollups.

## 中文说明

这份版本列车是 `v0.4.2` 之后的主线契约，并已同步到代码：

- `features/experiments/release-train.ts`
- `app/api/experiments/release-train/route.ts`
- `features/experiments/ReleaseTrainPanel.tsx`

当前进行中的版本是 `v0.5.0`，重点是 Provider 运维、发布证据、Adapter Export 与 Model Hub runtime ops。后续版本继续沿 Model Hub、企业 RAG、专业 LoRA、部署控制面和 GA 发布证据推进。
