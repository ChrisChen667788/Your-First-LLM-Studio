# Remaining Roadmap After Runtime Truth Closure

Date: 2026-08-10

## Current truth

- Source and active release truth: `1.5.1`.
- Latest public GitHub release: `v0.4.0`.
- Latest desktop candidate: `v1.1.0-rc.2`.
- Distribution: `HOLD`.
- Production: `BLOCKED`.
- Repository-owned acceptance through `v1.5.1` is locally complete. Internal evidence documents also describe later implementation slices through `v1.6.6`; neither local completion nor later internal slices are equivalent to a public or production promotion.

## Latest approved source train

`v3.6.0-v3.7.4` adds authenticated, revision-protected candidate receipt
intake, digest-only quarantine, compensation reconciliation, SLA breach and
acknowledgement state, bounded waiver expiry, and deterministic decision
packages. Repository source can execute and export these local contracts, but
all seven real owner receipts, detached signatures, immutable archive records,
and all 15 external assurance records remain outside local authority. See
[`v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md`](./v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md).

## Latest approved product plan

`v3.8.0-v3.9.4` is a 15-version **planned** competitive product train derived
from the 2026-08-31 official-source review. The order is: model/provider drift
and Agent conformance first; multi-agent/sandbox/runtime ergonomics second; RAG,
training federation and Team Studio third; competitive freshness enforcement
last. None of these planned cards changes the current source release or closes
Apple, identity, cloud, independent-operator, distribution, or production
gates. See [`docs/competitive-landscape.md`](./competitive-landscape.md).

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

The completed v1.6.7-v1.6.9 milestones and the remaining source-development
versions have explicit version numbers. They do not alter the current `1.5.1`
release truth. v1.7.0 is the active development slice.

1. `v1.6.7` Workflow Execution Closure: typed executors for retrieval, read-only tools, guards, evaluators, Provider context, and fail-closed protected effects.
2. `v1.6.8` Fine-tune Execution Truth: apply or reject scheduler, warmup, packing, target-module, checkpoint, and evaluator behavior at the selected backend.
3. `v1.6.9` Fine-tune Quality and Export: local adapter-bundle execution and a 3-seed/36-pair quality contract pass 15/15, but the quality decision remains HOLD and representative 4B evidence, merge/quantized executors, and remote Hub round trips are still required.
4. `v1.7.0` Benchmark Candidate and Multimodal: active. The source gate now rejects duplicate target/model candidate bindings and separates protocol fixtures from official asset and native image/video execution; a second full candidate run and official execution receipts remain required.
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
16. `v1.9.2` Local Workspace and Runtime Clarity: project-first local/remote provenance, cancel/resume lifecycle, and reproducible Apple Silicon performance evidence.
17. `v1.9.3` Transparent Agent Interaction: streaming tool cards, risk-tier approvals, branching/replay, cancellation/idempotency, and turn-level execution/cost truth.
18. `v1.10.0` Workflow Debug and Deployment Experience: node locator, checkpoint/replay, safe deploy revisions, rollback, and SSRF-aware connector policy.
19. `v1.10.1` Training and Governed Knowledge Operations: fine-tune backend/recipe lineage plus corpus revision, deletion proof, retrieval quality, and promotion review.
20. `v1.10.2` Runtime Recovery and Performance Evidence: project/runtime provenance, restart-safe cancellation and recovery, and same-profile Apple Silicon performance receipts.
21. `v1.10.3` Workspace Provenance and Operator Context: signed request identity, workspace/organization attribution, expiry, and cross-workspace denial.
22. `v1.10.4` Agent Action Trust and Recovery: streaming tool cards, risk-tier approval, idempotent retry/reconnect, cancellation, and safe replay.
23. `v1.10.5` Workflow Debugger Closure: log/error node locator, redacted node state, breakpoint/checkpoint, immutable replay, and controlled resume.
24. `v1.11.0` Artifact Federation Trust: immutable registry coordinates, publisher trust roots, remote read-back, revocation, dependency policy, and quarantine.
25. `v1.11.1` Model Supply Chain Operations: authenticated Hub transfer, verified transformation/placement, migration, repair, deduplication, and retirement lineage.
26. `v1.11.2` Continuous RAG Governance: corpus revisions, queue recovery, ACL/deletion propagation, golden-query diagnostics, leakage, and freshness SLOs.
27. `v1.11.3` Reproducible Training Recipes: backend/method preflight, recipe/checkpoint/model-card lineage, and cost/quality comparison.
28. `v1.11.4` Quality Policy and Safety Review: versioned quality policy, statistical/safety gates, calibrated review, expiring waivers, and rollback.
29. `v1.12.0` Enterprise Control Plane Candidate: reconciled deployment, identity, usage, audit, HA, security, and organization acceptance packet.
30. `v2.0.0` Enterprise Production GA: independent multi-region, identity, security, billing, and organization acceptance.
31. `v2.0.1` Production Evidence Authority: pinned-key validation of independently supplied production evidence, without repository-owned GA authorization.
32. `v2.0.2` Release Authority Decision Ledger: independently signed approval/rejection projection bound to verified evidence and rollback, without local deployment execution.
33. `v2.0.3` External Transition Witness: independently signed record of a production transition bound to the approved decision and execution checks.
34. `v2.0.4` Independent Rollback Witness: separately signed rollback rehearsal bound to the transition and measurable RPO/RTO evidence.
35. `v2.0.5` Release Closure Archive: independently signed terminal archive binding decision, transition, and rollback artifacts; closes the bounded v2.0.x source train.

