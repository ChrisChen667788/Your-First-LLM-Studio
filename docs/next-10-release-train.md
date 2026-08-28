# Release Train and Post-v1 Product Roadmap

## 2026-08-28 v2.2.0-v2.3.4 assurance continuation

The next 15 source slices are implemented as two read-only, fail-closed chains.
`v2.2.0-v2.2.9` covers compliance scope, privacy, model risk, third parties,
regulatory mapping, customer transparency, accessibility/responsible UX,
resource efficiency, remediation, and an independent compliance review.
`v2.3.0-v2.3.4` covers evidence portability, trust-center publication,
continuous assurance automation, independent audit remediation, and an
immutable closure archive. The shared verifier enforces strict schemas,
SHA-256 digests, detached RSA signatures, pinned keys, freshness, exact
predecessor lineage, semantic coverage, and independent final review. Source is
`PASS`; absent external records remain `HOLD`, and production remains
`BLOCKED`. Plan: [`v2.2.0-v2.3.4-assurance-continuation-plan-2026-08-28.md`](./v2.2.0-v2.3.4-assurance-continuation-plan-2026-08-28.md).
Evidence: [`release-evidence/v2.2.0-v2.3.4-assurance-source-gate-2026-08-28.md`](./release-evidence/v2.2.0-v2.3.4-assurance-source-gate-2026-08-28.md).

## 2026-08-22 v2.1.0–v2.1.9 post-GA operations train

The current ten-version continuation is the read-only post-GA operations evidence
train, not an automatic production-promotion plan. Its source contracts are
implemented at `/api/experiments/post-ga-operations-train`: a pinned external
continuity → SLO → change/incident → data → identity → supply chain → quality →
capacity/cost → disaster-recovery → independent-review chain. The exact task
breakdown, schema, configuration, and external boundaries are in
[`v2.1.0-v2.1.9-post-ga-operations-plan-2026-08-22.md`](./v2.1.0-v2.1.9-post-ga-operations-plan-2026-08-22.md).
All ten are source-complete, while external evidence remains `HOLD` and local
production remains `BLOCKED`.

## 2026-08-13 v1.6.6 benchmark decision-intelligence batch

The next 15 repository-owned slices convert the completed MATH-500 run into a release-decision contract. All 500 samples receive one mutually exclusive error class; the real run contains 160 correct answers and 340 extracted-but-mathematically-incorrect answers, with no extraction, runtime, or evaluator gaps. Confidence-aware cohort policy identifies Intermediate Algebra, Precalculus, and Level 5 as critical. The read model adds p95 latency/token outlier accounting, a bounded 24-item review queue, conservative 95%/80% power planning, manual baseline/candidate selection, paired delta confidence, exact McNemar significance, and explicit -2pp non-inferiority plus +20% p95-latency limits. Local contract acceptance can pass while candidate promotion remains `EVIDENCE NEEDED`: duplicate snapshots from the same run id are deduplicated, and only a second distinct complete 500-item run may enter the paired gate. Independent-host, official multimodal, leaderboard, organization, distribution, and production gates remain `HOLD`. Evidence: [`docs/release-evidence/v1.6.6-benchmark-decision-intelligence-2026-08-13.md`](./release-evidence/v1.6.6-benchmark-decision-intelligence-2026-08-13.md).

## 2026-08-10 v1.6.5 benchmark reproducibility batch

The completed MATH-500 run now has immutable dataset/evaluator/run fingerprints, seven subject and five difficulty scorecards, Wilson 95% confidence, latency/token/checkpoint accounting, and a zero-count runtime/evaluator/manual-review failure taxonomy. A fresh isolated Math-Verify worker replayed all 500 stored predictions in under four seconds with 500/500 decisions matching and no unavailable samples. Fifteen local checks pass. The multimodal readiness plan names verified targets, required assets, judge/submission modes, licensed media, and fail-closed blockers for MMMU, MathVista, MMBench, and Video-MME v2. Same-host replay is not independent-host reproduction; official multimodal execution and production remain `HOLD`. Evidence: [`docs/release-evidence/v1.6.5-benchmark-reproducibility-2026-08-10.md`](./release-evidence/v1.6.5-benchmark-reproducibility-2026-08-10.md).

## 2026-08-10 v1.6.4 official evaluator and full-run batch

The qualified MATH-500 asset now has a real scoring and execution chain. Math-Verify `0.9.0` is isolated and pinned to revision `ba3d3aaff23b3f4cac7a14672b4f6e293d97c98b`; per-sample durable checkpoints, unavailable-sample re-evaluation, a timeout-safe detached runner, and domain-validated progress recovery make the 500-item path resumable. Real run `math500-full-20260810112454-2b58c961` on `local-qwen3-0.6b` completed 500/500 with 500 scored, 160 correct, zero runtime failures, 497 checkpoint resumes, and 32.00% local accuracy. The combined read model passes 15/15 local slices. MMMU, MathVista, MMBench, and Video-MME v2 protocol adapters are revision-pinned and fixture-tested; full licensed assets, judge-backed extraction, compatible vision/video runtimes, external submission, and independent reproduction remain `HOLD`. Evidence: [`docs/release-evidence/v1.6.4-official-evaluators-2026-08-10.md`](./release-evidence/v1.6.4-official-evaluators-2026-08-10.md).

## 2026-08-10 v1.6.3 official benchmark qualification batch

One real official benchmark asset passes a 15-slice provenance and reproducibility gate. `HuggingFaceH4/MATH-500` is pinned to full commit `6e4ed1a2a79af7d8630a6b768ec859cb5af4d3be`; its 446,564-byte test JSONL payload is persisted with SHA-256 `35dc41080a3680858b27fa7e0533d2d547825316fc5dafe5d316f4ccc5a06132`, and all 500 rows, unique identifiers, seven subjects, five levels, prompt digest, sample manifest, and durable read-back pass. Benchmark Studio exposes the verified snapshot as `math-500-qualified`. This historical batch held official scoring until the mathematical-equivalence evaluator was integrated; the local evaluator/full-run gate is closed by v1.6.4. Evidence: [`docs/release-evidence/v1.6.3-benchmark-qualification-2026-08-10.md`](./release-evidence/v1.6.3-benchmark-qualification-2026-08-10.md).

## 2026-08-10 v1.5.1 local completion

