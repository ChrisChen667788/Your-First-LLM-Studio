# First LLM Studio

[English](#english) | [简体中文](#简体中文)

![Release](https://img.shields.io/github/v/release/ChrisChen667788/Your-First-LLM-Studio?label=release)
![License](https://img.shields.io/github/license/ChrisChen667788/Your-First-LLM-Studio)
![Apple Silicon](https://img.shields.io/badge/platform-Apple%20Silicon-0f172a)
![MLX](https://img.shields.io/badge/local%20runtime-MLX-06b6d4)

<p align="center">
  <a href="https://github.com/ChrisChen667788/Your-First-LLM-Studio">
    <img src="./docs/assets/github-hero-data.png" alt="First LLM Studio model training, evaluation, and runtime performance overview" width="100%">
  </a>
</p>

> The dashboard uses illustrative sample telemetry for product presentation; measured workflows and release evidence remain documented separately.

## Product Film / 产品短片

<p align="center">
  <a href="./docs/assets/product-tour/first-llm-studio-promo.mp4">
    <img src="./docs/assets/product-tour/first-llm-studio-promo.gif" alt="First LLM Studio: 3D model sculpture, training data, evaluation and runtime motion graphics" width="760">
  </a>
</p>

**[Watch the 30-second film with original sound / 观看 30 秒原创配乐短片](./docs/assets/product-tour/first-llm-studio-promo.mp4)** · [Current UI gallery / 当前实机截图](./docs/product-tour-and-positioning-2026-10-06.md#current-product-media--当前产品素材) · [Creative review and data sources / 设计复查与数据来源](./docs/product-film-creative-review-2026-10-06.md)

From model choice to reviewable evidence: one local-first workbench for Agent sessions, comparison, fine-tuning, evaluation, and runtime operations. / 从模型选择到可复查证据：用一个本地优先工作台串起 Agent、对比、微调、评测与运行时操作。

Data, not a screenshot collage: a sculptural model fabric, a checkpoint curve, a 500-sample field, and runtime motion graphics. Numeric highlights use **labeled historical local evidence**; animated traces are illustrative. Scorer replay agreement is not model accuracy, and small-sample throughput is not a general performance promise. / 用数据而非截图拼贴讲产品：立体模型结构、训练曲线、500 点评测阵列与运行时动态图形。数字来自**标注日期的历史本地证据**，动态波形为艺术示意；评分回放一致率不等于答题准确率，小样本吞吐量不代表普遍性能承诺。

---

# English

Latest development batch: [v5.8.0-v5.9.4 Activation Operations](./docs/v5.8.0-v5.9.4-activation-operations-plan-2026-09-10.md). Extends verified intake with pinned operational policy and trust snapshots, signed authority rotation, scoped freshness and conflict projection, leased quarantine handling, review quorum, one-shot decision admission, non-authorizing distribution/production firewall, and secret-free audit export/merge. The live default remains unconfigured, distribution `HOLD`, production `BLOCKED`. See the [operator guide](./docs/activation-operations-operator-guide.md).

最新开发批次：[v5.8.0-v5.9.4 激活运营](./docs/v5.8.0-v5.9.4-activation-operations-plan-2026-09-10.md)。在签名接收之上增加运营策略与信任快照、权威密钥轮换、时效与冲突投影、隔离租约、审阅门槛、决策一次性接收、不授权分发/生产防火墙，以及不含密钥的审计导出/合并。默认服务仍未配置，分发为 `HOLD`，生产为 `BLOCKED`。[操作说明](./docs/activation-operations-operator-guide.md)。

Latest development batch: [v5.6.0-v5.7.4 Verified Activation Intake](./docs/v5.6.0-v5.7.4-activation-intake-plan-2026-09-09.md). Adds actual Ed25519 signature verification, server-owned key pins, role/audience binding, atomic import and preview, durable replay protection, independent domain pairing, renewal/revocation, signed quarantine resolution, and reverified backup merge. The Experiments inbox and CLI use the same application service. These are source milestones; organization evidence is still required and distribution/production remain HOLD/BLOCKED. See the [operator guide](./docs/activation-intake-operator-guide.md).

最新开发批次：[v5.6.0-v5.7.4 签名证据接收](./docs/v5.6.0-v5.7.4-activation-intake-plan-2026-09-09.md)。已接入真实 Ed25519 验签、服务端公钥固定、角色与受众绑定、原子导入/预检、持久化重放防护、独立证据配对、续期/撤销、签名隔离处理和重新验签备份合并。Experiments 收件箱与 CLI 共用应用服务。以上为源码里程碑，组织证据仍待提供，分发/生产保持 HOLD/BLOCKED。[操作说明](./docs/activation-intake-operator-guide.md)。

First LLM Studio is a local-first LLM workbench for Apple Silicon. It brings local MLX runtimes, remote API targets, Agent sessions, Compare, Fine-tune, Benchmark, model discovery, runtime recovery, release evidence, and admin monitoring into one operating surface.

It is not another chat shell. It is built for people who need to compare behavior, debug runtimes, run evals, prepare adapters, and keep local and remote model work inside one product loop.

## Product Surfaces

| Route | Core workflow |
| --- | --- |
| `/agent` | Tool-enabled Agent sessions, target selection, runtime state, replay, trace review, and embedded Compare entry. |
| `/compare` | Route-owned Compare Studio for prompt composition, lane preview, recipe persistence, review drawer, and benchmark handoff. |
| `/fine-tune` | Foreground Fine-tune Studio for datasets, recipes, training, evaluation, chat adapter proof loops, export, reports, and artifacts. |
| `/models` | Model discovery and install verification for local/community models plus hardware-fit and risk signals. |
| `/benchmarks` | Benchmark run controls, progress, reports, release evidence, baselines, and regression review. |
| `/retrieval` | Foreground knowledge management, path import, chunk inspection, and grounded retrieval validation. |
| `/experiments` | Unified run/session timeline with artifact lineage, cross-feature navigation, filters, and retention controls. |
| `/admin` | Monitoring/configuration mirror for runtime, queues, benchmark history, provider health, guardrails, and audit timelines. |

## Major Version Story

| Version | Core capabilities |
| --- | --- |
| `v0.1` Foundation | Established the local-first web studio, Apple Silicon/MLX gateway workflow, local + remote target catalog, runtime telemetry, and the first Agent/Admin operating split. |
| `v0.2` Agent + Benchmark Ops | Added richer Agent workbench flows, Compare-style target review, replay/trace inspection, runtime recovery controls, formal benchmark operations, baselines, and regression evidence. |
| `v0.3` Fine-tune + Release Evidence | Added fine-tune operation loops for evaluation, adapter chat, adapter export, and distillation starters; expanded operation history, partitioned typechecks, screenshot smoke, route smoke, and public launch assets. |
| `v0.4` Product IA release | Moves `/fine-tune`, `/compare`, `/models`, `/benchmarks`, `/retrieval`, and `/experiments` into foreground product routes with feature-owned state/actions, artifact lineage and retention, dark-glass studio/workbench styling, canonical APIs, and admin narrowed toward monitoring/configuration. |
| `v0.4.1` Stability baseline | Repairs dataless workspace failure modes, keeps route smoke and typecheck green, updates the OpenAI-compatible `/v1` surface, refreshes provider status reporting, captures current real UI evidence, and archives a real Qwen3 4B LoRA run with checkpoint/report/chart evidence. |
| `v0.4.2` Evidence patch | Formalizes the GitHub/ModelScope high-resolution screenshot sync, documents the README-facing LFS threshold fix, and preserves the v0.4.1 LoRA evidence as the stable public baseline while v0.5.0 work starts. |
| `v0.5` Starter track | Enterprise RAG, deployment registry, OpenAI-compatible API, telemetry, release-readiness gates, production attestation, and control-plane rehearsal work continue behind explicit preview gates until promoted. |
| `v1.0` Integrated GA baseline | Unifies Agent, Compare, Model Hub, Retrieval, Fine-tune, Benchmark, Experiments, Admin monitoring, thin application APIs, route ownership, release security, and reproducible evidence contracts. |
| `v1.1.0-rc.1` Desktop Onboarding | Adds a self-contained Apple Silicon app with bundled Node, ZIP/DMG packaging, first-run diagnosis, permission and service recovery, migration/update/rollback/uninstall rehearsals, a real Ollama local-chat proof, and clean-profile boot evidence. Developer ID notarization remains a separate GA gate. |
| `v1.1.0-rc.2` Desktop Distribution Gate | Replaces the shell entrypoint with a native arm64 launcher and adds nested-code/app/DMG signing, dual notarization logs, staple/Gatekeeper verification, a portable clean-machine runner, and RSA-signed organization receipts with an out-of-band trust pin. Real external receipts still gate GA. |
| `v1.1.1` Model Hub Lifecycle | Adds immutable multi-file Hub manifests, provider SHA-256 receipts, operator-approved physical external-volume migration, ownership manifests, and a visible promotion read model. Refreshed Hub identity evidence remains a separate gate. |
| `v1.2.0` Local Server Acceptance | Adds a real Ollama 15-slice acceptance loop for process health, model residency, OpenAI-compatible chat/SSE, concurrency, accounting, access policy, log retention, idle eviction, and unload/reload recovery. Separate-device LAN and sustained daemon evidence still gate production promotion. |
| `v1.2.1` Runtime Fabric | Implements one normalized runtime contract across MLX, Ollama, llama.cpp, LocalAI, vLLM, and SGLang. Real MLX/Ollama/llama.cpp chat and SSE pass on Apple Silicon; unsupported hardware and missing endpoints fail before execution with actionable codes. External LocalAI, Linux/NVIDIA, and heterogeneous-node receipts still gate production promotion. |
| `v1.3.0` MCP + Secure Extensions | Adds a pinned MCP server registry, real stdio capability discovery, Ed25519-signed install/update/rollback, permission and secret scopes, quarantine, dependency/path defenses, and OS-enforced macOS Seatbelt isolation. Local acceptance is 11/11 PASS; independent publisher, Linux/Windows sandbox, and remote OAuth receipts still gate production promotion. |
| `v1.3.1` Workflow Studio + Trust Hardening | Adds typed visual workflows, immutable publication, safe-worker resume/replay, strict deployment-key invocation, standard OpenAI-compatible sync/SSE responses, atomic recoverable Workflow stores, conventional contract tests, zero-vulnerability dependency gates, and portable LoRA evidence with quality promotion kept on `HOLD`. |
| `v1.4.0` Team Governance | Adds organizations, workspaces, roles, groups, request identity, optimistic conflict handling, database-level ACL/RLS rehearsals, identity mapping, policy simulation, and immutable audit evidence. Real OIDC/SCIM and deployed PostgreSQL remain production gates. |
| `v1.4.1` Quality and Training Lab | Binds frozen multi-seed evaluation, confidence intervals, deterministic scoring, Quality CI, and training capability contracts to a real attached adapter and 36 paired samples. Independent-worker repetition and calibrated subjective judging remain external gates. |
| `v1.5.0` Trusted Artifact Lifecycle | Packages the real adapter with pinned base revision, checksums, provenance, local registry read-back, quality-claim binding, install policy, and rollback lifecycle. Organization-controlled remote registry receipts remain a production gate. |
| `v1.5.1` Enterprise HA and FinOps | Completes the local durable usage outbox, token reconciliation, retry-safe settlement, audit/signing rehearsal, old-primary fencing, standby promotion, and measured local RPO/RTO. Managed billing, cross-region failover, cloud KMS/Object Lock, and organization sign-off remain `HOLD`. |
| `v1.6.3` Benchmark Qualification Checkpoint | Pins and checksum-verifies the complete HuggingFaceH4/MATH-500 test snapshot, exposes all 500 qualified items in Benchmark Studio, and preserves reproducible dataset provenance. |
| `v1.6.4` Official Evaluator Checkpoint | Adds pinned Math-Verify 0.9.0 equivalence scoring, resumable per-sample checkpoints, a real 500/500 local Qwen3 0.6B run at 32.00% accuracy, and protocol adapters for MMMU, MathVista, MMBench, and Video-MME v2. Full multimodal execution and external leaderboard reproduction remain `HOLD`. |
| `v1.6.5` Benchmark Reproducibility Checkpoint | Adds subject/difficulty scorecards, Wilson 95% confidence, latency/token/failure accounting, immutable run and evaluator fingerprints, a 500/500 isolated scorer replay with 100% decision agreement, and executable multimodal readiness plans. The replay is same-host evidence; independent workers and official multimodal runs remain `HOLD`. |
| `v1.6.6` Benchmark Decision Intelligence | Converts the real 500-item run into complete error taxonomy, confidence-aware cohort risks, latency/token outliers, a bounded review queue, conservative power planning, and a paired candidate gate with McNemar and non-inferiority policy. Local audit acceptance is separate from candidate promotion, which remains `EVIDENCE NEEDED` until a second distinct full run exists. |
| `v2.1.x` Post-GA Operations Evidence | Adds a read-only signed chain for continuity, SLO, incidents, data, access, supply chain, quality, capacity, recovery, and independent review. It verifies external evidence but cannot operate or authorize production. |
| `v2.2.x` Continuous Assurance | Adds strict externally signed contracts for compliance scope, privacy, model risk, third parties, regulatory mapping, transparency, responsible UX, resource efficiency, remediation, and independent review. |
| `v2.3.0-v2.3.4` Assurance Closure | Adds portable evidence read-back, trust-center publication, continuous monitoring, independent audit remediation, and immutable closure-archive verification. External evidence remains `HOLD`; production remains `BLOCKED`. |
| `v2.4.x` AI Operations Intelligence | Aggregates real feature-owned Runtime, Provider, SLO, token/cost, Benchmark, Retrieval, Agent, Workflow, and Fine-tune signals into exception-safe local readiness cards, while independent signed operations review remains `HOLD`. |
| `v2.5.0-v2.5.4` Deployment Lifecycle | Adds portable deployment, data-sovereignty, customer-key, continuity/exit, and independent closure contracts. Local receipts remain explicitly separate from customer KMS/HSM, managed infrastructure, and production authority. |
| `v2.6.0-v2.6.9` Governed Autonomy Readiness | Joins model selection, provider routing, grounded context, extension permissions, protected actions, Workflow replay, Benchmark quality, adapter rollback, and audit provenance into one source-backed, independently reviewed chain. |
| `v2.7.0-v2.7.4` Open Ecosystem Interoperability | Adds fail-closed OpenAI-compatible client, MCP extension, artifact/model portability, workspace/identity portability, and independent closure contracts without claiming external deployment authority. |
| `v2.8.0-v2.8.9` Operational Remediation and Efficiency | Turns Provider, Retrieval, model supply-chain, workspace audit, runtime, Agent, Workflow, Benchmark, and Fine-tune owner signals into a prioritized remediation chain with an independent terminal review. |
| `v2.9.0-v2.9.4` Sustainable Operations and Upgrade | Adds telemetry/resource transparency, incident diagnostics/retention, Admin compatibility sunset readiness, desktop upgrade/data lifecycle, and independent closure. |
| `v3.0.0-v3.0.9` Remediation Control Plane | Converts seven unresolved owner signals into accountable controls with priority, dependencies, acceptance checks, next actions, evidence fingerprints, deterministic packaging, and independent acceptance. |
| `v3.1.0-v3.1.4` Service Readiness | Adds customer-safe readiness disclosure, support diagnostics, upgrade/change continuity, an operational transition board, and independent closure without treating source completion as production approval. |
| `v3.2.0-v3.2.9` Remediation Execution | Converts the seven owner controls into deterministic, non-mutating execution plans with idempotency, bounded leases, fencing, rollback, evidence packaging, and independent execution acceptance. |
| `v3.3.0-v3.3.4` Operational Acceptance | Adds SLO/quality policy, incident/change rehearsal, identity-bound owner sign-off, explicit release decisions, and predecessor-bound independent operational acceptance. |
| `v3.4.0-v3.4.9` Owner Workload Admission | Adds strict digest-bound requests for seven owner workloads, dry-run admission, bounded SLA/escalation, candidate receipt validation, and independent receipt closure. |
| `v3.5.0-v3.5.4` Operational Decision Governance | Adds evidence freshness/drift, dependency-unblock impact, owner SLA, non-renewable bounded waivers, and independent decision closure. |
| `v3.6.0-v3.6.9` Owner Receipt Lifecycle | Adds authenticated candidate intake, digest-only quarantine, optimistic concurrency, compensation binding, and independent receipt-ledger closure. |
| `v3.7.0-v3.7.4` Operational Exception Governance | Adds SLA breach detection, acknowledgement events, protected-scope waiver expiry, decision packages, and independent exception closure. |
| `v3.8.0-v3.8.9` Competitive Model and Agent Product Train | **Source-complete / evidence-needed:** official-source registry, account capability discovery, explainable routing, Agent conformance/state/cache, isolated teams, sandboxing, multimodal evaluator gating, Model Hub operations v3, and Local Server diagnostics v3. |
| `v3.9.0-v3.9.4` RAG, Training, Team, and Freshness Train | **Source-complete / evidence-needed:** governed connector/index lifecycle, paired RAG quality/feedback, MLX/LLaMA-Factory/SWIFT backend federation, governed marketplace policy, and a <=14-day competitive promotion gate. |
| `v4.0.0-v4.1.4` Evidence Operations Train | **Source-complete / evidence-needed:** strict observed receipts for provider/workload routing, live Agent and sandbox behavior, licensed multimodal evaluation, model/runtime transfer, managed RAG, federated training, team assets, and a fail-closed aggregate promotion gate. |
| `v4.2.0-v4.3.4` Evidence Collection Control | **Source-complete / evidence-needed:** durable queue, retry fencing, strict submission, review/export, executable Provider catalog discovery and routing quality/shadow replay, plus eight feature-owned domain collectors that reject non-live read models before receipt submission. |
| `v4.4.0-v4.5.4` Evidence Adjudication and Retention | **Source-complete / evidence-needed:** reviewer attestation, issuer/separation/quorum policy, artifact read-back/retention, domain metric adjudication, re-observation, portable export, revocation, and a fail-closed aggregate gate. |
| `v4.6.0-v4.7.4` Evidence Acceptance Lifecycle | **Source-complete / evidence-needed:** authority configuration, durable package intake, fenced lifecycle, re-observation and read-back challenge binding, revocation, portable import, evidence aging, and a fail-closed distribution handoff. |
| `v4.8.0-v4.9.4` Evidence Authority Campaign | **Source-complete / evidence-needed:** opaque credential references, strict authority profiles, trust/rotation/retention contracts, fourteen-domain campaigns, observer assignments, nonce-bound challenges, receipt quarantine, freshness, escrow coverage, and authority separation. |
| `v5.0.0-v5.1.4` External Evidence Handoff | **Source-complete / evidence-needed:** digest-only handoffs, authority/archive witnesses, independent observer delivery, authority dispatch, signed receipt verification, discrepancy cases, renewal, decision requests/envelopes, and a production safety interlock. |
| `v5.2.0-v5.3.4` External Evidence Relay | **Source-complete / evidence-needed:** pinned HTTPS relay descriptors, opaque one-shot credential resolution, bounded digest-only request/receipt transport, quarantine, freshness/replay defense, fourteen-domain reconciliation, and a non-authorizing production firewall. |
| `v5.4.0-v5.5.4` External Evidence Activation | **Source-complete / evidence-needed:** relay/handoff-bound activation manifests, strict signed stage intake, quarantine, fourteen-domain currentness, separate decision request/receipt binding, and a production admission firewall. |

Current source version: [`v1.5.1`](./VERSION), with source status `COMPLETE` and local acceptance `PASS`. The machine-readable [`release-state.json`](./release-state.json) deliberately separates the active source milestone from the latest public GitHub release (`v0.4.0`) and the latest desktop candidate (`v1.1.0-rc.2`).

Previous operational-lifecycle source gate: [`v2.4.0-v2.5.4`](./docs/release-evidence/v2.4.0-v2.5.4-operational-lifecycle-source-gate-2026-08-29.md). Local projection contains 8 passing, 5 attention, and 2 external-only signals; independently verified external records remain `0/15`, so this evidence does not change distribution or production status.

Previous governed-autonomy and interoperability plan: [`v2.6.0-v2.7.4`](./docs/v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md). Its 15 source slices read existing feature-owned evidence and preserve independent external review, distribution `HOLD`, and production `BLOCKED` as separate facts.

Previous governed-autonomy source gate: [`v2.6.0-v2.7.4`](./docs/release-evidence/v2.6.0-v2.7.4-governed-interoperability-source-gate-2026-08-29.md) records 9 passing, 4 attention, 0 unavailable, and 2 external-only signals. Independently verified external records remain `0/15`.

Previous operational remediation plan: [`v2.8.0-v2.9.4`](./docs/v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md). Its initial owner-controlled projection records 6 passing, 7 attention, 0 unavailable, and 2 external-only signals. The attention queue is explicit product work; independently verified external records remain `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Previous validated source gate: [`v2.8.0-v2.9.4`](./docs/release-evidence/v2.8.0-v2.9.4-operational-sustainability-source-gate-2026-08-30.md) records 119/119 tests, 73/73 CI route checks, full cross-surface smoke, desktop/mobile browser QA, and the machine-readable export while preserving the same `ATTENTION`/`HOLD`/`BLOCKED` truth.

Previous remediation-control and service-readiness plan: [`v3.0.0-v3.1.4`](./docs/v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md). The initial projection reports 5 passing, 8 attention, 0 unavailable, and 2 external-only signals. Its control plane classifies 2 items as satisfied, 3 open, 8 blocked, and 2 external-only; independently verified records remain `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Previous validated source gate: [`v3.0.0-v3.1.4`](./docs/release-evidence/v3.0.0-v3.1.4-remediation-service-readiness-source-gate-2026-08-30.md) records 125/125 tests, 75/75 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA while preserving `ATTENTION`/`HOLD`/`BLOCKED` truth.

Latest remediation-execution and operational-acceptance plan: [`v3.2.0-v3.3.4`](./docs/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md). Seven direct owner actions now carry deterministic idempotency keys, bounded leases, fencing, rollback, and evidence fingerprints; the current projection is 0 satisfied, 3 ready, and 4 blocked. Independently verified records remain `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Latest validated source gate: [`v3.2.0-v3.3.4`](./docs/release-evidence/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-source-gate-2026-08-30.md) records 131/131 tests, 77/77 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA while preserving `ATTENTION`/`HOLD`/`BLOCKED` truth.

Current owner-workload and operational-decision plan: [`v3.4.0-v3.5.4`](./docs/v3.4.0-v3.5.4-owner-workload-operational-decision-plan-2026-08-30.md). Seven owner workloads now have strict request and candidate receipt contracts; the source projection is 5 pass, 8 attention, and 2 external-only. External evidence remains `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Current validated source gate: [`v3.4.0-v3.5.4`](./docs/release-evidence/v3.4.0-v3.5.4-owner-workload-operational-decision-source-gate-2026-08-30.md) records 137/137 tests, all 11 changed TypeScript partitions, 79/79 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA while preserving `ATTENTION`/`HOLD`/`BLOCKED` truth.

Current receipt and exception lifecycle plan: [`v3.6.0-v3.7.4`](./docs/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md). The repository now owns authenticated append-only receipt events, quarantine, compensation, escalation acknowledgement, bounded waiver expiry, and deterministic decision packages. The source projection is 6 pass, 7 attention, and 2 external-only; no real owner receipt was submitted during source validation, external evidence remains `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Previous validated source gate: [`v3.6.0-v3.7.4`](./docs/release-evidence/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-source-gate-2026-08-31.md) records 146/146 tests, all 11 changed TypeScript partitions, 81/81 CI routes, full smoke, production build, release-truth validation, architecture/durable-state checks, and security preflight.

Current competitive product plan: [`v3.8.0-v3.9.4`](./docs/v3.8.0-v3.9.4-competitive-product-plan-2026-09-02.md) implements all 15 repository-owned contracts and exposes their source/local/external/production truth in `/experiments`. Real provider accounts, workload scorecards, runtime/model transfers, OS sandbox receipts, licensed multimodal assets, managed RAG, non-MLX training workers, multi-user identity and independent acceptance remain explicit evidence gates; distribution remains `HOLD` and production remains `BLOCKED`.

Current validated source gate: [`v3.8.0-v3.9.4`](./docs/release-evidence/v3.8.0-v3.9.4-competitive-product-source-gate-2026-09-02.md) records 156/156 tests, all 11 changed TypeScript partitions, 85/85 CI routes, full smoke, production build, architecture/durable-state checks, and security preflight. Source is `15/15` pass; local evidence is `12/15` pass with routing-quality, licensed multimodal, and real Hub-transfer evidence deliberately held.

Current evidence-operations plan: [`v4.0.0-v4.1.4`](./docs/v4.0.0-v4.1.4-evidence-operations-plan-2026-09-03.md) adds a strict, durable candidate receipt contract and 15 visible source/local/external/production gates in `/experiments`. Candidate receipts can close only local evidence; independent signatures, immutable archive read-back, distribution approval, and production authority remain `HOLD` or `BLOCKED`.

Latest validated source gate: [`v4.0.0-v4.1.4`](./docs/release-evidence/v4.0.0-v4.1.4-evidence-operations-source-gate-2026-09-04.md) records 164/164 tests, all 11 changed TypeScript partitions, 86/86 CI routes, full smoke, a 53-page production build, architecture/durable-state checks, and an archived repaired zero-vulnerability security preflight. The latest online-audit rerun failed closed on an npm registry timeout, not a detected vulnerability. Source is `15/15` pass; observed local evidence is `3/15` pass, candidate receipts are `0`, external verification is `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Current evidence-collection plan: [`v4.2.0-v4.3.4`](./docs/v4.2.0-v4.3.4-evidence-collection-plan-2026-09-05.md). All 15 source mechanisms are implemented: queue controls, Provider catalog execution, 20-sample routing/shadow replay, review/export, and eight feature-owned domain collectors. The domain collectors reject reference, fixture, and derived read models before receipt submission; four deterministic control gates pass locally, while real workload evidence remains needed. Distinct reviewer IDs are not verified independent principals. The [validation record](./docs/release-evidence/v4.2.0-v4.3.4-evidence-collection-source-gate-2026-09-07.md) separates isolated transport tests from real workload evidence. Distribution remains `HOLD`; production remains `BLOCKED`.

Current evidence-adjudication plan: [`v4.4.0-v4.5.4`](./docs/v4.4.0-v4.5.4-evidence-adjudication-plan-2026-09-07.md). The [`source-gate record`](./docs/release-evidence/v4.4.0-v4.5.4-evidence-adjudication-source-gate-2026-09-07.md) records all 15 implemented contracts and seven deterministic local controls. No accepted workload package, externally verified reviewer, immutable archive read-back, or independent re-observation is present, so the external and production states remain `HOLD` / `BLOCKED`.

Current evidence-acceptance plan: [`v4.6.0-v4.7.4`](./docs/v4.6.0-v4.7.4-evidence-acceptance-plan-2026-09-08.md). The [`source-gate record`](./docs/release-evidence/v4.6.0-v4.7.4-evidence-acceptance-source-gate-2026-09-08.md) records all 15 source contracts, eight deterministic lifecycle controls, and the production-build route-smoke receipt. No controlled authority, immutable archive read-back, current externally verified package, independent observer, or distribution approval is present, so external and production states remain `HOLD` / `BLOCKED`.

Current evidence-authority campaign plan: [`v4.8.0-v4.9.4`](./docs/v4.8.0-v4.9.4-evidence-authority-campaign-plan-2026-09-08.md). The [`source-gate record`](./docs/release-evidence/v4.8.0-v4.9.4-evidence-authority-campaign-source-gate-2026-09-08.md) records all 15 source contracts, nine deterministic controls, and production-build route-smoke evidence. No controlled credential resolver, live authority profile, campaign, externally attested receipt, immutable archive read-back, independent observer, or distribution approval is configured, so external and production states remain `HOLD` / `BLOCKED`.

Current external evidence handoff plan: [`v5.0.0-v5.1.4`](./docs/v5.0.0-v5.1.4-external-evidence-handoff-plan-2026-09-08.md). The [`source-gate record`](./docs/release-evidence/v5.0.0-v5.1.4-external-evidence-handoff-source-gate-2026-09-08.md) records all 15 source contracts, nine deterministic controls, and production-build route-smoke evidence. No controlled resolver, witness, handoff, signed verification, immutable archive read-back, independent observer, or distribution decision is configured, so external and production states remain `HOLD` / `BLOCKED`.

Current external evidence relay plan: [`v5.2.0-v5.3.4`](./docs/v5.2.0-v5.3.4-external-evidence-relay-plan-2026-09-08.md). Its [`source-gate record`](./docs/release-evidence/v5.2.0-v5.3.4-external-evidence-relay-source-gate-2026-09-08.md) keeps endpoint policy, opaque one-shot credential resolution, strict receipt intake, quarantine, freshness, and 14-domain reconciliation separate from real authority evidence. The default relay transport is unavailable; no controlled credential, authority relay, immutable archive read-back, observer receipt, independent decision, distribution approval, or production transition is configured, so external remains `HOLD` and production remains `BLOCKED`.

Current external evidence activation plan: [`v5.4.0-v5.5.4`](./docs/v5.4.0-v5.5.4-external-evidence-activation-plan-2026-09-09.md). Its [`source-gate record`](./docs/release-evidence/v5.4.0-v5.5.4-external-evidence-activation-source-gate-2026-09-09.md) records source, build, and route evidence separately from independent authorization. It turns the relay/handoff lineage into strict activation manifests, signed stage observations, quarantine, fourteen-domain currentness, and a separately pinned decision request. The default activation port is unavailable; no controlled workload identity, authority observation, immutable archive read-back, independent observer, distribution decision, or production transition is configured, so external remains `HOLD` and production remains `BLOCKED`.

Internal post-release evidence has advanced through the [`v1.6.6 benchmark decision-intelligence checkpoint`](./docs/release-evidence/v1.6.6-benchmark-decision-intelligence-2026-08-13.md): all 500 stored results are classified (160 correct and 340 mathematical mismatches, with 100% answer extraction), confidence-aware risk highlights Intermediate Algebra, Precalculus, and Level 5, and the conservative 500-sample detectable effect is 8.27 percentage points. Only one distinct complete run exists, so candidate promotion remains `EVIDENCE NEEDED`. This does not change the active source version or claim hosted leaderboard parity, independent-host reproduction, multimodal execution, distribution, or production promotion.

Latest desktop candidate notes: [`v1.1.0-rc.2`](./docs/releases/v1.1.0-rc.2_2026-07-16.md). Distribution remains `HOLD` and production remains `BLOCKED`; this repository does not represent missing Apple, organization, non-loopback, distributed-worker, or collaborative receipts as completed evidence.

## Competitive Position

Reviewed against first-party product and model documentation on 2026-08-31. **Core** means a first-party primary workflow; **integrated** means the capability exists but is not the product's deepest specialization; **ecosystem** means it is normally assembled through adjacent clients or plugins. Vendor benchmark claims are not treated as First LLM Studio evidence.

| Product | Strongest position | Local runtime / Model Hub | Agent / RAG | Fine-tune / LoRA | Evaluation / operational evidence |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | Evidence-driven local model lifecycle | **Core**, MLX and hardware-aware | **Core**, tools + Compare + ACL/citations | **Core**, recipe-to-best-checkpoint-to-adapter lifecycle | **Core**, Benchmark + lineage + fail-closed release gates |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | Polished desktop discovery and local serving | **Core**, GUI/CLI load, download, unload and compatible APIs | **Integrated** through API, tools and MCP | Not primary | Runtime/developer inspection |
| [Ollama](https://docs.ollama.com/api/introduction) | Simple model runtime and packaging | **Core**, stable local API and model lifecycle | **Ecosystem**, with native tool calling | Not primary | Ecosystem |
| [Open WebUI](https://docs.openwebui.com/features/) | Self-hosted team AI workspace | **Integrated**, multi-provider | **Core**, hybrid RAG, reranking, tools and MCP | Not primary | **Integrated**, arena/A-B/ELO, analytics and OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | Open-source cross-platform desktop assistant | **Core**, llama.cpp/MLX and configurable local server | **Integrated**, agents/projects/MCP | Not primary | Server logs and developer inspection |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG and agent automation | **Integrated**, multi-provider | **Core**, workspaces, flows, skills and scheduled jobs | Not primary | Logs and flow runs |
| [Dify](https://docs.dify.ai/en/develop-plugin/getting-started/choose-plugin-type) | Visual AI application and workflow delivery | **Integrated**, provider/plugin catalog | **Core**, workflows, Agent strategies, knowledge and datasource plugins | Not primary | Application/run inspection |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | Efficient training breadth and depth | Training/inference tooling | Task-focused tool-use tuning | **Core**, broad LoRA/QLoRA and preference methods | **Core** training monitors and benchmark integrations |
| [ModelScope SWIFT](https://swift.readthedocs.io/en/v3.7/Instruction/Evaluation.html) | China model training and multimodal evaluation breadth | Multi-backend training/inference | Task-focused | **Core**, training and multimodal methods | **Core**, EvalScope/OpenCompass/VLMEvalKit adapters |
| [LocalAI](https://localai.io/) | Modular multi-backend private AI runtime | **Core**, broad hardware/backends and distributed workers | **Core**, agents/MCP/RAG/citations | **Integrated** | Runtime and control-plane operations |

Current official model/Agent watchlist: OpenAI `gpt-5.6-sol`; Anthropic `claude-fable-5` / `claude-opus-5` and Managed Agents; Google `gemini-3.7-flash` and Antigravity; DeepSeek `deepseek-v4-pro` / `deepseek-v4-flash`; MiniMax `MiniMax-M2.7`; Kimi `kimi-k2.6`; Zhipu's `glm-5.2` quickstart; and Qwen3-Coder plus Qwen Code Agent Teams. This is an integration watchlist, not a claim that every model is configured or paid for locally.

First LLM Studio's advantage is the connected evidence chain across Agent, Compare, Retrieval, Benchmark, Fine-tune, adapter export, Workflow Studio, and release review. The 15 `v3.8.0-v3.9.4` source contracts now cover capability discovery, explainable routing, Agent conformance/cache, isolated multi-agent plans, sandbox policy, multimodal admission, Model Hub/Local Server v3, governed RAG, training backend federation, Team Studio policy, and a <=14-day competitive freshness gate. Missing real workload and external receipts remain visible as `HOLD`. See the full bilingual [competitive landscape and product direction](./docs/competitive-landscape.md).

## Who It Helps

| Team | Work to finish | Potential value to validate |
| --- | --- | --- |
| Apple Silicon local-AI builders | Select a feasible local model, inspect runtime pressure, and compare a configured remote target. | Fewer manual handoffs between model manager, shell, and comparison notes. |
| Agent and tooling teams | Inspect sessions, target/tool state and replay, then hand a comparison question into evaluation. | Faster separation of model, provider, tool, and runtime failure causes. |
| Fine-tune practitioners | Keep dataset, recipe, job, checkpoint, report, and adapter relationships traceable. | Less manual reconciliation before choosing or exporting an adapter. |
| Evaluation and platform engineers | Review pinned protocols, scorer replay, baselines, run lineage, and release gates. | More reviewable model decisions and fewer score claims without context. |

These are workflow hypotheses, not measured customer ROI or saved-hours claims. Suggested pilot measures and evidence boundaries are in the [product positioning review](./docs/product-tour-and-positioning-2026-10-06.md).

## Core Value

- **One operating loop:** local MLX and configured API targets connect Agent, Compare, Models, Benchmark, and runtime diagnostics.
- **Training with provenance:** datasets and recipes lead to jobs, reports, checkpoints, adapter proof loops, and export; the real archived LoRA run is linked below.
- **Scores with context:** pinned benchmark datasets/evaluators, run history, scorer replay, baselines, and failure review keep a result inspectable.
- **Grounded work and lineage:** Retrieval, Workflow Studio, and Experiments connect citations, typed flows, session/run artifacts, and review notes.
- **Visible limits:** source/local evidence is shown separately from external acceptance, distribution approval, and production authority.

## Current Targets

These are catalog/selection targets, not proof that a model is installed, a remote account is entitled, or a live run has passed acceptance. Check the target status and your own runtime/provider configuration before relying on one.

### Local

- `Local Qwen3 0.6B`
- `Local Qwen3 4B 4-bit`
- `Local Qwen3.5 4B 4-bit`
- `Local Gemma 3 4B It Qat 4-bit`

### Remote

- `OpenAI Codex`
- `OpenAI GPT-5.5`
- `Claude API`
- `DeepSeek API`
- `Kimi API`
- `GLM API`
- `Qwen API`

Selection and stability guidance: [`docs/benchmark-lane-comparison.md`](./docs/benchmark-lane-comparison.md).

Contributor onboarding: [English](./CONTRIBUTING.md) · [中文快速上手](./docs/chinese-contributor-quickstart.md) · [GitHub setup checklist](./docs/github-repository-setup-checklist.md).

## Archived Local-run Evidence (2026-08-30)

The 2026-08-30 archive preserves high-resolution evidence from the application running at that time:

- Runtime Fabric: real MLX, Ollama, and llama.cpp passed 3/3 backends, 6/6 adapter contracts, and 42/42 normalized operations.
- Local Server: real Ollama 0.31.1 + Qwen3 0.6B passed 15/15 slices, 6 requests, 95 tokens, and 169 ms average latency.
- Benchmark smoke: Local Qwen3 0.6B completed 3/3 runs at 192.67 ms first token, 504.67 ms total latency, and 234.02 tokens/s.
- MATH-500: the complete 500-item run scored 500/500 outputs and replayed 500/500 evaluator decisions with 32% local accuracy.
- Fine-tune: the archived real Qwen3 4B LoRA run preserves 816 steps, save/eval markers, and the selected best checkpoint at step 800.

Full metrics, digests, capture dimensions, and evidence boundaries: [`v3.1.4-high-resolution-live-machine-capture-2026-08-30.md`](./docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md). Local source acceptance passes where stated; production promotion remains `HOLD` or `BLOCKED` where independent external evidence is still absent.

## Screenshots

The current gallery was captured on 2026-10-06 from the local `v1.5.1` standalone build with fresh isolated data at `1920 x 1200`. Absolute machine paths in UI text were redacted before capture. These images show **interfaces and empty/starter states**, not new training, benchmark, remote-provider, or production results. [Route-by-route manifest and hashes](./docs/assets/product-tour/2026-10-06/manifest.json).

**Agent:** local/remote target catalog, session shell, and runtime rail.

![Current isolated Agent workbench](./docs/assets/product-tour/2026-10-06/agent.png)

**Compare:** aligned prompt, target-lane, and review controls.

![Current isolated Compare Studio](./docs/assets/product-tour/2026-10-06/compare.png)

**Fine-tune:** starter recipe and training controls; the isolated profile has no completed job.

![Current isolated Fine-tune Studio](./docs/assets/product-tour/2026-10-06/fine-tune.png)

**Benchmark:** protocol catalog and run controls.

![Current isolated Benchmark Studio](./docs/assets/product-tour/2026-10-06/benchmarks.png)

**Models, Retrieval, Experiments, Admin:** [model lifecycle](./docs/assets/product-tour/2026-10-06/models.png) · [knowledge workspace](./docs/assets/product-tour/2026-10-06/retrieval.png) · [evidence timeline](./docs/assets/product-tour/2026-10-06/experiments.png) · [operations desk](./docs/assets/product-tour/2026-10-06/admin.png).

### Archived Local Evidence

The images below are historical local run/capture records, **not** newly measured 2026-10-06 results. The [2026-08-30 capture report](./docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md) records dimensions, validation, and limitations.

**Qwen3 4B LoRA, 2026-07-01:** save/eval markers and selected best checkpoint. [Full archive](./docs/release-evidence/finetune-qwen4b-lora-2026-07-01/README.md).

![Archived Qwen3 4B LoRA chart](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

**MATH-500 local run, 2026-08:** subject/difficulty breakdown, scorer replay, and latency/token view. [Evaluator record](./docs/release-evidence/v1.6.4-official-evaluators-2026-08-10.md).

![Archived MATH-500 reproducibility and performance](./docs/assets/screenshots/math500-reproducibility-performance.png)

**Runtime Fabric / Local Server, 2026-08-30:** [runtime performance](./docs/assets/screenshots/runtime-fabric-live-performance.png) · [Ollama acceptance](./docs/assets/screenshots/local-server-live-acceptance.png). [Workflow Graph](./docs/assets/screenshots/workflow-graph-studio.png) and [MCP acceptance](./docs/assets/screenshots/extension-ecosystem-acceptance.png) remain historical UI captures. The separate [Agent demo](./docs/assets/demo/agent-workbench.mp4) also predates this product film.

## Quick Start

### Requirements

- macOS on Apple Silicon
- Node `22.x`
- Python `3.12`
- MLX-compatible local environment

### Install

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env.local
```

### Start the web app

```bash
npm run dev
```

Default routes:

- [http://localhost:3011/agent](http://localhost:3011/agent)
- [http://localhost:3011/compare](http://localhost:3011/compare)
- [http://localhost:3011/fine-tune](http://localhost:3011/fine-tune)
- [http://localhost:3011/models](http://localhost:3011/models)
- [http://localhost:3011/benchmarks](http://localhost:3011/benchmarks)
- [http://localhost:3011/retrieval](http://localhost:3011/retrieval)
- [http://localhost:3011/experiments](http://localhost:3011/experiments)
- [http://localhost:3011/admin](http://localhost:3011/admin)

### Start the local model gateway

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install mlx mlx-lm
python scripts/local_model_gateway_supervisor.py
```

If your preferred Python is outside `PATH`, set `LOCAL_AGENT_PYTHON_BIN` before starting the app or gateway.

Gateway health:

- [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)

## Verification

```bash
npm run typecheck:changed
npm run smoke:routes
npm run smoke:screenshots
```

## Configuration

Copy `.env.example` to `.env.local` and fill only the providers you want to use.

Important notes:

- `.env.local` is ignored by git.
- Remote providers are optional.
- Several targets use OpenAI-compatible or Claude-compatible endpoints.
- Public defaults in this repository are sanitized placeholders.

## Repository Structure

```text
app/                      Next.js app routes and thin API transports
components/               Shared UI and compatibility shells
features/                 Feature-owned routes, contracts, state, actions, and application ports
lib/agent/                Agent runtime, providers, benchmark, gateway helpers
lib/finetune/             Fine-tune store facade and split operation services
scripts/                  Local gateway, runtime, verification, and release scripts
docs/                     Architecture, release notes, launch notes, roadmap, and assets
modelscope/               ModelScope profile/readme metadata
public/                   Public assets and social cover art
```

## Distribution

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- Default ModelScope repo id: `haozi667788/first-llm-studio`

The ModelScope package script exports the committed Git tree so GitHub and ModelScope can stay file-identical for each synced version.

## Security and Privacy

- Sensitive local actions require confirmation.
- Secrets belong in `.env.local`.
- Public repository defaults are sanitized.
- New public commits should use a GitHub noreply address where possible.
- See [SECURITY.md](./SECURITY.md).

## Contributing

Issues and PRs are welcome.

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/open-source-backlog.md](./docs/open-source-backlog.md)

## Release Notes

- Current version: [`VERSION`](./VERSION)
- Release notes: [`docs/releases`](./docs/releases)
- Release process: [`docs/release-process.md`](./docs/release-process.md)
- Active source: [v1.5.1](./release-state.json); latest public GitHub release: `v0.4.0`; latest desktop candidate: [v1.1.0-rc.2](./docs/releases/v1.1.0-rc.2_2026-07-16.md)

---

# 简体中文

First LLM Studio 是一个面向 Apple Silicon 的本地优先 LLM 工作台。它把本地 MLX 运行时、远端 API 目标、Agent 会话、Compare 对比、Fine-tune 微调、Benchmark 评测、模型发现、runtime 恢复、发布证据和后台监控统一到一个产品界面里。

它不是另一个聊天壳，而是给真正需要比较模型行为、调试 runtime、跑评测、准备 adapter，并把本地/远端模型工作流收在同一个产品循环里的开发者使用。

## 产品入口

| 路由 | 核心工作流 |
| --- | --- |
| `/agent` | 带工具循环的 Agent 会话、target 选择、runtime 状态、replay、trace review，以及内嵌 Compare 入口。 |
| `/compare` | 前台 Compare Studio，负责 prompt 编排、lane preview、recipe 持久化、review drawer 和 benchmark handoff。 |
| `/fine-tune` | 前台 Fine-tune Studio，覆盖数据集、配方、训练、评估、adapter proof loop、导出、报告和 artifacts。 |
| `/models` | 本地/社区模型发现、安装验证、硬件适配和风险提示。 |
| `/benchmarks` | Benchmark run controls、进度、报告、发布证据、baseline 和回归审阅。 |
| `/retrieval` | 前台知识管理、路径导入、chunk 检查和 grounded retrieval 验证。 |
| `/experiments` | 统一 Session/Run 时间线、artifact lineage、跨功能导航、筛选和保留策略。 |
| `/admin` | Runtime、队列、benchmark 历史、provider health、guardrails 和 audit timeline 的监控/配置镜像。 |

## 大版本核心功能

| 版本 | 核心功能 |
| --- | --- |
| `v0.1` 基础版 | 建立本地优先 Web Studio、Apple Silicon/MLX 网关工作流、本地 + 远端 target catalog、runtime telemetry，以及 Agent/Admin 的第一版操作分层。 |
| `v0.2` Agent + Benchmark 运维 | 增强 Agent 工作台、Compare 式 target review、replay/trace 检查、runtime recovery controls、正式 benchmark 运维、baseline 和回归证据。 |
| `v0.3` Fine-tune + 发布证据 | 加入 evaluation、adapter chat、adapter export、distillation starter 等 fine-tune 操作循环；扩展 operation history、分区 typecheck、截图 smoke、route smoke 和公开发布素材。 |
| `v0.4` 产品结构发布版 | 把 `/fine-tune`、`/compare`、`/models`、`/benchmarks`、`/retrieval`、`/experiments` 推进为前台产品路由；迁移 feature-owned state/actions；接通 artifact lineage、导航和 retention；统一 dark-glass studio/workbench 视觉；使用 canonical API；Admin 收口为监控/配置。 |
| `v0.4.1` 稳定基线 | 修复 dataless 工作区导致的启动/编译卡死，保持 route smoke 和 typecheck 通过，刷新 OpenAI-compatible `/v1` 接口、provider 状态回报和当前实机 UI 证据，并归档真实 Qwen3 4B LoRA 训练的 checkpoint/report/chart evidence。 |
| `v0.4.2` 证据补丁 | 正式固化 GitHub/ModelScope 高清截图同步、README 截图 LFS 阈值修复，并保留 v0.4.1 LoRA 证据作为稳定公开基线，同时启动 v0.5.0 开发。 |
| `v0.5` Starter 轨道 | 企业 RAG、部署 registry、OpenAI-compatible API、telemetry、release-readiness gates、生产签收和 control-plane rehearsal 持续放在显式 preview gate 后推进，满足证据门槛后再 promotion。 |
| `v1.0` 一体化 GA 基线 | 统一 Agent、Compare、Model Hub、Retrieval、Fine-tune、Benchmark、Experiments、Admin 监控、thin application API、route ownership、release security 与可复现证据契约。 |
| `v1.1.0-rc.1` 桌面首次启动 | 加入自包含 Apple Silicon app、内置 Node、ZIP/DMG、首次诊断、权限与服务恢复、迁移/更新/回滚/卸载演练、真实 Ollama 本地对话证明和 clean-profile 启动证据；Developer ID notarization 继续作为独立 GA 门禁。 |
| `v1.1.0-rc.2` 桌面分发门禁 | 将 shell 入口替换为原生 arm64 launcher，并加入内部代码/app/DMG 分层签名、双层公证日志、staple/Gatekeeper 验证、独立 Mac 验收脚本及带线下信任锚的 RSA 组织签收；真实外部 receipt 仍是 GA 门禁。 |
| `v1.1.1` Model Hub 生命周期 | 加入不可变多文件 Hub manifest、provider SHA-256 receipt、operator-approved 物理外置盘迁移、ownership manifest 和可视 promotion read model；更新后的 Hub identity receipt 仍是独立门禁。 |
| `v1.2.0` Local Server 验收 | 加入真实 Ollama 15-slice 验收，覆盖进程健康、模型驻留、OpenAI-compatible chat/SSE、并发、计量、访问策略、日志保留、idle eviction 和 unload/reload recovery；跨设备 LAN 与持续 daemon 证据继续作为生产门禁。 |
| `v1.2.1` Runtime Fabric | 用同一标准化合同实现 MLX、Ollama、llama.cpp、LocalAI、vLLM 与 SGLang 适配器；Apple Silicon 上真实 MLX/Ollama/llama.cpp chat 与 SSE 全部通过，硬件或端点不满足时会在执行前给出可操作错误码；外部 LocalAI、Linux/NVIDIA 与异构节点 receipt 继续作为生产门禁。 |
| `v1.3.0` MCP + 安全扩展 | 加入固定版本 MCP server registry、真实 stdio capability discovery、Ed25519 签名安装/升级/回滚、权限与密钥 scope、quarantine、依赖/路径防御及 macOS Seatbelt 强制隔离；本地验收 11/11 PASS，独立 publisher、Linux/Windows sandbox 与远程 OAuth receipt 继续作为生产门禁。 |
| `v1.3.1` Workflow Studio + 信任加固 | 加入类型化可视工作流、不可变发布、安全 worker 恢复/回放、严格 deployment key、标准 OpenAI-compatible 同步/SSE、可原子恢复的 Workflow 存储、常规合同测试、零漏洞依赖门禁，以及保持质量晋级 `HOLD` 的可移植 LoRA 证据。 |
| `v1.4.0` 团队治理 | 加入组织、工作区、角色、用户组、请求身份、乐观并发冲突、数据库级 ACL/RLS 演练、身份映射、策略模拟与不可变审计证据；真实 OIDC/SCIM 与部署后的 PostgreSQL 仍是生产门禁。 |
| `v1.4.1` 质量与训练实验室 | 将冻结多种子评测、置信区间、确定性评分、Quality CI 和训练能力合同绑定到真实已挂载 adapter 与 36 组配对样本；独立 worker 重跑和主观 judge 校准仍是外部门禁。 |
| `v1.5.0` 可信 Artifact 生命周期 | 使用固定 base revision、checksum、provenance、本地 registry 回读、质量声明绑定、安装策略和回滚生命周期封装真实 adapter；组织控制的远端 registry receipt 仍是生产门禁。 |
| `v1.5.1` 企业 HA 与 FinOps | 完成本地 durable usage outbox、token 对账、可安全重试的结算、审计/签名演练、旧主 fencing、standby promotion 与本地 RPO/RTO 测量；托管 billing、跨区 failover、云 KMS/Object Lock 和组织签收继续保持 `HOLD`。 |
| `v1.6.3` Benchmark 资格化检查点 | 固定并校验完整 HuggingFaceH4/MATH-500 test 快照，在 Benchmark Studio 暴露全部 500 个资格化样本，并保留可复现数据 provenance。 |
| `v1.6.4` 官方判分器检查点 | 接入固定版本 Math-Verify 0.9.0 等价判分、逐题可恢复 checkpoint，完成真实 Qwen3 0.6B 500/500 本地运行（32.00%），并提供 MMMU、MathVista、MMBench、Video-MME v2 协议 adapter；多模态全量执行与外部榜单复现继续保持 `HOLD`。 |
| `v1.6.5` Benchmark 复现检查点 | 增加学科/难度 scorecard、Wilson 95% 区间、延迟/token/失败分类、不可变 run 与 evaluator 指纹，并通过新隔离 scorer worker 对 500/500 输出重判且 decision 100% 一致；该结果仍是同机证据，独立 worker 与官方多模态全量运行继续 `HOLD`。 |
| `v1.6.6` Benchmark 决策智能 | 将真实 500 题 run 转成完整错误分类、置信区间 cohort 风险、延迟/token 异常点、有限复核队列、保守统计功效规划，以及带 McNemar 与非劣效策略的配对候选门槛。本地审计验收与候选晋级分开；在出现第二个不同 run id 的完整运行前，候选晋级保持 `EVIDENCE NEEDED`。 |
| `v2.6.0-v2.6.9` 受治理自治就绪度 | 把模型选择、Provider 路由、Grounded Context、扩展权限、受保护动作、Workflow 回放、Benchmark 质量、Adapter 回滚和审计谱系连接为 source-backed、独立复核的 fail-closed 证据链。 |
| `v2.7.0-v2.7.4` 开放生态互操作 | 增加 OpenAI-compatible 客户端、MCP 扩展、模型/产物可移植性、Workspace Identity 与独立闭环合同，同时保持外部部署授权和生产状态严格分离。 |
| `v2.8.0-v2.8.9` 运行整改与效率 | 把 Provider、Retrieval、模型供应链、Workspace 审计、Runtime、Agent、Workflow、Benchmark 与 Fine-tune 的 owner 信号整理为有优先级的整改链，并保留独立终审。 |
| `v2.9.0-v2.9.4` 可持续运行与升级 | 增加遥测/资源透明度、故障诊断与保留、Admin compatibility sunset 就绪度、桌面升级/数据生命周期及独立闭环。 |
| `v3.0.0-v3.0.9` 整改控制面 | 把 7 个未闭环 owner 信号转换成带优先级、依赖、验收条件、下一动作、证据指纹、确定性打包和独立签收的可负责控制项。 |
| `v3.1.0-v3.1.4` 服务就绪 | 增加客户安全的就绪披露、支持诊断、升级变更连续性、运行交接看板和独立闭环，同时不把源码完成冒充生产批准。 |
| `v3.2.0-v3.2.9` 整改执行 | 把 7 个 owner 控制项转换为带确定性幂等、短租约、围栏、回滚、证据打包和独立执行签收的非变更执行计划。 |
| `v3.3.0-v3.3.4` 运营验收 | 增加 SLO/质量策略、事故/变更演练、身份绑定 owner 签收、显式发布决策和前序绑定的独立运营验收。 |
| `v3.4.0-v3.4.9` Owner 工作负载准入 | 为 7 类 owner 工作负载增加严格摘要绑定请求、只读准入、受限 SLA/升级、候选回执校验和独立回执闭环。 |
| `v3.5.0-v3.5.4` 运营决策治理 | 增加证据时效/漂移、依赖解锁影响、owner SLA、不可续期的限时豁免和独立决策闭环。 |
| `v3.6.0-v3.6.9` Owner 回执生命周期 | 增加带鉴权的候选回执接收、仅摘要隔离、乐观并发、补偿绑定与独立账本闭环。 |
| `v3.7.0-v3.7.4` 运营异常治理 | 增加 SLA 超时检测、确认事件、受保护 scope 的豁免到期、决策包与独立异常闭环。 |
| `v3.8.0-v3.8.9` 竞品模型与 Agent 产品列车 | **源码完成 / 待真实证据：** 官方来源注册表、账号能力探测、可解释路由、Agent conformance/state/cache、隔离式团队、沙箱、多模态 evaluator gate、Model Hub v3 和 Local Server v3。 |
| `v3.9.0-v3.9.4` RAG、训练、团队与 freshness 列车 | **源码完成 / 待真实证据：** connector/index 生命周期、成对 RAG 质量反馈、MLX/LLaMA-Factory/SWIFT 后端联邦、受治理 marketplace 和不超过 14 天的竞品 promotion gate。 |
| `v4.0.0-v4.1.4` 证据运营列车 | **源码完成 / 待真实证据：** 为 Provider/路由、真实 Agent 与沙箱、多模态授权评测、模型/runtime 迁移、托管 RAG、联邦训练和团队资产建立严格观测回执，并以 fail-closed 总门禁收口。 |
| `v4.2.0-v4.3.4` 证据采集控制面 | **源码完成 / 待真实证据：** 持久队列、重试围栏、严格提交、复核与导出、Provider 目录和 20 条路由质量/Shadow 回放，以及 8 个 feature-owned 领域执行器均已实现；非 live read model 会在回执提交前拒绝。 |
| `v4.4.0-v4.5.4` 证据审定与保留 | **源码完成 / 待真实证据：** 复核身份、issuer/分离/quorum 策略、产物读回/保留、领域指标审定、复观察、可携导出、撤销与 fail-closed 总门禁。 |
| `v4.6.0-v4.7.4` 证据验收生命周期 | **源码完成 / 待真实证据：** 权威配置、持久包接收、围栏化生命周期、复观察/读回挑战绑定、撤销、可携导入、证据时效与 fail-closed 分发交接。 |
| `v4.8.0-v4.9.4` 权威证据活动 | **源码完成 / 待真实证据：** 非明文凭据引用、严格权威 Profile、信任/轮换/保留合同、十四领域 campaign、观察者分配、nonce 绑定挑战、回执隔离、时效、escrow 覆盖与权威分离。 |
| `v5.0.0-v5.1.4` 外部证据交接 | **源码完成 / 待真实证据：** 仅含摘要的 handoff、权威/归档见证、独立观察者交付、权威 dispatch、签名回执核验、异常 case、续期、决策请求/信封与生产安全互锁。 |
| `v5.2.0-v5.3.4` 外部证据 Relay | **源码完成 / 待真实证据：** 固定 HTTPS Relay 描述符、非明文的一次性凭据解析、有界摘要请求/回执传输、隔离账本、时效/重放防护、14 域对账与不授予生产权限的防火墙。 |
| `v5.4.0-v5.5.4` 外部证据激活 | **源码完成 / 待真实证据：** 绑定 Relay/handoff 的激活清单、严格签名阶段接收、隔离、14 域时效、独立决策请求/回执绑定和生产准入防火墙。 |

当前源码版本：[`v1.5.1`](./VERSION)，源码状态为 `COMPLETE`、本地验收为 `PASS`。机器可读的 [`release-state.json`](./release-state.json) 明确区分当前源码里程碑、最近公开 GitHub Release（`v0.4.0`）与最近桌面候选包（`v1.1.0-rc.2`）。

上一阶段受治理自治与互操作计划：[`v2.6.0-v2.7.4`](./docs/v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md)。这 15 个源码切片只读已有 feature-owned 证据；独立生态签收继续为 `HOLD`，生产状态继续为 `BLOCKED`。

上一阶段受治理自治 source gate：[`v2.6.0-v2.7.4`](./docs/release-evidence/v2.6.0-v2.7.4-governed-interoperability-source-gate-2026-08-29.md) 记录 9 个通过、4 个需关注、0 个不可用和 2 个仅外部可满足的信号；独立外部签收仍为 `0/15`。

上一阶段运行整改计划：[`v2.8.0-v2.9.4`](./docs/v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md)。首轮 owner-controlled 投影记录 6 个通过、7 个需关注、0 个不可用和 2 个仅外部可满足的信号；attention 队列属于明确的产品整改项，独立外部签收仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

上一阶段已验证 source gate：[`v2.8.0-v2.9.4`](./docs/release-evidence/v2.8.0-v2.9.4-operational-sustainability-source-gate-2026-08-30.md) 记录 119/119 测试、73/73 CI 路由、完整跨页面 smoke、桌面/移动浏览器验证与机器可读导出，同时保持相同的 `ATTENTION`/`HOLD`/`BLOCKED` 事实边界。

上一阶段整改控制与服务就绪计划：[`v3.0.0-v3.1.4`](./docs/v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md)。首轮投影为 5 个通过、8 个需关注、0 个不可用和 2 个仅外部可满足；控制面进一步分类为 2 个 satisfied、3 个 open、8 个 blocked 和 2 个 external-only。独立外部签收仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

上一阶段已验证 source gate：[`v3.0.0-v3.1.4`](./docs/release-evidence/v3.0.0-v3.1.4-remediation-service-readiness-source-gate-2026-08-30.md) 记录 125/125 测试、75/75 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证，同时保持 `ATTENTION`/`HOLD`/`BLOCKED` 事实边界。

最新整改执行与运营验收计划：[`v3.2.0-v3.3.4`](./docs/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md)。7 个直接 owner 动作现已具备确定性幂等键、短租约、围栏、回滚和证据指纹；当前投影为 0 个 satisfied、3 个 ready、4 个 blocked。独立外部签收仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

最新已验证 source gate：[`v3.2.0-v3.3.4`](./docs/release-evidence/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-source-gate-2026-08-30.md) 记录 131/131 测试、77/77 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证，同时保持 `ATTENTION`/`HOLD`/`BLOCKED` 事实边界。

当前 Owner 工作负载与运营决策计划：[`v3.4.0-v3.5.4`](./docs/v3.4.0-v3.5.4-owner-workload-operational-decision-plan-2026-08-30.md)。7 类 owner 工作负载现已具备严格请求与候选回执合同；源码投影为 5 个通过、8 个需关注和 2 个仅外部可满足。外部证据仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

当前已验证 source gate：[`v3.4.0-v3.5.4`](./docs/release-evidence/v3.4.0-v3.5.4-owner-workload-operational-decision-source-gate-2026-08-30.md) 记录 137/137 测试、全部 11 个变更 TypeScript 分区、79/79 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证，同时保持 `ATTENTION`/`HOLD`/`BLOCKED` 事实边界。

当前回执与异常生命周期计划：[`v3.6.0-v3.7.4`](./docs/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md)。仓库现在具备带鉴权的 append-only 回执事件、隔离、补偿、升级确认、限时豁免到期和确定性决策包；源码投影为 6 个通过、7 个需关注、2 个仅外部可满足。本轮源码验证未提交真实 owner 回执，外部证据仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

上一阶段已验证 source gate：[`v3.6.0-v3.7.4`](./docs/release-evidence/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-source-gate-2026-08-31.md) 记录 146/146 测试、全部 11 个变更 TypeScript 分区、81/81 CI 路由、完整 smoke、生产构建、发布事实、架构/持久化边界和安全预检。

当前竞品产品计划：[`v3.8.0-v3.9.4`](./docs/v3.8.0-v3.9.4-competitive-product-plan-2026-09-02.md) 已实现 15 个仓库自有契约，并在 `/experiments` 分开显示 source/local/external/production 状态。真实 Provider 账号、workload scorecard、模型传输与 runtime、OS 沙箱、多模态授权数据、托管 RAG、非 MLX 训练 worker、多用户身份和独立签收仍是明确门槛；分发保持 `HOLD`，生产保持 `BLOCKED`。

当前已验证 source gate：[`v3.8.0-v3.9.4`](./docs/release-evidence/v3.8.0-v3.9.4-competitive-product-source-gate-2026-09-02.md) 记录 156/156 测试、全部 11 个变更 TypeScript 分区、85/85 CI 路由、完整 smoke、生产构建、架构/持久化检查和安全预检。源码为 `15/15` 通过；本地证据为 `12/15` 通过，路由质量样本、多模态授权执行和真实 Hub 传输证据继续保持 HOLD。

当前证据运营计划：[`v4.0.0-v4.1.4`](./docs/v4.0.0-v4.1.4-evidence-operations-plan-2026-09-03.md) 新增严格、可持久化的候选回执合同，并在 `/experiments` 分开显示 15 项 source/local/external/production 门禁。候选回执只能闭环本地证据；独立签名、不可变归档回读、分发批准与生产授权继续保持 `HOLD` 或 `BLOCKED`。

最新已验证 source gate：[`v4.0.0-v4.1.4`](./docs/release-evidence/v4.0.0-v4.1.4-evidence-operations-source-gate-2026-09-04.md) 记录 164/164 测试、全部 11 个变更 TypeScript 分区、86/86 CI 路由、完整 smoke、53 页生产构建、架构/持久化检查和已归档的修复后零漏洞安全预检；最新在线审计重跑因 npm registry 超时而正确 fail-closed，并非检出漏洞。源码为 `15/15` 通过；真实本地证据为 `3/15`，候选回执为 `0`，外部签收为 `0/15`，分发继续 `HOLD`，生产继续 `BLOCKED`。

当前证据采集计划：[`v4.2.0-v4.3.4`](./docs/v4.2.0-v4.3.4-evidence-collection-plan-2026-09-05.md)。15 个源码机制均已实现：队列控制、Provider 目录、20 条路由质量/Shadow 执行器、复核/导出和 8 个 feature-owned 领域执行器。领域执行器会在回执提交前拒绝 reference、fixture 与 derived read model；本地确定性控制门禁为 `4/15`，真实 workload 证据仍待采集。不同复核 ID 不等于已认证的独立身份；[验证记录](./docs/release-evidence/v4.2.0-v4.3.4-evidence-collection-source-gate-2026-09-07.md) 区分隔离测试与真实 workload 证据。分发保持 `HOLD`，生产保持 `BLOCKED`。

当前证据审定计划：[`v4.4.0-v4.5.4`](./docs/v4.4.0-v4.5.4-evidence-adjudication-plan-2026-09-07.md)。[`源码门禁记录`](./docs/release-evidence/v4.4.0-v4.5.4-evidence-adjudication-source-gate-2026-09-07.md) 固化了 15 个已实现源码合同与 7 个本地确定性控制；尚无已接受 workload package、外部验证的复核身份、不可变归档读回或独立复观察，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前证据验收生命周期计划：[`v4.6.0-v4.7.4`](./docs/v4.6.0-v4.7.4-evidence-acceptance-plan-2026-09-08.md)。[`源码门禁记录`](./docs/release-evidence/v4.6.0-v4.7.4-evidence-acceptance-source-gate-2026-09-08.md) 固化了 15 个源码合同、8 个本地确定性生命周期控制与生产构建 route-smoke 回执；尚无受控外部权威、不可变归档读回、当前已核验 package、独立观察者或分发批准，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前权威证据活动计划：[`v4.8.0-v4.9.4`](./docs/v4.8.0-v4.9.4-evidence-authority-campaign-plan-2026-09-08.md)。[`源码门禁记录`](./docs/release-evidence/v4.8.0-v4.9.4-evidence-authority-campaign-source-gate-2026-09-08.md) 固化了 15 个源码合同、9 个本地确定性控制与生产构建 route-smoke 证据；尚未配置受控凭据解析器、live authority profile、campaign、外部签收回执、不可变归档读回、独立观察者或分发批准，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前外部证据交接计划：[`v5.0.0-v5.1.4`](./docs/v5.0.0-v5.1.4-external-evidence-handoff-plan-2026-09-08.md)。[`源码门禁记录`](./docs/release-evidence/v5.0.0-v5.1.4-external-evidence-handoff-source-gate-2026-09-08.md) 固化了 15 个源码合同、9 个本地确定性控制与生产构建 route-smoke 证据；尚未配置受控 resolver、权威见证、正式交接、签名核验、不可变归档读回、独立观察者或分发决策，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前外部证据 Relay 计划：[`v5.2.0-v5.3.4`](./docs/v5.2.0-v5.3.4-external-evidence-relay-plan-2026-09-08.md)。[`源码门禁记录`](./docs/release-evidence/v5.2.0-v5.3.4-external-evidence-relay-source-gate-2026-09-08.md) 将端点策略、非明文的一次性凭据解析、严格回执接收、隔离、时效与 14 域对账同真实权威证据分开记录。默认 Relay transport 不可用；尚未配置受控凭据、权威 Relay、不可变归档读回、观察者回执、独立决策、分发批准或生产切换，因此外部继续为 `HOLD`，生产继续为 `BLOCKED`。

当前外部证据激活计划：[`v5.4.0-v5.5.4`](./docs/v5.4.0-v5.5.4-external-evidence-activation-plan-2026-09-09.md)。对应的[`源码门禁记录`](./docs/release-evidence/v5.4.0-v5.5.4-external-evidence-activation-source-gate-2026-09-09.md)将源码、构建和路由证据同独立授权明确分开。它把 Relay/handoff 谱系收紧为激活清单、签名阶段观察、隔离、14 域时效与独立决策请求。默认 activation port 不可用；尚未配置受控 workload identity、权威观察、不可变归档读回、独立观察者、分发决策或生产切换，因此外部继续为 `HOLD`，生产继续为 `BLOCKED`。

内部后续证据已推进到 [`v1.6.6 Benchmark 决策智能检查点`](./docs/release-evidence/v1.6.6-benchmark-decision-intelligence-2026-08-13.md)：500 条结果全部完成分类（160 正确、340 条数学不等价，答案提取覆盖 100%），置信区间规则标出 Intermediate Algebra、Precalculus 与 Level 5 风险，500 样本下的保守可检测变化约为 8.27 个百分点。当前只有一个不同 run id 的完整运行，因此候选晋级继续为 `EVIDENCE NEEDED`。该检查点不改变当前源码版本，也不宣称托管榜单等价、独立主机复现、多模态全量执行、分发或生产晋级。

最新桌面候选说明：[`v1.1.0-rc.2`](./docs/releases/v1.1.0-rc.2_2026-07-16.md)。分发状态继续为 `HOLD`、生产状态继续为 `BLOCKED`；仓库不会把缺失的 Apple、组织、非回环、分布式 worker 或多人协作 receipt 表述为已完成证据。

## 竞品定位对比

本表基于 2026-08-31 可查的官方产品与模型文档。**核心**表示产品原生主流程，**已集成**表示具备能力但不是最深的专长，**生态**表示通常依赖相邻客户端或插件组装。厂商自报 benchmark 不直接算作本项目证据。

| 产品 | 最强定位 | 本地运行时 / Model Hub | Agent / RAG | Fine-tune / LoRA | 评测 / 运维证据 |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | 证据驱动的本地模型全生命周期 | **核心**，MLX 与硬件感知 | **核心**，工具 + Compare + ACL/引用 | **核心**，从 recipe、最佳 checkpoint 到 adapter lifecycle | **核心**，Benchmark、lineage 与 fail-closed 发布门槛 |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | 成熟的桌面模型发现和本地服务 | **核心**，GUI/CLI 加载、下载、卸载和兼容 API | **已集成**，API、工具和 MCP | 非主线 | Runtime / Developer 检查 |
| [Ollama](https://docs.ollama.com/api/introduction) | 简洁稳定的模型运行时与打包 | **核心**，本地 API 与模型生命周期 | **生态**，原生支持 tool calling | 非主线 | 生态提供 |
| [Open WebUI](https://docs.openwebui.com/features/) | 面向团队的自托管 AI 工作区 | **已集成**，多 provider | **核心**，混合 RAG、reranker、工具和 MCP | 非主线 | **已集成**，Arena/A-B/ELO、分析和 OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | 开源跨平台桌面助手 | **核心**，llama.cpp/MLX 与可配置 Local Server | **已集成**，Agent/Project/MCP | 非主线 | Server 日志与开发检查 |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG 与 Agent 自动化 | **已集成**，多 provider | **核心**，Workspace、Flow、Skill 和定时任务 | 非主线 | 日志与 Flow Run |
| [Dify](https://docs.dify.ai/en/develop-plugin/getting-started/choose-plugin-type) | 可视化 AI 应用与 workflow 交付 | **已集成**，provider/plugin catalog | **核心**，Workflow、Agent Strategy、Knowledge 与 datasource plugin | 非主线 | 应用与运行检查 |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | 高效训练的模型/方法覆盖深度 | 训练与推理工具 | 面向任务的工具调用训练 | **核心**，广泛 LoRA/QLoRA 与偏好训练 | **核心**，训练监控与 benchmark 集成 |
| [ModelScope SWIFT](https://swift.readthedocs.io/en/v3.7/Instruction/Evaluation.html) | 国内模型训练与多模态评测广度 | 多后端训练/推理 | 面向任务 | **核心**，训练与多模态方法 | **核心**，EvalScope/OpenCompass/VLMEvalKit 适配 |
| [LocalAI](https://localai.io/) | 模块化、多后端的私有 AI runtime | **核心**，广硬件/后端和分布式 worker | **核心**，Agent/MCP/RAG/引用 | **已集成** | Runtime 与控制面运维 |

当前官方模型/Agent 雷达包括 OpenAI `gpt-5.6-sol`、Anthropic `claude-fable-5` / `claude-opus-5` 与 Managed Agents、Google `gemini-3.7-flash` 与 Antigravity、DeepSeek V4、MiniMax M2.7、Kimi K2.6、智谱 `glm-5.2` 以及 Qwen3-Coder / Qwen Code Agent Team。它只是 provider 集成雷达，不代表本机已配置或已购买全部模型。

First LLM Studio 的优势是统一证据链。`v3.8.0-v3.9.4` 的 15 个源码契约现已覆盖 Provider 型号漂移、Agent conformance/cache、多 Agent 隔离计划、沙箱策略、Local Server、RAG 生命周期、训练后端联邦、团队资产策略与不超过 14 天的竞品 freshness gate；缺少的真实 workload 和外部回执继续显示为 `HOLD`。完整方法、优劣势、官方来源和版本顺序见：[竞品格局与产品方向](./docs/competitive-landscape.md)。

## 对哪些用户有价值

| 面向谁 | 要完成的工作 | 待试点验证的潜在价值 |
| --- | --- | --- |
| Apple Silicon 本地 AI 开发者 | 选择可运行的本地模型，查看运行时压力，并对比已配置的远端目标。 | 减少模型管理器、命令行和对比笔记之间的手工切换。 |
| Agent / 工具链团队 | 检查会话、target/工具状态与回放，再把对比问题交给评测。 | 更快区分模型、Provider、工具与运行时问题。 |
| 微调实践者 | 追踪数据集、配方、作业、checkpoint、报告和 adapter 的关系。 | 决策或导出 adapter 前，减少手工核对产物。 |
| 评测 / 平台工程师 | 检查固定协议、判分器重放、baseline、运行来路与发布门槛。 | 减少脱离上下文的分数宣称，使模型决策更易复核。 |

这些是工作流价值假设，不是已测得的客户 ROI 或节省工时。试点度量方式和证据边界见[产品定位复查](./docs/product-tour-and-positioning-2026-10-06.md)。

## 核心价值

- **一条操作链：** 本地 MLX 与已配置的 API 目标连接 Agent、Compare、Models、Benchmark 和运行时诊断。
- **训练可追溯：** 数据集、配方、作业、报告、checkpoint、adapter 验证与导出相连；历史真实 LoRA 运行证据见下方。
- **分数有上下文：** 固定的评测数据/判分器、运行历史、重放、baseline 与失败审阅共同解释结果。
- **知识与产物有来路：** Retrieval、Workflow Studio 与 Experiments 串起引用、类型化流程、运行产物和审阅记录。
- **限制看得见：** 源码/本地证据与外部签收、分发批准、生产授权分开呈现。

## 当前支持的 Target

以下是目录/选择目标，不代表模型已安装、远端账号已有权限或实机运行通过验收。实际可用性以目标状态及本机运行时/供应商配置为准。

### 本地

- `Local Qwen3 0.6B`
- `Local Qwen3 4B 4-bit`
- `Local Qwen3.5 4B 4-bit`
- `Local Gemma 3 4B It Qat 4-bit`

### 远端

- `OpenAI Codex`
- `OpenAI GPT-5.5`
- `Claude API`
- `DeepSeek API`
- `Kimi API`
- `GLM API`
- `Qwen API`

Target 选择、稳定性与适用任务对照：[`docs/benchmark-lane-comparison.md`](./docs/benchmark-lane-comparison.md)。

贡献者入口：[English](./CONTRIBUTING.md) · [中文快速上手](./docs/chinese-contributor-quickstart.md) · [GitHub 仓库设置清单](./docs/github-repository-setup-checklist.md)。

## 历史本地运行证据（2026-08-30）

2026-08-30 的归档保留了当时运行应用生成的高清本地材料：

- Runtime Fabric：真实 MLX、Ollama、llama.cpp 3/3 后端通过，adapter contract 6/6，标准化操作 42/42。
- Local Server：真实 Ollama 0.31.1 + Qwen3 0.6B 通过 15/15 项，完成 6 个请求、95 tokens，平均延迟 169 ms。
- Benchmark smoke：Local Qwen3 0.6B 完成 3/3 次运行，首 token 192.67 ms，总延迟 504.67 ms，吞吐 234.02 tokens/s。
- MATH-500：完整 500 题输出全部判分，官方等价判分器决定 500/500 重放一致，本地准确率 32%。
- Fine-tune：真实 Qwen3 4B LoRA 归档保留 816 steps、save/eval 事件和 step 800 最佳 checkpoint。

完整指标、摘要、截图尺寸与证据边界见：[`v3.1.4-high-resolution-live-machine-capture-2026-08-30.md`](./docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md)。已通过的项目仅代表本地源码/实机验收；缺少独立外部证据的生产晋级继续保持 `HOLD` 或 `BLOCKED`。

## 截图

当前图库于 2026-10-06 从 `v1.5.1` 本地独立构建抓取，使用全新隔离数据目录，尺寸为 `1920 x 1200`。导出前仅替换了 UI 文本中的本机绝对路径。这些图展示的是**界面与空白/入门状态**，不是新训练、新评测、远端 Provider 实测或生产结果。[逐路由清单与摘要](./docs/assets/product-tour/2026-10-06/manifest.json)。

**Agent：** 本地/远端目标目录、会话工作区与运行时侧栏。

![当前隔离环境的 Agent 工作台](./docs/assets/product-tour/2026-10-06/agent.png)

**Compare：** 对齐提示词、目标 lane 与审阅控制项。

![当前隔离环境的 Compare Studio](./docs/assets/product-tour/2026-10-06/compare.png)

**Fine-tune：** 入门配方与训练控制；隔离环境没有已完成新作业。

![当前隔离环境的 Fine-tune Studio](./docs/assets/product-tour/2026-10-06/fine-tune.png)

**Benchmark：** 协议目录与运行控制。

![当前隔离环境的 Benchmark Studio](./docs/assets/product-tour/2026-10-06/benchmarks.png)

**其他当前界面：** [模型生命周期](./docs/assets/product-tour/2026-10-06/models.png) · [知识工作区](./docs/assets/product-tour/2026-10-06/retrieval.png) · [实验证据](./docs/assets/product-tour/2026-10-06/experiments.png) · [后台监控](./docs/assets/product-tour/2026-10-06/admin.png)。

### 历史本地运行证据

以下图片属于归档运行/抓图记录，**不是** 2026-10-06 新跑出的指标。[2026-08-30 抓图报告](./docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md)记录尺寸、验证和限制。

**2026-07-01 Qwen3 4B LoRA：** save/eval 标记与最佳 checkpoint。[完整归档](./docs/release-evidence/finetune-qwen4b-lora-2026-07-01/README.md)。

![历史 Qwen3 4B LoRA 曲线](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

**2026-08 MATH-500 本地运行：** 学科/难度分层、判分器重放和延迟/token 视图。[评测记录](./docs/release-evidence/v1.6.4-official-evaluators-2026-08-10.md)。

![历史 MATH-500 可复现性与性能](./docs/assets/screenshots/math500-reproducibility-performance.png)

**2026-08-30 Runtime Fabric / Local Server：** [运行时性能](./docs/assets/screenshots/runtime-fabric-live-performance.png) · [Ollama 验收](./docs/assets/screenshots/local-server-live-acceptance.png)。[Workflow Graph](./docs/assets/screenshots/workflow-graph-studio.png)和[MCP 验收](./docs/assets/screenshots/extension-ecosystem-acceptance.png)也保留为历史界面截图。另有早于本宣传片的 [Agent 动态演示](./docs/assets/demo/agent-workbench.mp4)。

## 快速开始

### 环境要求

- Apple Silicon macOS
- Node `22.x`
- Python `3.12`
- 可运行 MLX 的本地环境

### 安装

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env.local
```

### 启动 Web 应用

```bash
npm run dev
```

默认入口：

- [http://localhost:3011/agent](http://localhost:3011/agent)
- [http://localhost:3011/compare](http://localhost:3011/compare)
- [http://localhost:3011/fine-tune](http://localhost:3011/fine-tune)
- [http://localhost:3011/models](http://localhost:3011/models)
- [http://localhost:3011/benchmarks](http://localhost:3011/benchmarks)
- [http://localhost:3011/retrieval](http://localhost:3011/retrieval)
- [http://localhost:3011/experiments](http://localhost:3011/experiments)
- [http://localhost:3011/admin](http://localhost:3011/admin)

### 启动本地模型网关

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install mlx mlx-lm
python scripts/local_model_gateway_supervisor.py
```

如果 Python 不在 `PATH` 中，可以在启动前设置 `LOCAL_AGENT_PYTHON_BIN` 指向实际解释器。

网关健康检查：

- [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)

## 验证

```bash
npm run typecheck:changed
npm run smoke:routes
npm run smoke:screenshots
```

## 配置说明

把 `.env.example` 复制成 `.env.local`，只填写你要启用的 provider 即可。

需要注意：

- `.env.local` 已被 git 忽略。
- 远端 provider 是可选的。
- 部分 target 走 OpenAI-compatible / Claude-compatible endpoint。
- 本仓库公开版本已经做过脱敏，占位值需要替换成你自己的 endpoint。

## 仓库结构

```text
app/                      Next.js app routes 与 thin API transports
components/               共享 UI 与兼容 shell
features/                 feature-owned routes、contracts、state、actions、application ports
lib/agent/                Agent runtime、providers、benchmark、gateway helpers
lib/finetune/             Fine-tune store facade 与拆分后的 operation services
scripts/                  本地网关、runtime、验证和发布脚本
docs/                     架构、release notes、launch notes、roadmap 和 assets
modelscope/               ModelScope 主页/readme 元数据
public/                   对外资源和社媒封面图
```

## 发布与同步

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- 默认 ModelScope repo id: `haozi667788/first-llm-studio`

ModelScope 打包脚本会导出已提交的 Git tree，因此每次同步都可以让 GitHub 和 ModelScope 保持同一份文件快照。

## 安全和隐私

- 敏感本地操作默认需要确认。
- Secret 应保存在 `.env.local`。
- 公开仓库默认配置已经做过脱敏。
- 新增公开提交应尽量使用 GitHub noreply 地址。
- 见 [SECURITY.md](./SECURITY.md)。

## 贡献

欢迎 issue 和 PR。

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/open-source-backlog.md](./docs/open-source-backlog.md)

## 发布说明

- 当前版本：[`VERSION`](./VERSION)
- Release notes：[`docs/releases`](./docs/releases)
- 发布流程：[`docs/release-process.md`](./docs/release-process.md)
- 当前源码：[v1.5.1](./release-state.json)；最近公开 GitHub Release：`v0.4.0`；最近桌面候选包：[v1.1.0-rc.2](./docs/releases/v1.1.0-rc.2_2026-07-16.md)
