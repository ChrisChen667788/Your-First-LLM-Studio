# Remaining Roadmap After Runtime Truth Closure

Date: 2026-08-10

## Current truth

- Source and active release truth: `1.5.1`.
- Latest public GitHub release: `v0.4.0`.
- Latest desktop candidate: `v1.1.0-rc.2`.
- Distribution: `HOLD`.
- Production: `BLOCKED`.
- Repository-owned acceptance through `v1.5.1` is locally complete. Internal evidence documents also describe later implementation slices through `v1.6.6`; neither local completion nor later internal slices are equivalent to a public or production promotion.

## Remaining version gates

| Milestone | Remaining work |
| --- | --- |
| `v1.1.0` Desktop GA | Real Apple Developer ID signing, notarization/staple/Gatekeeper evidence, independent clean-machine install/upgrade/rollback/uninstall, and organization-signed acceptance. |
| `v1.1.1` Model Hub + DX | Refreshed authenticated ModelScope identity receipt, remote CI confirmation, and broader real multi-file transfer evidence across Hugging Face/ModelScope and external disks. |
| `v1.2.0` Local Server | Authenticated non-loopback LAN acceptance, sustained idle-unload daemon window, request-log retention under load, and production key rotation. |
| `v1.2.1` Runtime Fabric | Real LocalAI, Linux/NVIDIA vLLM and SGLang, heterogeneous remote worker nodes, model-level conformance, failover, cancellation, and resource accounting. |
| `v1.3.0` MCP/Extensions | Independently managed publisher trust root, Linux and Windows sandbox receipts, remote Streamable HTTP OAuth lifecycle, extension dependency isolation, and community package review. |
| `v1.3.1` Workflow | Authenticated non-loopback deploy-as-API evidence, durable production LangGraph checkpointer if shadow promotion is approved, distributed lease/recovery across separate workers, and protected-tool organization sign-off. |
| `v1.4.0` Governance | Local organization/workspace/group mapping, request identity, conflict, ACL/RLS, policy, and audit contracts pass. Remaining: real OIDC login/JWKS rotation, SCIM lifecycle, deployed PostgreSQL concurrency/backup/restore, externally retained audit, and organization acceptance. |
| `v1.4.1` Quality CI | A real attached adapter now has three paired batches, 36 samples, deterministic scoring, confidence intervals, and an exact artifact binding. Remaining: independent-worker repetition, official full-dataset/native multimodal runs, calibrated subjective judges/human labels, and organization CI promotion/rollback. |
| `v1.5.0` Artifact ecosystem | The real adapter package passes local checksum, provenance, immutable registry read-back, quality claim, install policy, and rollback contracts. Remaining: independent publisher trust and organization-controlled GitHub/ModelScope/Hugging Face/private-registry publication/read-back. |
| `v1.5.1` Production control plane | Local durable outbox, token reconciliation, retry-safe settlement, audit/signing rehearsal, primary fencing, standby promotion, and local RPO/RTO pass. Remaining: managed PostgreSQL/billing, multi-node and cross-region failover, traffic redirection, production OTLP/Langfuse, real KMS/HSM, immutable Object Lock, and organization sign-off. |
| `v1.6.4` Official evaluators | Pinned Math-Verify 0.9.0, durable per-sample resume, and a real local Qwen3 0.6B run pass 15/15 acceptance with 500/500 scored, 160 correct, zero runtime failures, and 32.00% local accuracy. MMMU, MathVista, MMBench, and Video-MME v2 protocol adapters are pinned and fixture-tested. Remaining: independent-worker repetition, complete official multimodal assets and compatible runtimes, MathVista judge extraction, MMBench external submission, licensed Video-MME v2 execution, paid native MiniMax M3 quality evidence, and external leaderboard reproduction. |
| `v1.6.5` Benchmark reproducibility | The complete run is bound to dataset/evaluator/run digests, seven subject and five difficulty scorecards, Wilson 95% confidence, latency/token/checkpoint/failure accounting, and a same-host isolated scorer replay with 500/500 decisions matching. Multimodal execution requirements are explicit. Remaining: independently managed worker/host repetition, official image/video assets, compatible paid/native execution, calibrated MathVista judge, MMBench submission receipt, licensed Video-MME v2 run, and external leaderboard reproduction. |
| `v1.6.6` Benchmark decision intelligence | The real 500-item run has complete error taxonomy, confidence-aware cohort risk, bounded review items, latency/token outliers, conservative power targets, and a fail-closed paired candidate policy using exact McNemar, paired delta confidence, non-inferiority, and latency limits. Remaining: a second distinct full candidate run, planned repetitions sufficient for 3pp/5pp effects, independently managed worker execution, approved promotion owner, and every external evaluator/production receipt carried from v1.6.5. |