The active source milestone is `v1.5.1`. The repository now retains a real release-candidate receipt for an attached adapter: exact checkpoint and base revision, immutable local package read-back, three paired Benchmark batches with 36 samples, deterministic Quality CI, a reproducible artifact quality claim, durable token/usage reconciliation, retry-safe settlement, local audit/signing, old-primary fencing, standby promotion, and measured local RPO/RTO. All repository-owned v1.4.0 through v1.5.1 local acceptance contracts are closed. Distribution remains `HOLD` and production remains `BLOCKED`; independent-worker repetition, real OIDC/SCIM and deployed PostgreSQL, organization-controlled remote registry, managed billing/cross-region failover, cloud KMS/Object Lock, and organization sign-off are still external gates. Evidence: [`docs/release-evidence/v1.5.1-local-completion-2026-08-10.md`](./release-evidence/v1.5.1-local-completion-2026-08-10.md).

## 2026-08-10 runtime-truth closure

The repository-owned runtime gaps are now closed without promoting absent infrastructure: DeepSeek probes the account catalog and routes `deepseek-v4-pro` with `deepseek-v4-flash` fallback; public `/v1/chat/completions` delegates to the real provider/runtime port; Fine-tune evaluation, adapter chat, and distillation execute actual adapter/teacher inference; Workflow model nodes use the same provider port; a real LangGraph interrupt/checkpoint/resume shadow receipt proves protected-tool idempotency; strict enterprise Retrieval now exposes pgvector, embedding, cross-encoder, citation, and ACL boundaries; and shared batched OTLP/Langfuse telemetry wraps the main inference paths. The verified local/API evidence is recorded in [`docs/release-evidence/v1.3.1-runtime-truth-closure-2026-08-10.md`](./release-evidence/v1.3.1-runtime-truth-closure-2026-08-10.md). The active source has since advanced to `1.5.1`; distribution remains `HOLD`, and production remains `BLOCKED` until real OIDC/SCIM, deployed PostgreSQL RLS/RAG, external telemetry acceptance, cloud KMS/Object Lock, and independent organization evidence exist. The reconciled remaining train is maintained in [`docs/remaining-roadmap-2026-08-10.md`](./remaining-roadmap-2026-08-10.md).

## 2026-08-07 v1.6.2 benchmark standards and native multimodal batch

Benchmark Studio now separates lightweight built-in compatibility checks from internationally recognized benchmark protocols. A feature-owned registry tracks 11 official sources, evaluator rules, modalities, pinned upstream revisions, six-hour automatic refresh, manual refresh, proxy-aware Hugging Face checks, GitHub Atom fallback, and stale-revision retention. Custom prompt runs can carry native image or video assets; MiniMax M3 is verified for text/image/video against its official OpenAI-compatible contract, while local text runtimes and unverified remote model ids fail closed with an official documentation link. Unsupported targets produce zero-latency skipped samples without local prewarm, mixed target batches continue, and all-skip batches complete with an explicit warning instead of appearing crashed. Local evidence passes 37 tests, the affected TypeScript partitions, 35/35 cross-surface routes, 11/11 upstream revision checks, and a 2x DPR visual smoke. Official full-dataset adapters, paid native M3 output-quality evidence, and all external production gates remain `HOLD`. Evidence: [`docs/release-evidence/v1.6.2-benchmark-standards-2026-08-07.md`](./release-evidence/v1.6.2-benchmark-standards-2026-08-07.md).

## 2026-08-06 v1.6.1 application contract closure batch

The next 15 local slices remove the remaining product dependence on historical Admin and Agent API namespaces. Benchmark baseline, progress/control, prompt sets, reports, pinned release evidence, and exports now have canonical `/api/benchmarks/*` routes backed by feature applications; Benchmark Studio and runner-generated evidence URIs use those routes. Compare recipe persistence now uses `/api/compare/recipes`, while the historical `/api/agent/recipes` route is a thin re-export. Seven legacy routes remain callable for compatibility but contain no validation, persistence, or response-assembly logic. The durable `experiments.v161-application-contracts.v1` gate passes 15/15; the full test suite passes 29/29, all 11 changed TypeScript partitions pass, source hygiene covers 763 files, and route smoke passes 149/149. Production remains `HOLD` for external identity, remote worker failover, cloud signing/archive, and organization acceptance. Evidence: [`docs/release-evidence/v1.6.1-application-contracts-2026-08-06.md`](./release-evidence/v1.6.1-application-contracts-2026-08-06.md).

## 2026-08-05 v1.6 foreground feature ownership batch

The next 15 local slices close a long-running ownership gap without weakening the production gate. Fine-tune now owns its route shell, composition panel, and setup/run/evidence composers physically under `features/finetune`; Fine-tune, Compare, and the Benchmark Studio use the canonical `/api/benchmarks` run route; Compare progress uses `/api/compare/progress`, while the historical Agent path is a three-line compatibility re-export. The foreground Compare route no longer creates `AgentWorkbenchMode` state. A durable `experiments.v16-feature-ownership.v1` contract guards all 15 boundaries and is surfaced in `/experiments`. Local acceptance passes 15/15, the full test suite passes 28/28, all 11 changed TypeScript partitions pass, and route smoke passes 141/141. A legacy Agent session snapshot was also recovered through an explicit `0.2.1` to `0.3.0` migration instead of being discarded as corrupt. Cloud KMS/archive, external IdP/SCIM, separate worker failover, and organization sign-off remain `HOLD`. Evidence: [`docs/release-evidence/v1.6-feature-ownership-2026-08-05.md`](./release-evidence/v1.6-feature-ownership-2026-08-05.md).

## 2026-08-02 v1.5 trusted artifact and durable accounting batch

The v1.5 continuation now has one executable 15-slice local acceptance contract. Fourteen v1.5.0 checks cover canonical package digests, traversal-safe payloads, publisher trust rotation and revocation, dependency policy, Studio compatibility, license/SBOM/security policy, isolated atomic install, immutable registry query, signed staging read-back, and a quality claim that fails closed while real paired artifacts are missing. The v1.5.1 slice exercises a real PostgreSQL usage outbox with idempotent enqueue, exclusive claims, retry retention, fencing, delivery acknowledgement, and preserved token accounting. Local acceptance passes 15/15; production remains `HOLD` for provider-owned staging receipts, real paired adapter quality evidence, managed PostgreSQL and billing delivery, cloud KMS/archive, regional failover, and organization sign-off. Evidence: [`docs/release-evidence/v1.5-local-acceptance-2026-08-02.md`](./release-evidence/v1.5-local-acceptance-2026-08-02.md).

## 2026-08-01 v1.4 fifteen-slice acceptance batch

