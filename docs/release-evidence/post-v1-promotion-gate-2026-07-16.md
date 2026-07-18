# Post-v1 Promotion Gate Evidence / Post-v1 晋级证据

Date: 2026-07-16

Machine-readable snapshot: [`post-v1-promotion-gate-2026-07-16.json`](./post-v1-promotion-gate-2026-07-16.json)

## Result

- Ten roadmap milestones from `v1.1.0` through `v1.5.1` now use one typed runtime promotion contract.
- All ten satisfy the currently implemented local foundation, hardening, product-acceptance, and lifecycle checks.
- `v1.3.1` is complete. Six milestones are local-ready. Three remain externally blocked.
- Average release completion is 93%, while production-ready coverage remains 1/10.
- Local fixtures, loopback services, preview adapters, and rehearsal receipts do not count as Apple, organization identity, public registry, or cloud production proof.

## Version Status

| Version | Runtime status | Local checks | Remaining evidence |
| --- | --- | --- | --- |
| `v1.1.0` | Externally blocked | Desktop package, onboarding, lifecycle and rollback are locally evidenced. | Developer ID notarization and trusted clean-machine organization receipt. |
| `v1.1.1` | Local-ready | Acquisition, source manifests, resume, dedup, migration, removal, compatibility and Benchmark handoff. | Authenticated Hub multi-file transfer and physical external-disk receipt. |
| `v1.2.0` | Local-ready | Server registry, lifecycle, switching, access, logs, accounting and idle-unload policy. | Sustained traffic, authenticated LAN and long-running idle eviction. |
| `v1.2.1` | Local-ready | Shared runtime descriptor and operation contract plus live Ollama evidence. | Backend-owned llama.cpp, LocalAI, vLLM and SGLang conformance. |
| `v1.3.0` | Local-ready | Signed install, dependencies, grants, secret scopes, rollback and quarantine. | Real community package and OS-enforced sandbox acceptance. |
| `v1.3.1` | Complete | Versioned graph, worker, breakpoint, replay, state diff, Retrieval graph and deploy access. | Retain fresh regression evidence. |
| `v1.4.0` | Externally blocked | Postgres RLS, policy simulation, shared asset audit and four-eyes access review. | Trusted OIDC/SCIM identity and external secret scopes. |
| `v1.4.1` | Local-ready | MLX-LM worker plan, LLaMA-Factory preview plan, sweeps, calibrated judge and baseline promotion. | Production LLaMA-Factory plus Transformers/PEFT executors. |
| `v1.5.0` | Local-ready | Signed local package, provenance, round trip, install lifecycle, quality and billing linkage. | GitHub, ModelScope and Hugging Face staging publish/install receipts. |
| `v1.5.1` | Externally blocked | Local HA, fencing, durable usage, settlement and FinOps rehearsal. | Real workload identity, KMS/HSM, immutable archive, multi-node failover and organization sign-off. |

## New Contracts

- `experiments.post-v1-promotion-gate.v1` separates `localReady`, `productionReady`, local blockers and external blockers.
- `finetune.training-execution-plan.v1` emits canonical config plus argv without shell interpolation. Preview backends cannot execute.
- `artifacts.registry-adapters.v1` emits immutable staging and remote round-trip plans without returning secrets or mutating a remote registry.
- `experiments.release-evidence-matrix.v1` now scores post-v1 milestones from current runtime evidence instead of showing them as 0% planned work.

## 中文结论

- 十个版本现已统一使用可回归的晋级契约，不再沿用失真的 `planned/0%` 展示。
- 十个版本都完成当前本地实现检查，但只有 `v1.3.1` 达到完整 production-ready。
- `v1.1.0`、`v1.4.0`、`v1.5.1` 的 Apple、企业身份和真实云门槛继续保留。
- LLaMA-Factory 和远端 artifact registry 当前只生成安全计划，不会被 UI 或 API 误当成可执行生产能力。

## Verification

Run:

```bash
npm run typecheck:app
npm run rehearse:post-v1-hardening
npm run rehearse:post-v1-acceptance
npm run rehearse:post-v1-lifecycle
npm run smoke:routes
BASE_URL=http://localhost:3011 npm run screenshots:release -- --flow post-v1-promotion-gate
npm run validate:screenshots
npm run evidence:post-v1-promotion
```