## 2026-08-21 ten-round source-contract continuation

The `v1.7.1` through `v1.9.0` repository-owned source boundaries now have a single
read-only acceptance projection at `/api/experiments/v171-v190-source-train` and
an `/experiments` panel. The projection covers Enterprise Data Plane, promotion,
developer API, model supply chain, RAG governance, graph runtime, collaboration,
quality CI, observability/FinOps, and Desktop GA. It also extends OpenTelemetry
coverage to Benchmark plus Fine-tune evaluation/distillation execution paths.

This is deliberately not a release promotion. The projection labels every source
contract as present while retaining `HOLD` for unconfigured managed services,
trace delivery, public API load testing, real artifact transfer, organization
identity, Apple signing/notarization, and independent clean-machine acceptance.

## 2026-08-21 next-ten source-contract continuation

The next ten repository-owned versions, `v1.10.2` through `v1.12.0`, are now
defined as executable source contracts and projected at
`/api/experiments/v1102-v1200-source-train`. They connect the existing runtime,
workspace context, protected Agent recovery, typed Workflow execution, artifact
trust, Hub transfer, retrieval replay, Fine-tune capability, Quality CI, and
deployment/identity ports into one auditable release train.

This continuation completes repository-owned planning and source integration only.
Every version remains `HOLD` for external and production truth: controlled remote
registries, managed identity/data/telemetry/billing, actual Apple distribution,
independent security/HA validation, and organization sign-off cannot be supplied
by local source contracts. The task-level implementation plan is
[`docs/next-ten-release-train-2026-08-21.md`](./next-ten-release-train-2026-08-21.md).

## 2026-08-21 v2.0.0 production-GA reconciliation

`v2.0.0` now has a repository-owned reconciliation projection at
`/api/experiments/enterprise-production-ga` and an `/experiments` panel. It joins
the control-plane candidate, local release evidence integrity, release-security
preflight, external-production-readiness contract, and desktop external-acceptance
contract into one auditable snapshot. It is deliberately fail-closed: its
`productionStatus` is always `blocked` and its `externalStatus` is always `hold`.
Independent multi-region, identity/data, billing, security, distribution, and
organization receipts remain required for the release authority to make any GA
decision. See [`docs/v2.0.0-enterprise-production-ga-plan-2026-08-21.md`](./v2.0.0-enterprise-production-ga-plan-2026-08-21.md).

## 2026-08-22 v2.0.1 production evidence authority

`v2.0.1` adds the read-only verification boundary at
`/api/experiments/production-evidence-authority`. It accepts no UI-uploaded or
locally minted evidence: a configured release-authority bundle must have a detached
signature, an out-of-band pinned signer digest, a durable issuer, fresh and complete
independent receipt inventory, and at least two external attestor organizations.
Even a verified bundle remains `not-authorized` and production remains `blocked`;
the independent release authority owns semantic review and the real transition. See
[`docs/v2.0.1-production-evidence-authority-plan-2026-08-22.md`](./v2.0.1-production-evidence-authority-plan-2026-08-22.md).