The next 15 implementation slices are now executable as one local promotion contract rather than separate roadmap promises. Five Governance checks cover pinned OIDC issuers, overlap-safe JWKS rotation, signed identity delivery, replay denial, and SCIM deprovision plus immutable audit. Five Workflow checks cover exclusive leases, expired-lease recovery, stale-worker fencing, heartbeat extension, and complete recovery receipts; the production worker now carries monotonic fence tokens and exposes a heartbeat action. Five Evaluation checks cover frozen artifact manifests, three-seed paired samples, a 95% confidence lower bound, judge calibration, and a reproducible decision digest. The isolated evidence run passes 15/15, the refreshed Postgres 16 RLS rehearsal passes 7/7, Workflow Studio passes 16/16, and the post-v1 gate reports `v1.3.1`, `v1.4.0`, and `v1.4.1` locally ready but externally blocked. Real IdP/SCIM, separate worker nodes, remote lease storage, frozen release-candidate quality data, and organization sign-off remain `HOLD`. Evidence: [`docs/release-evidence/v1.4-fifteen-slice-acceptance-2026-08-01.md`](./release-evidence/v1.4-fifteen-slice-acceptance-2026-08-01.md).

## 2026-08-01 local gate reliability closure

The local promotion path now fails safely under the repository's cloud-backed filesystem constraints. Changed-file typecheck discovery has a bounded Git timeout and selects every partition when discovery cannot finish, source hygiene covers the feature-owned code tree and reports unreadable source files with a bounded read timeout, and the real Runtime Fabric runner records every acceptance attempt while retrying only backend failures explicitly marked retryable. The refreshed local run passes all 11 TypeScript partitions, source hygiene for 705 files, 19/19 tests, 22/22 cross-surface CI route checks, architecture and durable-state validation, zero production dependency vulnerabilities, and real MLX/Ollama/llama.cpp acceptance with 3/3 backends and 42/42 normalized operation checks. Production Runtime Fabric remains `HOLD` for LocalAI, Linux/NVIDIA vLLM and SGLang, and separate-node failover receipts. Evidence: [`docs/release-evidence/v1.3.1-local-gate-reliability-2026-08-01.md`](./release-evidence/v1.3.1-local-gate-reliability-2026-08-01.md).

## 2026-07-26 trust and mutable-state closure

The remaining repository-closable adversarial findings are now handled as release gates rather than prose promises. Production dependencies re-audit at zero known vulnerabilities; high-risk Fine-tune, Agent, Model Hub, deployment, extension, governance, runtime and evaluation JSON state uses shared locked atomic adapters with backup recovery, corruption quarantine and schema validation; CI rejects unclassified read-modify-write JSON state; all tracked UI shells meet the 1,200-line ownership target; and the three oversized Agent API routes remain seven-line wrappers. LoRA workflow evidence remains `PASS` while task-quality promotion remains an explicit `HOLD` until frozen-baseline, blind-eval and multi-seed evidence exists. External Apple, clean-machine, non-loopback, distributed-worker, real IdP/SCIM, deployed-Postgres and cloud gates remain blocked rather than being represented by local fixtures. Evidence: [`docs/release-evidence/v1.3.1-hard-issue-closure-2026-07-26.md`](./release-evidence/v1.3.1-hard-issue-closure-2026-07-26.md).

## 2026-07-23 v1.4.0 workspace governance foundation

The v1.4 implementation slice now has a signed workspace request context, SQL-bound organization/workspace/membership authorization, immutable SQLite and Postgres audit records, explicit SCIM group-to-workspace role mapping, OIDC subject/group resolution, and revision-checked multi-user writes. Local identity mapping and stale-write conflict rehearsals pass 10/10, while the real Postgres 16 RLS rehearsal remains 7/7. Agent, Admin, Fine-tune, and the three oversized Agent API routes all meet their architecture targets with zero remaining debt. Real IdP/SCIM lifecycle, deployed-Postgres concurrent acceptance, and external immutable archive evidence remain `HOLD`. Evidence: [`docs/release-evidence/v1.4.0-workspace-governance-foundation-2026-07-23.md`](./release-evidence/v1.4.0-workspace-governance-foundation-2026-07-23.md).

## 2026-07-23 v1.3.1 trust and durability hardening

The adversarial audit now has an executable P0 response: one release-truth manifest, zero audited dependency vulnerabilities, conventional contract tests, durable Workflow stores with lock/backup/quarantine recovery, strict deployment-key invocation, standard OpenAI-compatible sync/SSE responses, portable LoRA evidence with an explicit quality `HOLD`, expanded route smoke, and no-growth architecture budgets for the remaining oversized shells and routes. External Apple, clean-machine, distributed-worker, multi-user and cross-platform evidence remains blocked. Evidence: [`docs/release-evidence/v1.3.1-trust-durability-hardening-2026-07-23.md`](./release-evidence/v1.3.1-trust-durability-hardening-2026-07-23.md).

## 2026-07-23 v1.3.1 visual Workflow Studio

`/workflows` now provides route-owned typed graph authoring instead of a read-only node grid: draggable persisted layout, node/transition mutation, guard and approval policies, runtime-profile and immutable-artifact pins, strict reachability and side-effect validation, optimistic draft revisions, immutable publish, breakpoints, safe-worker execution, replay/state diff, version diff, and generated OpenAI-compatible deployment examples. A repeatable local acceptance runner verifies graph publication, stale-write rejection, approval boundaries, duplicate side-effect suppression, replay isolation, deployment-version authorization, and the API contract. Local acceptance passes 16/16 with a stable report digest; production remains blocked on authenticated non-loopback invocation, distributed worker restart/failover, and multi-user conflict evidence. Evidence: [`docs/release-evidence/v1.3.1-workflow-studio-acceptance-2026-07-23.md`](./release-evidence/v1.3.1-workflow-studio-acceptance-2026-07-23.md).

## 2026-07-18 v1.2.0 real Local Server acceptance

The live Ollama `0.31.1` runtime and installed `qwen3:0.6b` now pass 15/15 local acceptance slices covering process health, discovery, registration, prewarm, residency, OpenAI-compatible non-stream and SSE chat, bounded concurrency, request accounting, caller-key attribution, LAN policy, log retention, drain/rollback policy, idle-eviction dry-run, and unload/reload recovery. The official `reasoning_effort: none` field reduced completion tokens from 143 to 24 and average recorded latency from 546 ms to 179 ms. Local promotion is PASS; production remains HOLD for separate-device authenticated LAN and a sustained daemon window. Evidence: [`docs/release-evidence/v1.2.0-local-server-acceptance-2026-07-18.md`](./release-evidence/v1.2.0-local-server-acceptance-2026-07-18.md).