## Cross-cutting product work

1. Deploy and accept the new Enterprise Retrieval port against real pgvector, a real embedding model, a real cross-encoder, and workspace/subject/group ACL fixtures. Add recall, rerank, citation, leakage, latency, and cost reports.
2. Configure an OTel Collector or Langfuse project, verify delivery and redaction, add dashboard/alert/retention/export-restore evidence, and link traces to Provider, Workflow, Retrieval, Benchmark, and Fine-tune artifacts.
3. Finish public `/v1` production controls: mandatory managed API keys, durable quota/rate accounting, streaming latency/load conformance, model ACLs, audit attribution, and compatibility sunset policy.
4. Productize Fine-tune inference operations: batch cancellation/progress, evaluation metric plugins, teacher cost estimate and approval, dataset dedup/factuality review, and real Hub publishing for Adapter Export.
5. Promote LangGraph only from shadow after recovery rate, duplicate side effects, latency, and cost meet a written gate; keep the existing reducer authoritative until then.
6. Reconcile version metadata across `VERSION`, `package.json`, `release-state.json`, docs, GitHub releases, ModelScope, screenshots, and evidence bundles before the next public promotion.

## Newly numbered source-development train

The completed v1.6.7 milestone and the fifteen source-development versions after
it now have explicit version numbers. They do not alter the current `1.5.1`
release truth. v1.6.8 is locally complete and v1.6.9 is the active development
slice.

1. `v1.6.7` Workflow Execution Closure: typed executors for retrieval, read-only tools, guards, evaluators, Provider context, and fail-closed protected effects.
2. `v1.6.8` Fine-tune Execution Truth: apply or reject scheduler, warmup, packing, target-module, checkpoint, and evaluator behavior at the selected backend.
3. `v1.6.9` Fine-tune Quality and Export: local adapter-bundle execution and a 3-seed/36-pair quality contract now pass 15/15, but the quality decision remains HOLD and representative 4B evidence, merge/quantized executors, and remote Hub round trips are still required.
4. `v1.7.0` Benchmark Candidate and Multimodal: a second full candidate run, paired promotion statistics, and official native image/video execution.
5. `v1.7.1` Enterprise Data Plane: deployed pgvector/reranker/ACL, shared telemetry, and managed public API identity, quota, and audit.
6. `v1.7.2` Release and Production Promotion: architecture sunset, channel consistency, external distribution, production HA/security, and organization sign-off.
7. `v1.7.3` Developer API Reliability: SDK parity, streaming cancellation, retry safety, backpressure, and request attribution.
8. `v1.7.4` Model Supply Chain: signed transfer, conversion, storage, compatibility, migration, repair, and promotion ledger.
9. `v1.7.5` RAG Governance and Quality: corpus revisions, connector lineage, deletion proof, leakage tests, and continuous evaluation.
10. `v1.8.0` Agent Runtime Graph: move turn, tool, retrieval, verification, and recovery lifecycles onto Workflow execution.
11. `v1.8.1` Collaborative Experiments: workspace revisions, review, approval, conflict, retention, restore, and lineage.
12. `v1.8.2` Quality CI and Safety: repository checks, calibrated judges, safety gates, waivers, and rollback.
13. `v1.8.3` Observability and FinOps: trace correlation, usage/cost allocation, SLOs, alerts, redaction, and retention.
14. `v1.9.0` Desktop Distribution GA: real signing/notarization and independent clean-machine acceptance.
15. `v1.9.1` Federated Artifact Exchange: remote registry federation, trust roots, revocation, and immutable read-back.
16. `v2.0.0` Enterprise Production GA: independent multi-region, identity, security, billing, and organization acceptance.

## Architecture and maintenance closeout

1. Continue shrinking Agent chat/session/runtime composition and Admin runtime/history panels into feature-owned ports.
2. Remove compatibility Admin API wrappers only after the 2026-09-30 usage-evidence threshold is satisfied; archive gateway/access-log evidence first.
3. Keep the route ownership matrix and module contracts aligned with physical imports, not intended ownership.
4. Maintain cross-surface route smoke, Safari/browser stability, screenshot freshness, dependency audit, migration rehearsal, and release evidence as promotion gates.
5. Preserve explicit labels for local proof, configured adapters, remote execution, production acceptance, `HOLD`, and `BLOCKED` in every surface and README.