## 2026-08-22 v2.0.2 release-authority decision ledger

`v2.0.2` adds `/api/experiments/release-authority-decision`, which reads only a
separately signed decision from the independent release authority. The decision must
use a distinct pinned trust anchor, bind the verified `v2.0.0` evidence-bundle digest,
name an independent durable issuer, remain fresh, and reference an immutable rollback
plan. Approved and rejected decisions are visible for operator review, but the local
studio stays `not-authorized` and `blocked`; no route can execute a deployment or
change production state. See
[`docs/v2.0.2-release-authority-decision-ledger-plan-2026-08-22.md`](./v2.0.2-release-authority-decision-ledger-plan-2026-08-22.md).

## 2026-08-22 v2.0.3–v2.0.5 production lifecycle closure

The rest of the bounded 2.0 series is implemented at
`/api/experiments/production-lifecycle-closure` and in `/experiments`. It validates
three separately signed, separately trust-pinned external artifacts: a transition
witness bound to an approved decision, an independent rollback witness bound to the
transition and immutable plan, and a closure archive binding the exact artifact chain.
All three issuers must be durable and independent from prior authorities. A fully
verified chain remains evidence only: the local studio remains `blocked` and cannot
deploy or change production state. This completes repository-owned `v2.0.x`; future
work begins at `v2.1.0`. See
[`docs/v2.0.3-v2.0.5-production-lifecycle-closure-plan-2026-08-22.md`](./v2.0.3-v2.0.5-production-lifecycle-closure-plan-2026-08-22.md).

## 2026-08-22 v2.1.0–v2.1.9 post-GA operations evidence train

The next ten versions are now source-complete at
`/api/experiments/post-ga-operations-train` with a dedicated `/experiments`
projection. They verify a continuous chain of externally supplied, pinned-key
records for operations continuity, SLOs, changes/incidents, data governance,
identity/access, supply chain, quality/safety drift, capacity/cost, disaster
recovery, and a distinct operations review. Each record is digest-bound to the
prior record; `v2.1.9` must bind the complete ordered chain.

This is not a post-GA production assertion. The API and evidence exporter are
read-only; all external truth remains `hold` and local production remains
`blocked`, even when all records verify. See
[`docs/v2.1.0-v2.1.9-post-ga-operations-plan-2026-08-22.md`](./v2.1.0-v2.1.9-post-ga-operations-plan-2026-08-22.md).

## 2026-08-28 v2.2.0-v2.3.4 assurance continuation

The following 15 source versions are now implemented as two strict, read-only
evidence chains. `v2.2.0-v2.2.9` covers continuous compliance and customer trust;
`v2.3.0-v2.3.4` covers evidence portability, trust-center publication,
continuous monitoring, independent remediation, and immutable closure. Both
APIs enforce exact schemas, SHA-256 lineage, detached RSA signatures, pinned
keys, freshness, semantic coverage, zero critical findings, and independent
final review.

This closes repository-owned verifier, API, UI, export, test, and roadmap work.
It does not close the named external controls. External status remains `hold`
and production remains `blocked`. See
[`docs/v2.2.0-v2.3.4-assurance-continuation-plan-2026-08-28.md`](./v2.2.0-v2.3.4-assurance-continuation-plan-2026-08-28.md).

## 2026-08-29 v2.4.0-v2.5.4 operational lifecycle

The next independently bounded 15-version train is source-complete. v2.4 adds
real module-owned operational signals and a signed AI operations evidence chain;
v2.5 adds deployment portability, sovereignty, customer-key, continuity/exit,
and independent closure contracts. The repository can complete implementation,
tests, API/UI projection, and exports only. Real managed workload, billing,
identity/data, customer KMS/HSM, independent destination, continuity/exit, and
customer/organization review remain external `HOLD` gates, with production
`BLOCKED`. See
[`docs/v2.4.0-v2.5.4-operational-lifecycle-plan-2026-08-29.md`](./v2.4.0-v2.5.4-operational-lifecycle-plan-2026-08-29.md).

## 2026-08-29 v2.6.0-v2.7.4 governed autonomy and interoperability