## 2026-07-16 ten-version local productization gate

The `v1.1.0` through `v1.5.1` roadmap is now scored from one runtime contract instead of ten stale planned cards. All ten milestones satisfy their current local foundation, hardening, product-acceptance, and lifecycle checks; `v1.3.1` is complete, six milestones are local-ready with external evidence still required, and `v1.1.0`, `v1.4.0`, and `v1.5.1` remain explicitly externally blocked. This batch also adds a worker-ready MLX-LM training plan, a fail-closed LLaMA-Factory preview plan, and non-mutating staging plans for GitHub Releases, ModelScope, Hugging Face, and private OCI registries. Local readiness is not a shipped production release. Evidence: [`docs/release-evidence/post-v1-promotion-gate-2026-07-16.md`](./release-evidence/post-v1-promotion-gate-2026-07-16.md).

## 2026-07-16 third post-v1 operational lifecycle batch

The next 15 local acceptance slices are now executable as explicit lifecycle state machines: desktop service recovery and permission repair; authenticated model source manifests, bounded transfer scheduling, and ownership-safe removal; drain-aware server switching, redacted log retention, and remote heartbeat fencing; reversible extension grants and quarantine review; version-pinned workflow deployment access; four-eyes governance review; reproducible evaluation baseline promotion; artifact install rollback; and retry-safe usage settlement. `/experiments` reports 15 ready, 0 partial, and 0 blocked at 92% average local completion. Real launchd, hub network transfers, live traffic, multi-machine failover, public registry, external billing, and cloud/identity gates remain planned or fail-closed. Evidence: [`docs/release-evidence/post-v1-operational-lifecycle-15-slice-2026-07-16.md`](./release-evidence/post-v1-operational-lifecycle-15-slice-2026-07-16.md).

## 2026-07-14 second post-v1 product acceptance batch

The next 15 local acceptance slices are now executable and cross-linked: desktop data lifecycle, external-storage migration, model compatibility and Benchmark handoff, caller-key attribution, LAN/CORS/rate policy, backend-neutral runtime actions, remote-node capability routing, reversible extension updates and secret scope, workflow state diff plus Retrieval deployment, shared-asset ACL/audit, budgeted sweep calibration, and evidence-backed artifact quality/billing linkage. `/experiments` reports 15 ready, 0 partial, and 0 blocked at 90% average local acceptance completion. Complete post-v1 releases and all external production gates remain planned or fail-closed. Evidence: [`docs/release-evidence/post-v1-product-acceptance-15-slice-2026-07-14.md`](./release-evidence/post-v1-product-acceptance-15-slice-2026-07-14.md).

## 2026-07-14 post-v1 executable hardening batch

The next 15 local acceptance slices now have repeatable runtime evidence: desktop update/rollback, model dedup planning and isolated hardlink rehearsal, Hub transfer reconciliation, Ollama lifecycle and fleet conformance, idle-unload decisions, signed extension install/rollback, leased workflow execution and side-effect-safe replay, RBAC simulation, multi-metric evaluation gates, artifact registry round-trip, and request-ledger usage reconciliation. `/experiments` reports 15 ready, 0 partial, and 0 blocked at 91% average slice completion. This does not mark the full post-v1 releases as shipped or satisfy Apple/cloud/organization production gates. Evidence: [`docs/release-evidence/post-v1-hardening-15-slice-2026-07-14.md`](./release-evidence/post-v1-hardening-15-slice-2026-07-14.md).

## 2026-07-14 post-v1 15-slice closure batch

The current continuation turns the planned desktop, hub, runtime, extension, workflow, governance, evaluation, and package foundations into 15 independently evidenced slices. It adds bounded Hub retry state, a non-destructive content-address index, Local Server safety and request accounting, live Ollama OpenAI-compatible conformance, dependency-first extension install plans, permission sandbox policy, immutable workflow versions and deploy ingress, OIDC/JWKS verification, SCIM lifecycle routes, transaction-local Postgres RLS context, paired confidence gates, and signed artifact provenance. The aggregate projection is 12 ready, 0 partial, and 3 externally blocked at 84% average completion. Evidence: [`docs/release-evidence/post-v1-15-slice-2026-07-14.md`](./release-evidence/post-v1-15-slice-2026-07-14.md).

## 2026-07-12 competitive landscape checkpoint

The roadmap now incorporates a first-party documentation review of LM Studio, Ollama, Open WebUI, Jan, AnythingLLM, LLaMA-Factory, and LocalAI. The existing v0.5-v1.0 evidence train is preserved unchanged, while ten post-v1 milestones are appended as planned work. The product direction is to keep First LLM Studio evidence-driven and lifecycle-oriented while borrowing stronger desktop onboarding, runtime breadth, extension, workflow, team, and production patterns. See [`docs/competitive-landscape.md`](./competitive-landscape.md).

## 2026-07-12 post-v1 ten-slice foundation batch

One testable foundation slice now exists for every planned version from `v1.1.0` through `v1.5.1`: desktop diagnostics, model acquisition jobs, server instances, runtime conformance, extension trust, workflow graphs, workspace identity, training capabilities, artifact packages, and HA/FinOps readiness. `/experiments` shows these separately as foundation evidence, currently 3 foundation-ready, 6 partial, and 1 blocked at 14% average completion. Planned release statuses are unchanged. Evidence: [`docs/release-evidence/post-v1-foundation-2026-07-12.md`](./release-evidence/post-v1-foundation-2026-07-12.md).

## 2026-07-12 executable foundation continuation

The next mainline slice makes six foundations executable: local desktop package signature/install rehearsal, bounded resumable HTTP Range model transfer, the live Ollama API bridge, extension signature verification plus quarantine, a persisted workflow execution reducer, and SQLite-enforced workspace isolation. A real local rehearsal passes transfer, signature/tamper, workflow, and ACL checks while leaving Apple Developer ID and live Ollama evidence unresolved. The separate foundation projection rises from 14% to 22% average without changing planned release statuses. Evidence: [`docs/release-evidence/post-v1-executable-foundations-2026-07-12.md`](./release-evidence/post-v1-executable-foundations-2026-07-12.md).

## 2026-07-10 GA hardening batch

The latest implementation batch added Provider snapshot and GA bundle SHA-256 integrity, bundle history/export/retention, route-smoke trends, compatibility deletion operator sign-off, candidate-worktree secret scanning, production dependency audit evidence, Provider target-card feature ownership, and a combined Agent runtime/connection shell port. The non-cloud and production gates remain fail-closed where remote Provider, sunset, and real cloud evidence are absent.

## 2026-07-10 GA auditability and boundary batch

The follow-up batch adds checksummed security and route-smoke history, live-versus-persisted GA state drift, source-level evidence drilldowns, smoke and compatibility sign-off exports, a feature-owned Provider Ops Admin shell, thin Provider/GA/compatibility API wrappers, and one Agent runtime/connection action composition port. Local evidence remains separate from remote Provider freshness and cloud production sign-off.

## 2026-07-10 Admin and Agent application-boundary batch

This 15-item continuation moves Admin benchmark evidence/history and provider comparison rendering into their owning features; moves Agent target/profile, sidebar/tool registry, and runtime-rail prop assembly behind feature composition ports; and turns workspace-file, check-history, protected-tool decision, and runtime-status routes into thin wrappers over `features/agent` application services. Route ownership now matches the physical code boundary. Remote Provider freshness, the 2026-09-30 compatibility sunset, and real cloud production evidence remain intentionally unresolved external gates.

## 2026-07-11 Shell, analysis, and transport-boundary batch

This 15-item continuation retires the unused Agent-side Compare compatibility exports, physically moves Get Code into `features/agent`, extracts conversation/session projections plus header/status/prompt composition, groups session/transcript/composer/secondary/get-code props behind feature adapters, moves Admin telemetry/runtime and Benchmark analysis helpers into their owning modules, and removes `NextResponse` from the runtime application layer. External Provider freshness, sunset timing, and cloud production evidence remain fail-closed.

## 2026-07-11 Workspace and runtime-card batch

This 10-item continuation moves Agent sidebar/main/layout and Chat/Compare mode rendering into feature-owned composition, adds target/profile/header/status/prompt input adapters, moves Admin runtime target derivation plus hardware metric and log panels out of the dashboard, and separates remote runtime status construction from local gateway health orchestration. External Provider, sunset, and cloud evidence remain unchanged.

## 2026-07-11 Session, runtime-state, and benchmark-detail batch

This continuation moves Agent session command creation, session export, and turn-lifecycle input assembly behind feature-owned adapters; moves Admin runtime trace and model-state/action rendering plus Benchmark history identity/run-note detail into owning feature panels; and separates local recovering/ready/unavailable status construction from gateway probing. External Provider freshness, the 2026-09-30 compatibility sunset, and real cloud workload-identity evidence remain fail-closed.

## 2026-07-11 v1.0 local GA closure batch

This closure moves Agent base chat/session state, Benchmark result cards, Admin recent operations breakdowns, and local runtime probe/ensure policy into feature ownership; adds a five-route pre-sunset compatibility deletion rehearsal; refreshes nine product/evidence screenshots at 1920x1200 with 2x DPR and per-flow viewport/full-page policy; and records a successful real DeepSeek release probe. The only remaining gates are time-bound compatibility deletion and explicitly deferred real-cloud production evidence.

Last updated: 2026-08-01

This release train and post-v1 roadmap form the active product contract after `v0.4.2`. They are mirrored in code by:

- `features/experiments/release-train.ts`
- `app/api/experiments/release-train/route.ts`
- `features/experiments/ReleaseTrainPanel.tsx`

## Version Train

| Version | Track | Status | Target | Core outcome |
| --- | --- | --- | --- | --- |
| `v0.5.0` | Ops | Complete | 2026-07 | Provider Health Desk v2, retry/timeout visibility, release evidence grouping, Adapter Export closure. |
| `v0.5.1` | Release | Complete | 2026-07 | Public docs route, demo capture automation, contributor flow, Distillation v1. |
| `v0.6.0` | Models | Complete | 2026-08 | Unified Model Hub for install, verify, runtime state, hardware fit, and local server controls. |
| `v0.6.1` | Models | Complete | 2026-08 | Durable Runtime Profile Registry, profile apply contract, Developer API panel, token and latency accounting. |
| `v0.7.0` | RAG | Complete | 2026-08 | Enterprise RAG Starter with vector adapter, hybrid recall, reranker, citations, ACL, and eval sets. |
| `v0.7.1` | RAG | Complete | 2026-09 | RAG-first playground with replay, citation inspection, permission preview, and benchmark handoff. |
| `v0.8.0` | Fine-tune | Evidence complete | 2026-09 | Professional LoRA loop: durable recipe, eval, best checkpoint, chart markers, export, and adapter attach. |
| `v0.8.1` | Fine-tune | Evidence complete | 2026-09 | Adapter lifecycle registry, merge/quantized export plans, attach rollback, and lineage evidence. |
| `v0.9.0` | Deployment | Cloud evidence needed | 2026-10 | Production control plane for registry, audit, quota, telemetry, KMS signing, and failover rehearsal. |
| `v1.0.0` | Release | Complete | 2026-10 | GA release with coherent Agent, Model Hub, RAG, Fine-tune, Benchmark, Compare, Ops, and evidence contracts. |

## Post-v1 Version Train

These versions are not all shipped. Their implementation, local readiness, and external production evidence are scored separately by `features/experiments/post-v1-promotion-gate.ts` and surfaced in `/experiments`.

| Version | Track | Target | Borrowed strength | Core outcome |
| --- | --- | --- | --- | --- |
| `v1.1.0` | Desktop | 2026-11 | LM Studio / Jan onboarding | Signed desktop package, first-run diagnosis, upgrades, permissions, background services, rollback and uninstall evidence. |
| `v1.1.1` | Models + DX | 2026-11 | Desktop model hubs and maintainable OSS workflows | Resumable downloads, checksums, external-disk migration, deduplication, compatibility checks, install-to-benchmark handoff, issue-ready runtime/tool/benchmark evidence, CI route smoke, bilingual contributor onboarding, and reproducible demo capture. |
| `v1.2.0` | Runtime | 2026-12 | LM Studio / Jan local server | Server-instance registry, hot-switch, idle eviction, request logs, auth, trusted hosts, accounting, and LAN safety. |
| `v1.2.1` | Runtime | 2026-12 | Ollama / LocalAI runtime breadth | Backend-neutral adapters for MLX, llama.cpp, Ollama, LocalAI, vLLM, SGLang, cross-platform hardware, and remote nodes. |
| `v1.3.0` | Ecosystem | 2027-01 | Open WebUI / Jan extensibility | Permissioned MCP and signed extension registry with secret scope, audit, update, rollback, and quarantine. |
| `v1.3.1` | Workflow | 2027-01 | AnythingLLM flows | Typed visual Agent/RAG/eval graphs with versioning, breakpoint replay, protected-tool resume, and deploy-as-API. |
| `v1.4.0` | Governance | 2027-02 | Open WebUI team controls | Organizations, workspaces, RBAC, OIDC/SSO, SCIM, shared assets, policy simulation, and immutable audit. |
| `v1.4.1` | Evaluation | 2027-02 | LLaMA-Factory training depth | Training backend compatibility, sweeps, judge calibration, confidence intervals, and reproducible CI regression gates. |
| `v1.5.0` | Ecosystem | 2027-03 | Community hubs and registries | Signed model/adapter/dataset/RAG/eval/profile/workflow packages with provenance and evidence-backed quality claims. |
| `v1.5.1` | Platform | 2027-03 | Production AI control planes | Multi-node HA, fencing, regional failover, durable usage/billing, OTel/Langfuse, real KMS/HSM, immutable archive, and organization sign-off. |