The next independently bounded 15-version train is source-complete. v2.6 joins
model selection, provider routing, grounded context, extension permissions,
protected actions, Workflow replay, Benchmark quality, adapter rollback, and
audit provenance into a governed-autonomy chain. v2.7 verifies
OpenAI-compatible clients, MCP extensions, portable models/artifacts, and
workspace/identity contracts. The repository owns read-only projections,
strict external-chain verification, APIs, UI, tests, exports, and docs. Real
traffic, independent model/security/quality review, remote MCP/OAuth,
cross-platform isolation, organization IdP/SCIM/database, independent import,
and ecosystem closure remain external `HOLD` gates; production remains
`BLOCKED`. See
[`docs/v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md`](./v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md).

## 2026-08-30 v3.0.0-v3.1.4 remediation control and service readiness

The user-approved next scope turns the seven visible owner gaps into an actual
remediation control plane instead of another disconnected status list. Every
signal has a responsible domain, priority, review window, dependencies,
acceptance checks, next actions, evidence fingerprint, and deterministic state.
The service-readiness train projects disclosure, support diagnostics,
upgrade/change continuity, transition ownership, and independent closure while
upstream remediation remains visible. Current projection: 5 pass, 8 attention,
0 unavailable, 2 external-only; external evidence 0/15; distribution HOLD;
production BLOCKED. See
[`docs/v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md`](./v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md).

## 2026-08-30 v2.8.0-v2.9.4 operational remediation and sustainability

This newly approved 15-version train is source-complete. v2.8 turns Provider,
Retrieval, model supply-chain, workspace audit, runtime, Agent, Workflow,
Benchmark, and Fine-tune evidence into a prioritized remediation chain. v2.9
adds telemetry/resource transparency, incident diagnostics, compatibility
sunset readiness, desktop upgrade/data lifecycle, and independent closure.
The repository owns exception-safe read models, strict external-chain
verification, thin APIs, UI, tests, export, route ownership, and docs. Real
managed services, representative workloads, organization identities, billing,
clean-machine upgrades, support drills, and independent reviews remain external
`HOLD` gates; production remains `BLOCKED`. See
[`docs/v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md`](./v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md).

## Architecture and maintenance closeout

1. Continue shrinking Agent chat/session/runtime composition and Admin runtime/history panels into feature-owned ports.
2. Remove compatibility Admin API wrappers only after the 2026-09-30 usage-evidence threshold is satisfied; archive gateway/access-log evidence first.
3. Keep the route ownership matrix and module contracts aligned with physical imports, not intended ownership.
4. Maintain cross-surface route smoke, Safari/browser stability, screenshot freshness, dependency audit, migration rehearsal, and release evidence as promotion gates.
5. Preserve explicit labels for local proof, configured adapters, remote execution, production acceptance, `HOLD`, and `BLOCKED` in every surface and README.

## 2026-08-30 v3.2.0-v3.3.4 remediation execution and operational acceptance

This approved 15-version train is source-complete. v3.2 projects the seven
owner remediation controls into deterministic, non-mutating execution plans
with idempotency, lease/fencing, rollback, evidence fingerprints, and external
acceptance. v3.3 projects SLO/quality policy, incident/change rehearsal, owner
sign-off, release decision, and independent operational acceptance. The
repository owns read-only plans, strict external-chain validation, thin APIs,
UI, tests, export, route ownership, and docs. Authorized provider traffic,
managed Retrieval, authenticated Hub transfer, trusted organization identity,
representative hardware, a distinct complete Benchmark candidate, real
telemetry export, organization sign-off, distribution authority, and immutable
independent retention remain external `HOLD` gates. Production remains
`BLOCKED`. See
[`docs/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md`](./v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md).
## 2026-08-30 v3.6.0-v3.7.4 owner receipt and exception lifecycle

The repository-owned work is implemented: authenticated append-only receipt
events, strict quarantine, optimistic concurrency, compensation binding, SLA
read-models, acknowledgement events, bounded waiver expiry, deterministic
decision packages, thin APIs, Experiments UI, tests, export, route ownership,
and documentation. Remaining work is external and cannot be completed by local
source changes alone: seven authorized workloads, detached signature and trust
anchor verification, immutable archive read-back, organization incident and
waiver reconciliation, distinct receipt and operating authorities, distribution
approval, and production authorization. See
[`docs/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md`](./v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md).