## Post-v1.6 Source Train: One Complete Plus Fifteen Remaining

The next fifteen source-development versions after `v1.6.7` are intentionally separate from the
existing production promotion gates. `VERSION` and `release-state.json` remain
at `1.5.1` until a release is actually promoted; the typed release train marks
`v1.7.0` as the active development slice after the local v1.6.7-v1.6.9
source gates completed; this does not change the `1.5.1` release truth.

| Version | Track | Core outcome |
| --- | --- | --- |
| `v1.6.7` | Workflow | Complete locally: real executor registry for retrieval, read-only tools, guards, evaluators, Provider context, and protected side-effect boundaries. |
| `v1.6.8` | Fine-tune | Complete locally: backend-truthful scheduler/warmup/packing controls, capability rejection, checkpoint-specific inference, and metric plugins. |
| `v1.6.9` | Fine-tune | Complete locally: frozen base/adapter quality evidence and local adapter-bundle export pass, while quality promotion and remote Hub/4B gates remain HOLD. |
| `v1.7.0` | Benchmark | Active: candidate admission rejects duplicate model/adapter bindings; second complete candidate run, official multimodal assets/native execution, and MiniMax M3 quality evidence remain required. |
| `v1.7.1` | Platform | Deployed enterprise Retrieval, OTel/Langfuse, and managed public API identity/quota/audit controls. |
| `v1.7.2` | Release | Architecture sunset, channel reconciliation, desktop distribution, production HA/security, and organization promotion receipts. |
| `v1.7.3` | Runtime | OpenAI-compatible SDK parity, streaming cancellation, retry safety, backpressure, and request attribution. |
| `v1.7.4` | Models | Signed model supply chain across download, conversion, storage, migration, verification, and runtime promotion. |
| `v1.7.5` | RAG | Governed ingestion, corpus revisions, deletion proof, leakage tests, quality gates, and freshness SLOs. |
| `v1.8.0` | Workflow | Move Agent turn, retrieval, tool, verification, and recovery lifecycles onto the proven graph runtime. |
| `v1.8.1` | Governance | Multi-user experiment revisions, review, approval, conflict, retention, restore, and lineage. |
| `v1.8.2` | Evaluation | Enforceable Quality CI across quality, safety, latency, cost, waivers, and rollback. |
| `v1.8.3` | Platform | Correlated OTel/Langfuse evidence, FinOps allocation, SLOs, alerts, privacy, and retention. |
| `v1.9.0` | Desktop | Signed/notarized Desktop GA with clean-machine install, upgrade, rollback, and uninstall evidence. |
| `v1.9.1` | Ecosystem | Federated artifact registries with organization trust, revocation, dependency policy, and immutable read-back. |
| `v1.9.2` | Desktop | Project-first local/remote provenance, persistent cancel/resume runtime lifecycle, and reproducible Apple Silicon performance evidence. |
| `v1.9.3` | Agent | Streaming tool cards, risk-tier approvals, branching/replay, cancellation/idempotency, and user-visible execution/cost truth. |
| `v1.10.0` | Workflow | Log-to-node locator, checkpoint/replay, safe deployment revisions, rollback, and SSRF-aware connector policy. |
| `v1.10.1` | Quality | Fine-tune backend/recipe lineage with governed corpus revisions, deletion proof, retrieval quality, and promotion review. |
| `v1.10.2` | Desktop | Runtime provenance, restart-safe cancellation/recovery, and reproducible Apple Silicon performance evidence. |
| `v1.10.3` | Governance | Workspace/operator provenance, signed request context, expiry, and cross-workspace denial. |
| `v1.10.4` | Agent | Protected action cards, approval, cancellation, idempotent recovery, and safe replay. |
| `v1.10.5` | Workflow | Node locator, redacted state, breakpoint/checkpoint, immutable replay, and controlled resume. |
| `v1.11.0` | Ecosystem | Artifact federation trust, immutable coordinates, remote read-back, revocation, and quarantine. |
| `v1.11.1` | Models | Verified Hub transfer, conversion/placement provenance, migration, repair, deduplication, and retirement. |
| `v1.11.2` | RAG | Versioned corpus operations, queue recovery, ACL/deletion propagation, citation/leakage/freshness evaluation. |
| `v1.11.3` | Quality | Reproducible Fine-tune recipes, capability preflight, checkpoint/model-card lineage, and cost/quality comparison. |
| `v1.11.4` | Evaluation | Quality/safety policy, paired regression, judge calibration, expiring waivers, and rollback. |
| `v1.12.0` | Release | Enterprise control-plane reconciliation for deployment, identity, usage, audit, HA, security, and approval. |
| `v2.0.0` | Release | Enterprise Production GA after independent identity, HA, billing, security, distribution, and organization evidence. |
| `v2.0.1` | Release | Read-only verification of independently signed production evidence, with pinned trust anchors and no repository-owned GA authorization. |
| `v2.0.2` | Release | Read-only projection of an independently signed release approval or rejection, bound to verified evidence and rollback. |
| `v2.0.3` | Release | Read-only verification of an independent production-transition witness bound to a release decision. |
| `v2.0.4` | Release | Read-only verification of an independent rollback witness with plan and RPO/RTO evidence. |
| `v2.0.5` | Release | Read-only closure archive binding the decision, transition, and rollback chain; terminal 2.0.x source slice. |

## Current Slice

The latest tagged release remains `v1.1.0-rc.2`. The active source milestone is now `v1.5.1`; the Desktop package still requires real Developer ID notarization and a separately trusted clean-machine organization receipt before GA promotion.

The earlier `v1.1.1` Community/DX batch absorbed the remaining GitHub issues: latest runtime recovery visibility, line-level `read_file` evidence, compact benchmark issue exports, production route-smoke artifacts, Chinese contributor onboarding, a repository setup checklist, local/remote lane guidance, and a reproducible MP4 workflow. The real multi-file transfer and physical external-disk receipt pass; only refreshed ModelScope identity evidence remains required for authenticated promotion.

Evidence: [`docs/release-evidence/v1.1.1-community-dx-2026-07-16.md`](./release-evidence/v1.1.1-community-dx-2026-07-16.md).

The real Model Hub continuation now resolves ModelScope manifests to immutable commits, verifies provider SHA-256 for every selected file, emits a final transfer receipt, and performs operator-approved physical-volume migration with per-file re-hashing and a volume-bound ownership manifest. The public 9-file workload and `HP ZHAN SSD` migration pass; the combined gate remains `7/8 PASS` because the previous ModelScope token returned `401` from the official identity endpoint. Evidence: [`docs/release-evidence/v1.1.1-model-hub-promotion-2026-07-16.md`](./release-evidence/v1.1.1-model-hub-promotion-2026-07-16.md).

The `v1.2.1` local Runtime Fabric is complete. Six adapters share one normalized operation contract, and real MLX, Ollama, and llama.cpp processes pass health, discovery, chat, SSE, and usage normalization on Apple Silicon. Production promotion remains HOLD for real LocalAI, Linux/NVIDIA vLLM and SGLang, and heterogeneous remote-node failover receipts. Evidence: [`docs/release-evidence/v1.2.1-runtime-fabric-acceptance-2026-07-18.md`](./release-evidence/v1.2.1-runtime-fabric-acceptance-2026-07-18.md).

The `v1.3.0` local MCP and secure extension ecosystem is complete. A pinned official filesystem server passes real MCP stdio initialization, tool discovery, and read execution under macOS Seatbelt; signed install/update/rollback, permission/secret boundaries, quarantine, malicious bundle rejection, and dependency blocking pass 11/11 checks. Production promotion remains HOLD for an independently managed publisher trust root, Linux and Windows isolation receipts, and a remote Streamable HTTP OAuth lifecycle. Evidence: [`docs/release-evidence/v1.3.0-mcp-extension-acceptance-2026-07-19.md`](./release-evidence/v1.3.0-mcp-extension-acceptance-2026-07-19.md).

The `v1.3.1` Workflow Studio implementation is now active. Its local promotion state is derived from a fresh durable acceptance receipt rather than a hardcoded complete flag. The shared governance layer now has local collaborative conflict evidence; production remains fail-closed until authenticated non-loopback invocation and distributed worker recovery are exercised in the deployed environment.

The `v1.4` local acceptance continuation is also complete: 15/15 identity, worker-recovery, and quality-CI slices pass from one aggregate receipt. This does not advance the source version or public release channel. It establishes the local contract required before real IdP/SCIM, separate-node worker, immutable audit, frozen task baseline, blind multi-seed, and calibrated human-label evidence can promote `v1.4.0` or `v1.4.1`.

The next production-bridge slice now implements configurable OIDC discovery/JWKS verification, an outbound paginated SCIM provider adapter, PostgreSQL durable leases, and process-isolated worker recovery. A real artifact binder reads 122 existing Benchmark runs plus the completed Qwen 4B LoRA release manifest. Local PostgreSQL failover passes, while real Quality CI correctly remains `HOLD` because the public archive excludes adapter weights and the existing adapter comparison runs contain zero paired scored samples. Evidence: [`docs/release-evidence/v1.4-production-bridge-local-evidence-2026-08-01.md`](./release-evidence/v1.4-production-bridge-local-evidence-2026-08-01.md).

## 2026-07-16 v1.1.0-rc.2 Desktop Distribution Gate

The app now uses a compiled arm64 Mach-O launcher. The Apple pipeline signs nested code and the app before notarizing/stapling both the app archive and final DMG, retains Apple logs, and separates preflight from completed evidence. A portable external-Mac runner and RSA-signed organization receipt importer require package/request binding, a different host fingerprint, complete lifecycle checks, and an out-of-band pinned public-key digest. Local contract and tamper-denial rehearsals pass, while the missing Developer ID identity, notary profile, and independent organization receipt keep GA on HOLD. Evidence: [`docs/releases/v1.1.0-rc.2_2026-07-16.md`](./releases/v1.1.0-rc.2_2026-07-16.md).

## 2026-07-16 v1.1.0-rc.1 Desktop Onboarding

The Desktop milestone now has a self-contained Apple Silicon app bundle with bundled Node, ZIP/DMG outputs, terminal-free startup, first-run and lifecycle orchestration, a real local Ollama chat proof, and a read-only DMG clean-profile boot rehearsal. `/experiments` reports 8 pass, 1 Apple-distribution watch, and 0 blocked local steps through `desktop.onboarding-release.v1`. The package is intentionally RC-only until Developer ID notarization and external clean-machine acceptance exist. Evidence: [`docs/releases/v1.1.0-rc.1_2026-07-16.md`](./releases/v1.1.0-rc.1_2026-07-16.md).

## 2026-07-12 v1.0.1 non-cloud hardening batch

This 15-slice batch extracts Agent target/locale/session/export effects, Admin filter/query/report/progress/runtime-history glue, and Benchmark coverage/heatmap composition into owning features. It adds compatibility rehearsal exports, a dedicated local-GA bundle source, and a screenshot integrity report that verifies nine flow ids, PNG dimensions, file digests, and manifest synchronization. The runtime release-train contract now reflects the actual active v1.0 phase instead of the stale v0.5 marker.

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
- Added Model Hub runtime target cards from the backend runtime-operations read-model, covering endpoint, key status, profile counts, recent requests, token totals, latency, and idle-unload policy.
- Added `provider.ops-evidence-summary.v1` so Provider Health Desk can be consumed as a release-gate evidence source with provider status counts, action/watch counts, failure classes, cost/token totals, retry template summaries, and release-note draft lines.
- Added `experiments.promotion-gate.v1`, combining Benchmark release evidence, Provider Ops evidence, and Fine-tune LoRA evidence into a visible `/experiments` promotion gate with honest PASS/WATCH/HOLD state.
- Extended route smoke to guard both the release train API and runtime operations v2 contract.
- Added Adapter Export package completeness checks to the promotion gate, including manifest, model card, publish checklist, optional dataset card, file size, and Git LFS pointer detection.
- Added docs/screenshots freshness checks to the promotion gate for v0.4.2 release notes, roadmap, fine-tune screenshots, LoRA chart, benchmark evidence, and Model Hub screenshots.
- Added Model Hub local server actions to runtime target cards so local model cards expose hot-switch, unload, restart, and logs through existing runtime APIs.
- Ran a complete Adapter Export wizard rehearsal for `qwen3.5`, producing a ModelScope-targeted adapter package with `publishChecklistStatus: PASS`.
- Added `experiments.release-evidence-matrix.v1`, a release evidence and roadmap tracker that scores every milestone from current contracts, artifacts, blockers, and next actions.
- Added `/release` as the public release evidence route for launch notes, demo capture status, and distillation evidence.
- Added `experiments.public-release-evidence.v1` so public docs, release docs, demo capture screenshots, and distillation artifacts are scored from one contract.
- Added `docs/demo-capture-manifest.json` and `npm run screenshots:release` for repeatable high-resolution release screenshot capture.
- Added `retrieval.query-replay.v1` so `/retrieval` queries now produce durable replay entries, citation diagnostic labels, and release-matrix evidence for the RAG Playground slice.
- Refreshed v0.5.0/v0.5.1 evidence on 2026-07-07 with a matched 638/638 benchmark pin, a real DeepSeek provider request in the 24h Provider Ops window, a new Distillation operation, and refreshed public release screenshots.
- Added Fine-tune best-checkpoint backfill for historical ready adapters, including `/api/finetune` action `backfill-best-checkpoints`, Assets panel coverage UI, Evaluate checkpoint preference, and release evidence for v0.8.0.
- Verified v0.8.0 Fine-tune Pro as `complete` in the release evidence matrix: 8 recipes, 6 completed jobs, 7 ready adapters, 6 best-checkpoint adapters, 1 completed export, and no blockers.
- Added Adapter Lifecycle registry for v0.8.1 with variant diff evidence, merge/q8 export planning, rollback proof lifecycle actions, Fine-tune Assets UI totals, and release matrix scoring from real lifecycle totals.
- Verified v0.8.1 Adapter Lifecycle as `complete` in the release evidence matrix: 16 variants, 9 variant diffs, 21 export plans, 1 rollback proof, and 2 lifecycle actions.
- Added Adapter Lifecycle polish for v0.8.1: registry filters by status/diff/export format plus a variant detail drawer for lineage, best-checkpoint, export, and rollback evidence.
- Added `deployment.control-plane.v1` with a durable usage outbox, external audit archive evidence directory, local Ed25519 KMS-style receipt signing, and failover rehearsal records.
- Ran a live production-control rehearsal through `/api/deployment`, producing 1 delivered usage record, 1 archived audit event, 1 verified KMS receipt, and 1 completed failover rehearsal.
- Added the cloud production adapter boundary for v0.9.0: AWS KMS `sign/verify`, S3 Object Lock archive writes, `requireCloud=true` fail-closed POST behavior, and separate `localReadiness` versus `productionReadiness`.
- Re-scored v0.9.0 from production cloud evidence only. Local rehearsal evidence no longer counts as cloud production sign-off.
- Added non-cloud v1.0 GA closeout evidence: Admin compatibility sunset read-model, route-smoke JSON artifact, v1.0 release-matrix GA blockers, and a dedicated Admin compatibility sunset panel.
- Migrated remaining Fine-tune report/bundle UI links from `/api/admin/finetune` to canonical `/api/finetune`, and split compatibility usage evidence into runtime, route-smoke, and historical-unclassified buckets.
- Added historical Admin compatibility archive/clear flow: `POST /api/admin/compatibility-usage` writes an archive, clears only legacy-unclassified hits, preserves route-smoke proof, and surfaces archive counts in `/admin` plus the v1.0 matrix.
- Verified the archive/clear flow on 2026-07-09: 116 historical hits archived, live legacy hits cleared to 0, route smoke remained 34/34 passing, and the v1.0 matrix now carries archive metrics instead of a historical-hit blocker.
- Added Provider Ops release probes: an Admin-owned minimal remote models plus chat check is labeled as `release-probe`, stored separately from user chat traffic, and can satisfy the fresh remote-evidence gate only after an actual successful probe.
- Added durable Provider Ops evidence snapshots with pin/delete/retention/export controls. Pinned snapshots remain valid only while the underlying success event is inside the 24-hour promotion window.
- Added a per-route Admin compatibility deletion manifest covering wrapper/canonical files, smoke coverage, runtime and historical hits, sunset timing, and delete readiness.
- Added route-smoke history archives and consecutive-pass metrics instead of retaining only the latest JSON report.
- Added `experiments.ga-release-evidence-bundle.v1`, a writable GA manifest that separates non-cloud readiness from production cloud readiness and is visible in `/experiments`.
- Moved Agent connection state/action assembly into `features/agent/connection-composition.ts`, leaving the workbench with one feature-owned connection input.

Next implementation slice:

- Run the implemented OIDC/JWKS and outbound SCIM adapter against the organization tenant, then archive login, rotation, deprovision, RLS, and immutable audit receipts under one organization-signed manifest.
- Publish immutable adapter weights for the completed Qwen 4B LoRA run, then execute at least 30 paired baseline/adapter samples over three blind seeds with approved human judge labels.
- Move the implemented PostgreSQL lease rehearsal from two local processes to independently managed worker hosts, then add network-partition, database-failover, clock-skew, and protected-side-effect duplicate-denial receipts.
- Keep Desktop Developer ID/notarization, real cloud KMS/Object Lock, LocalAI/Linux/NVIDIA Runtime Fabric, independent clean-machine, and organization sign-off gates fail-closed until their external receipts exist.
- Refresh public screenshots, docs, compatibility sunset evidence, and the GA bundle only from a final entity worktree close to release time.

## 中文说明

这份版本列车是 `v0.4.2` 之后的主线契约，并已同步到代码：

- `features/experiments/release-train.ts`
- `app/api/experiments/release-train/route.ts`
- `features/experiments/ReleaseTrainPanel.tsx`

当前正式标签仍是 `v1.1.0-rc.2`，源码里程碑已按 release truth 推进到 `v1.5.1`。v1.4.0-v1.5.1 的仓库内本地 contracts、真实 adapter 配对评测、artifact binding、usage settlement 与本地 failover evidence 已闭环；认证非回环调用、分布式 worker、真实 IdP/SCIM、部署后 Postgres、组织远端 registry、跨区 failover、云 KMS/Object Lock 与组织签收继续保持生产阻塞。原生 launcher 的 Developer ID notarization 和独立可信 clean-machine签收同样保持 fail-closed。
