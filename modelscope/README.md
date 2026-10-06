# First LLM Studio

> English | [简体中文](#简体中文)

**Local-first model work, from target selection to reviewable evidence. / 本地优先模型工作，从目标选择到可复查证据。**

<p align="center">
  <a href="../docs/assets/product-tour/first-llm-studio-promo.mp4">
    <img src="../docs/assets/product-tour/first-llm-studio-promo.gif" alt="First LLM Studio bilingual product film" width="760">
  </a>
</p>

[Watch the 30-second film with original sound / 观看 30 秒原创配乐短片](../docs/assets/product-tour/first-llm-studio-promo.mp4) · [Creative review and data sources / 设计复查与数据来源](../docs/product-film-creative-review-2026-10-06.md) · [Current UI / 当前实机界面](../docs/product-tour-and-positioning-2026-10-06.md)

The new film uses full-bleed 3D model art, large data typography, checkpoint curves, a 500-sample field, and illustrative runtime traces, not tiny screenshots. Numeric highlights come from labeled historical local evidence; scorer replay agreement is not model accuracy. / 新版采用全幅立体模型、大字号数据、训练曲线、500 点评测阵列与示意运行时波形，不再拼贴缩小截图。数字来自标注日期的历史本地证据；评分回放一致率不等于模型准确率，小样本性能也不是普遍承诺。

---

Latest development batch: [v5.8.0-v5.9.4 Activation Operations](../docs/v5.8.0-v5.9.4-activation-operations-plan-2026-09-10.md). Signed intake now has pinned operational policy/trust snapshots, authority rotation, freshness/conflict projection, leased quarantine, review quorum, one-shot decisions, a non-authorizing firewall, and secret-free audit export/merge. Organization evidence remains required; distribution is `HOLD` and production is `BLOCKED`. [Operator guide](../docs/activation-operations-operator-guide.md).

最新开发批次：[v5.8.0-v5.9.4 激活运营](../docs/v5.8.0-v5.9.4-activation-operations-plan-2026-09-10.md)。签名接收现已增加运营策略/信任快照、权威轮换、时效/冲突投影、隔离租约、审阅门槛、一次性决策、不授权防火墙和不含密钥的审计导出/合并。组织证据仍需提供，分发保持 `HOLD`，生产保持 `BLOCKED`。[操作说明](../docs/activation-operations-operator-guide.md)。

Latest development batch: [v5.6.0-v5.7.4 Verified Activation Intake](../docs/v5.6.0-v5.7.4-activation-intake-plan-2026-09-09.md). Actual Ed25519 verification, server-owned trust pins, atomic import/preview, durable replay protection, independent domain pairing, renewal/revocation, signed quarantine resolution, and reverified backup merge are shared by the Experiments inbox and CLI. Source milestones retain distribution HOLD and production BLOCKED pending organization evidence. [Operator guide](../docs/activation-intake-operator-guide.md).

最新开发批次：[v5.6.0-v5.7.4 签名证据接收](../docs/v5.6.0-v5.7.4-activation-intake-plan-2026-09-09.md)。真实 Ed25519 验签、服务端受信公钥、原子导入/预检、持久化重放防护、独立证据配对、续期/撤销、签名隔离处理和重新验签备份合并已接入 Experiments 与 CLI。以上为源码里程碑，组织证据仍待提供，分发保持 HOLD，生产保持 BLOCKED。[操作说明](../docs/activation-intake-operator-guide.md)。

A local-first LLM studio for Apple Silicon that brings MLX local runtimes, remote API comparison, Agent sessions, Compare Lab, Fine-tune/LoRA, Benchmark, model discovery, Retrieval, Experiments, replay, trace review, runtime recovery, and telemetry into one workspace.

![First LLM Studio model training, evaluation, and runtime performance overview](../docs/assets/github-hero-data.png)

> The dashboard uses illustrative sample telemetry for product presentation; measured workflows and release evidence remain documented separately.

## Current Release

Current source version: `v1.5.1`; latest public GitHub release: `v0.4.0`; latest desktop candidate: `v1.1.0-rc.2`. Distribution is `HOLD` and production is `BLOCKED`; these are separate fields in [`release-state.json`](../release-state.json).

The desktop candidate includes an Apple Silicon app package, first-run and recovery flows, and local Ollama proof. Developer ID/notarization and independent organization acceptance remain open gates; later source batches are not new public releases.

## Product Surfaces

| Surface | Core workflow |
| --- | --- |
| Agent | Tool-enabled sessions, target catalog, runtime rail, replay, trace review, and embedded Compare entry. |
| Compare | Prompt composer, lane preview, recipe persistence, review drawer, and benchmark handoff. |
| Fine-tune | Datasets, recipes, training, evaluation, adapter proof loops, export, reports, artifacts, and LoRA chart evidence. |
| Models | Community/local model discovery, install verification, hardware fit, runtime profiles, request logs, and idle-unload state. |
| Benchmarks | Run controls, progress, baselines, reports, release evidence, fatal-target skip handling, and regression review. |
| Retrieval | Local knowledge import, chunk inspection, permission-aware retrieval, citations, and grounded query validation. |
| Experiments | Unified session/run timeline, artifact lineage, cross-links, navigation, filters, and retention. |
| Admin | Monitoring/configuration mirror for runtime, queues, provider health, compatibility usage, guardrails, and audit timelines. |

## Use Cases and Value

| For | Work to finish | Value hypothesis to test |
| --- | --- | --- |
| Apple Silicon local-AI builders | Choose a feasible local model and compare configured remote targets with runtime context. | Fewer manual handoffs between model manager, shell, and comparison notes. |
| Agent and tooling teams | Inspect sessions, target/tool state, replay, and comparison handoff. | Faster isolation of model, provider, tool, and runtime causes. |
| Fine-tune practitioners | Trace dataset, recipe, job, checkpoint, report, and adapter relationships. | Less manual artifact reconciliation. |
| Evaluation/platform engineers | Review pinned protocols, scorer replay, baselines, lineage, and release gates. | More reviewable model decisions. |

No measured customer ROI, saved hours, or production outcome is claimed. [Full bilingual positioning and pilot measures](../docs/product-tour-and-positioning-2026-10-06.md).

## Major Versions

| Version | Core capabilities |
| --- | --- |
| `v0.1` | Local-first studio foundation, MLX gateway workflow, target catalog, telemetry, and Agent/Admin split. |
| `v0.2` | Agent workbench expansion, Compare-style review, replay/trace inspection, runtime recovery, benchmark ops, baselines, and regression evidence. |
| `v0.3` | Fine-tune operation loops, adapter chat/export, distillation starters, operation history, partitioned typechecks, route/screenshot smoke, and launch assets. |
| `v0.4` | Foreground `/fine-tune`, `/compare`, `/models`, `/benchmarks`, `/retrieval`, and `/experiments`; feature-owned state/actions; artifact lineage; dark-glass studio/workbench style; canonical APIs with deprecated Admin compatibility wrappers. |
| `v0.4.1` | Stability baseline with dataless recovery, runtime/status fixes, real Qwen3 4B LoRA evidence, checkpoint/report/chart exports, and refreshed high-resolution screenshots. |
| `v0.4.2` | Evidence patch for GitHub/ModelScope high-resolution screenshot sync, README LFS threshold hygiene, and the first v0.5.0 Provider Health Desk v2 + Adapter Export wizard slice. |
| `v0.5` | Preview-gated Enterprise RAG, deployment registry, OpenAI-compatible API, telemetry, release-readiness gates, production attestation, quota, audit, and control-plane rehearsals. |
| `v1.0` | Integrated Agent, Compare, Model Hub, RAG, Fine-tune, Benchmark, Experiments, Admin monitoring, application APIs, route ownership, and release-evidence baseline. |
| `v1.1.0-rc.1` | Self-contained Apple Silicon app, bundled Node runtime, ZIP/DMG, first-run and lifecycle orchestration, real local-chat proof, and clean-profile boot evidence; notarization remains a GA gate. |
| `v1.1.0-rc.2` | Native arm64 launcher, nested-code/app/DMG signing workflow, dual notarization logs, staple/Gatekeeper verification, external-Mac runner, and RSA organization receipts with an out-of-band trust pin; real external evidence still gates GA. |
| `v2.4.x` | AI operations intelligence that reads real Runtime, Provider, SLO, token/cost, Benchmark, Retrieval, Agent, Workflow, and Fine-tune signals while keeping independent signed review on HOLD. |
| `v2.5.0-v2.5.4` | Deployment lifecycle contracts for portability, data sovereignty, customer keys, continuity/exit, and independent closure; production authority remains external and BLOCKED. |
| `v2.6.0-v2.6.9` | Governed autonomy readiness for model choice, provider routing, grounded context, tool permissions, protected actions, Workflow replay, quality, adapter rollback, audit provenance, and independent review. |
| `v2.7.0-v2.7.4` | Open ecosystem interoperability for OpenAI-compatible clients, MCP extensions, portable models/artifacts, workspace identity, and independent closure. |
| `v2.8.0-v2.8.9` | Operational remediation for Provider, Retrieval, model supply-chain, workspace audit, runtime, Agent, Workflow, Benchmark, and Fine-tune evidence. |
| `v2.9.0-v2.9.4` | Sustainable operations for telemetry, incident diagnostics, Admin compatibility sunset, desktop upgrade/data lifecycle, and independent closure. |
| `v3.0.0-v3.0.9` | Remediation control plane with owners, priorities, dependencies, acceptance checks, next actions, evidence fingerprints, deterministic packaging, and independent acceptance. |
| `v3.1.0-v3.1.4` | Service-readiness disclosure, support diagnostics, upgrade/change continuity, operational transition, and independent closure. |
| `v3.2.0-v3.2.9` | Idempotent, lease/fencing-protected, rollback-bound owner remediation execution and independent execution acceptance. |
| `v3.3.0-v3.3.4` | SLO/quality policy, incident/change rehearsal, owner sign-off, release decision, and independent operational acceptance. |
| `v3.4.0-v3.4.9` | Strict digest-bound owner workload requests, dry-run admission, candidate receipt validation, and independent receipt closure. |
| `v3.5.0-v3.5.4` | Evidence freshness/drift, dependency impact, owner SLA, bounded waivers, and independent decision closure. |
| `v3.6.0-v3.6.9` | Authenticated candidate receipt intake, digest-only quarantine, optimistic concurrency, compensation, and independent ledger closure. |
| `v3.7.0-v3.7.4` | SLA breach detection, acknowledgement events, bounded waiver expiry, decision packages, and independent exception closure. |
| `v3.8.0-v3.8.9` | **Source-complete / evidence-needed:** official-source registry, provider discovery/routing, Agent conformance/cache, isolated teams, sandboxing, multimodal admission, Model Hub v3, and Local Server v3. |
| `v3.9.0-v3.9.4` | **Source-complete / evidence-needed:** governed RAG lifecycle/quality, MLX/LLaMA-Factory/SWIFT federation, governed marketplace policy, and a <=14-day competitive promotion gate. |
| `v4.0.0-v4.1.4` | **Source-complete / evidence-needed:** strict observed receipts for provider/workload routing, live Agent/sandbox behavior, licensed multimodal evaluation, model/runtime transfer, managed RAG, federated training, team assets, and aggregate promotion. |
| `v4.2.0-v4.3.4` | **Source-complete / evidence-needed:** durable queue, retry fencing, strict submission, review/export, executable Provider catalog discovery and routing quality/shadow replay, plus eight feature-owned domain collectors that reject non-live read models before receipt submission. |
| `v4.4.0-v4.5.4` | **Source-complete / evidence-needed:** reviewer attestation, issuer/separation/quorum policy, artifact read-back/retention, domain metric adjudication, re-observation, portable export, revocation, and a fail-closed aggregate gate. |
| `v4.6.0-v4.7.4` | **Source-complete / evidence-needed:** authority configuration, durable package intake, fenced lifecycle, re-observation/read-back challenge binding, revocation, portable import, evidence aging, and a fail-closed distribution handoff. |
| `v4.8.0-v4.9.4` | **Source-complete / evidence-needed:** opaque credential references, strict authority profiles, trust/rotation/retention contracts, fourteen-domain campaigns, observer assignments, nonce-bound challenges, receipt quarantine, freshness, escrow coverage, and authority separation. |
| `v5.0.0-v5.1.4` | **Source-complete / evidence-needed:** digest-only handoffs, authority/archive witnesses, independent observer delivery, authority dispatch, signed receipt verification, discrepancy cases, renewal, decision requests/envelopes, and a production safety interlock. |
| `v5.2.0-v5.3.4` | **Source-complete / evidence-needed:** pinned HTTPS relay descriptors, opaque one-shot credential resolution, bounded digest-only request/receipt transport, quarantine, freshness/replay defense, fourteen-domain reconciliation, and a non-authorizing production firewall. |
| `v5.4.0-v5.5.4` | **Source-complete / evidence-needed:** relay/handoff-bound activation manifests, strict signed stage intake, quarantine, fourteen-domain currentness, separate decision request/receipt binding, and a production admission firewall. |

Evidence: [`v2.4.0-v2.5.4 operational lifecycle source gate`](../docs/release-evidence/v2.4.0-v2.5.4-operational-lifecycle-source-gate-2026-08-29.md) records 8 passing, 5 attention, and 2 external-only local signals; externally verified records remain `0/15`.

Plan: [`v2.6.0-v2.7.4 governed autonomy and interoperability`](../docs/v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md) adds 15 source-backed slices while independent ecosystem evidence remains `HOLD` and production remains `BLOCKED`.

Source gate: [`v2.6.0-v2.7.4`](../docs/release-evidence/v2.6.0-v2.7.4-governed-interoperability-source-gate-2026-08-29.md) records 9 pass, 4 attention, 0 unavailable, and 2 external-only signals; independently verified records remain `0/15`.

Previous plan: [`v2.8.0-v2.9.4 operational remediation and sustainability`](../docs/v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md) projects 6 pass, 7 attention, 0 unavailable, and 2 external-only owner signals. Independent evidence remains `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Validated source gate: [`v2.8.0-v2.9.4`](../docs/release-evidence/v2.8.0-v2.9.4-operational-sustainability-source-gate-2026-08-30.md) records 119/119 tests, 73/73 CI routes, full smoke, desktop/mobile browser QA, and the machine-readable evidence export.

Previous plan: [`v3.0.0-v3.1.4 remediation control and service readiness`](../docs/v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md) reports 5 pass, 8 attention, 0 unavailable, and 2 external-only signals. The control plane classifies 2 satisfied, 3 open, 8 blocked, and 2 external-only items; independent evidence remains `0/15` and production remains `BLOCKED`.

Previous validated source gate: [`v3.0.0-v3.1.4`](../docs/release-evidence/v3.0.0-v3.1.4-remediation-service-readiness-source-gate-2026-08-30.md) records 125/125 tests, 75/75 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA.

Latest plan: [`v3.2.0-v3.3.4 remediation execution and operational acceptance`](../docs/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md) gives seven owner actions deterministic idempotency, bounded leases, fencing, rollback, and evidence fingerprints. Current action state is 0 satisfied, 3 ready, and 4 blocked; independent evidence remains `0/15` and production remains `BLOCKED`.

Latest validated source gate: [`v3.2.0-v3.3.4`](../docs/release-evidence/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-source-gate-2026-08-30.md) records 131/131 tests, 77/77 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA.

Current plan: [`v3.4.0-v3.5.4 owner workload and operational decision governance`](../docs/v3.4.0-v3.5.4-owner-workload-operational-decision-plan-2026-08-30.md) adds strict request and candidate receipt contracts for seven owner workloads. The source projection is 5 pass, 8 attention, and 2 external-only; external evidence remains `0/15` and production remains `BLOCKED`.

Current validated source gate: [`v3.4.0-v3.5.4`](../docs/release-evidence/v3.4.0-v3.5.4-owner-workload-operational-decision-source-gate-2026-08-30.md) records 137/137 tests, all 11 changed TypeScript partitions, 79/79 CI routes, full smoke, production build, security preflight, and desktop/mobile browser QA.

Current plan: [`v3.6.0-v3.7.4 owner receipt and exception lifecycle`](../docs/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md) adds authenticated append-only receipt events, quarantine, compensation, escalation acknowledgement, bounded waiver expiry, and deterministic decision packages. The source projection is 6 pass, 7 attention, and 2 external-only; no real owner receipt was submitted during source validation, external evidence remains `0/15`, and production remains `BLOCKED`.

Current competitive product plan: [`v3.8.0-v3.9.4`](../docs/v3.8.0-v3.9.4-competitive-product-plan-2026-09-02.md) implements all 15 repository-owned contracts while retaining real provider, runtime, multimodal, managed RAG/training, organization, distribution, and production evidence as separate `HOLD` gates.

Current validated source gate: [`v3.8.0-v3.9.4`](../docs/release-evidence/v3.8.0-v3.9.4-competitive-product-source-gate-2026-09-02.md) records 156/156 tests, all 11 changed TypeScript partitions, 85/85 CI routes, full smoke, production build, architecture/durable-state checks, and security preflight. Source is `15/15` pass; local evidence is `12/15` pass with routing-quality, licensed multimodal, and real Hub-transfer evidence held.

Current evidence-operations plan: [`v4.0.0-v4.1.4`](../docs/v4.0.0-v4.1.4-evidence-operations-plan-2026-09-03.md) exposes 15 source/local/external/production gates and strict durable candidate intake. Candidate receipts can close local evidence only; independent signatures, immutable archive read-back, distribution, and production authority remain fail-closed.

Latest validated source gate: [`v4.0.0-v4.1.4`](../docs/release-evidence/v4.0.0-v4.1.4-evidence-operations-source-gate-2026-09-04.md) records 164/164 tests, all 11 changed TypeScript partitions, 86/86 CI routes, full smoke, a 53-page production build, architecture/durable-state checks, and an archived zero-vulnerability security preflight. The latest online-audit rerun failed closed on an npm registry timeout, not a detected vulnerability. Source is `15/15`; observed local evidence is `3/15`, candidates are `0`, external verification is `0/15`, distribution remains `HOLD`, and production remains `BLOCKED`.

Current evidence-collection plan: [`v4.2.0-v4.3.4`](../docs/v4.2.0-v4.3.4-evidence-collection-plan-2026-09-05.md). All 15 source mechanisms are implemented: queue controls, Provider catalog execution, 20-sample routing/shadow replay, review/export, and eight feature-owned domain collectors. The domain collectors reject reference, fixture, and derived read models before receipt submission; four deterministic control gates pass locally, while real workload evidence remains needed. Distinct reviewer IDs are not verified independent principals. The [validation record](../docs/release-evidence/v4.2.0-v4.3.4-evidence-collection-source-gate-2026-09-07.md) separates isolated transport tests from real workload evidence. Distribution remains `HOLD`; production remains `BLOCKED`.

Current evidence-adjudication plan: [`v4.4.0-v4.5.4`](../docs/v4.4.0-v4.5.4-evidence-adjudication-plan-2026-09-07.md). The [`source-gate record`](../docs/release-evidence/v4.4.0-v4.5.4-evidence-adjudication-source-gate-2026-09-07.md) records all 15 implemented contracts and seven deterministic local controls. No accepted workload package, externally verified reviewer, immutable archive read-back, or independent re-observation is present, so the external and production states remain `HOLD` / `BLOCKED`.

Current evidence-acceptance plan: [`v4.6.0-v4.7.4`](../docs/v4.6.0-v4.7.4-evidence-acceptance-plan-2026-09-08.md). The [`source-gate record`](../docs/release-evidence/v4.6.0-v4.7.4-evidence-acceptance-source-gate-2026-09-08.md) records all 15 source contracts, eight deterministic lifecycle controls, and the production-build route-smoke receipt. No controlled authority, immutable archive read-back, current externally verified package, independent observer, or distribution approval is present, so external and production states remain `HOLD` / `BLOCKED`.

Current evidence-authority campaign plan: [`v4.8.0-v4.9.4`](../docs/v4.8.0-v4.9.4-evidence-authority-campaign-plan-2026-09-08.md). The [`source-gate record`](../docs/release-evidence/v4.8.0-v4.9.4-evidence-authority-campaign-source-gate-2026-09-08.md) records all 15 source contracts, nine deterministic controls, and production-build route-smoke evidence. No controlled credential resolver, live authority profile, campaign, externally attested receipt, immutable archive read-back, independent observer, or distribution approval is configured, so external and production states remain `HOLD` / `BLOCKED`.

Current external evidence handoff plan: [`v5.0.0-v5.1.4`](../docs/v5.0.0-v5.1.4-external-evidence-handoff-plan-2026-09-08.md). The [`source-gate record`](../docs/release-evidence/v5.0.0-v5.1.4-external-evidence-handoff-source-gate-2026-09-08.md) records all 15 source contracts, nine deterministic controls, and production-build route-smoke evidence. No controlled resolver, witness, handoff, signed verification, immutable archive read-back, independent observer, or distribution decision is configured, so external and production states remain `HOLD` / `BLOCKED`.

Current external evidence relay plan: [`v5.2.0-v5.3.4`](../docs/v5.2.0-v5.3.4-external-evidence-relay-plan-2026-09-08.md). The [`source-gate record`](../docs/release-evidence/v5.2.0-v5.3.4-external-evidence-relay-source-gate-2026-09-08.md) separates endpoint policy, opaque one-shot credential resolution, strict receipt intake, quarantine, freshness, and fourteen-domain reconciliation from real authority evidence. The default relay transport is unavailable; no controlled credential, authority relay, immutable archive read-back, observer receipt, independent decision, distribution approval, or production transition is configured, so external remains `HOLD` and production remains `BLOCKED`.

Current external evidence activation plan: [`v5.4.0-v5.5.4`](../docs/v5.4.0-v5.5.4-external-evidence-activation-plan-2026-09-09.md). Its [`source-gate record`](../docs/release-evidence/v5.4.0-v5.5.4-external-evidence-activation-source-gate-2026-09-09.md) records source, build, and route evidence separately from independent authorization. It turns relay/handoff lineage into strict activation manifests, signed stage observations, quarantine, fourteen-domain currentness, and a separately pinned decision request. The default activation port is unavailable; no controlled workload identity, authority observation, immutable archive read-back, independent observer, distribution decision, or production transition is configured, so external remains `HOLD` and production remains `BLOCKED`.

## Competitive Position

First-party product and model review dated 2026-08-31. **Core** means a primary first-party workflow; **integrated** means available but not the product's deepest specialization; **ecosystem** means normally assembled through adjacent clients or plugins. Vendor benchmark claims are not First LLM Studio evidence.

| Product | Strongest position | Runtime / Model Hub | Agent / RAG | Fine-tune | Evaluation / evidence |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | Evidence-driven local model lifecycle | **Core**, MLX/hardware-aware | **Core**, tools + Compare + ACL/citations | **Core**, recipe/checkpoint/adapter lifecycle | **Core**, Benchmark + lineage + release gates |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | Desktop discovery and local serving | **Core** | Integrated via API/tools/MCP | Not primary | Runtime inspection |
| [Ollama](https://docs.ollama.com/api/introduction) | Simple model runtime and packaging | **Core** | Ecosystem; native tool calling | Not primary | Ecosystem |
| [Open WebUI](https://docs.openwebui.com/features/) | Self-hosted team AI workspace | Integrated | **Core**, hybrid RAG/tools/MCP | Not primary | Integrated arena/A-B/ELO/OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | Open-source desktop assistant | **Core** | Integrated agents/projects/MCP | Not primary | Server logs |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG and agent automation | Integrated | **Core**, flows/skills/jobs | Not primary | Flow/run inspection |
| [Dify](https://docs.dify.ai/en/develop-plugin/getting-started/choose-plugin-type) | Visual AI application delivery | Integrated | **Core**, workflow/Agent/knowledge/plugins | Not primary | Application/run inspection |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | Efficient training breadth | Training/inference tooling | Task-focused | **Core**, broad LoRA/QLoRA | **Core** training monitors |
| [ModelScope SWIFT](https://swift.readthedocs.io/en/v3.7/Instruction/Evaluation.html) | China model training and multimodal evaluation breadth | Multi-backend | Task-focused | **Core**, training/multimodal methods | **Core**, EvalScope/OpenCompass/VLMEvalKit |
| [LocalAI](https://localai.io/) | Modular private AI runtime | **Core**, broad backends/hardware | **Core**, agents/MCP/RAG | Integrated | Runtime/control-plane ops |

The current official model/Agent radar includes OpenAI `gpt-5.6-sol`, Anthropic `claude-fable-5` / `claude-opus-5` and Managed Agents, Google `gemini-3.7-flash` and Antigravity, DeepSeek V4, MiniMax M2.7, Kimi K2.6, Zhipu `glm-5.2`, and Qwen3-Coder/Qwen Code Agent Teams. It is a watchlist, not a claim that every model is locally configured or paid for.


First LLM Studio is strongest where these workflows need one reproducible evidence chain. The 15 `v3.8.0-v3.9.4` source contracts now cover provider discovery, model routing, Agent conformance/cache, isolated teams, sandboxing, multimodal admission, Model Hub/Local Server v3, governed RAG, training federation, Team Studio policy, and a <=14-day freshness gate. Missing real workload and external receipts remain `HOLD`. See the full bilingual [competitive landscape and product direction](../docs/competitive-landscape.md).

## Real Fine-tune / LoRA Evidence

The v0.4.2 public baseline preserves the real local Qwen3 4B LoRA run introduced in v0.4.1:

- Base model: `mlx-community/Qwen3-4B-Instruct-2507-4bit`
- Dataset: First LLM Studio starter 960, split into train/valid/test `816/96/48`
- Training: 816 steps, eval/save every 100 steps
- Peak memory: 3.316 GB
- Latest throughput: 247.4 tokens/s
- Best checkpoint: step 800, `eval_loss=0.066`
- Evidence: manifest, metrics CSV, report, chart JSON/SVG/PNG, checkpoint events, selected best checkpoint, and full archive path

![Qwen3 4B LoRA release evidence](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

Vector chart: [`fine-tune-qwen4b-lora-chart.svg`](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg). Full evidence directory: [`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](../docs/release-evidence/finetune-qwen4b-lora-2026-07-01).

## Archived Local-run Evidence (2026-08-30)

The 2026-08-30 archive preserves evidence from the local application running at that time:

- Runtime Fabric: real MLX, Ollama, and llama.cpp passed 3/3 backends, 6/6 contracts, and 42/42 normalized operations.
- Local Server: Ollama 0.31.1 + Qwen3 0.6B passed 15/15 slices with 169 ms average latency.
- Benchmark smoke: Local Qwen3 0.6B completed 3/3 runs at 234.02 tokens/s.
- MATH-500: 500/500 outputs scored and 500/500 evaluator decisions replayed; local accuracy was 32%.
- Fine-tune: the real Qwen3 4B LoRA archive preserves 816 steps and the best checkpoint at step 800.

Metrics, digests, dimensions, and evidence boundaries: [`v3.1.4-high-resolution-live-machine-capture-2026-08-30.md`](../docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md). Production promotion remains `HOLD` or `BLOCKED` where independent evidence is absent.

## Screenshots

The 2026-10-06 gallery is a `1920 x 1200` capture of the current standalone UI with isolated data and machine paths redacted. It shows controls and empty/starter states, not new completed runs. [Manifest and boundaries](../docs/assets/product-tour/2026-10-06/manifest.json).

![Current isolated Agent workbench](../docs/assets/product-tour/2026-10-06/agent.png)
![Current isolated Compare Studio](../docs/assets/product-tour/2026-10-06/compare.png)
![Current isolated Fine-tune Studio](../docs/assets/product-tour/2026-10-06/fine-tune.png)
![Current isolated Benchmark Studio](../docs/assets/product-tour/2026-10-06/benchmarks.png)

[Models](../docs/assets/product-tour/2026-10-06/models.png) · [Retrieval](../docs/assets/product-tour/2026-10-06/retrieval.png) · [Experiments](../docs/assets/product-tour/2026-10-06/experiments.png) · [Admin](../docs/assets/product-tour/2026-10-06/admin.png).

**Archived local evidence, not new 2026-10-06 results:** [Qwen3 4B LoRA chart](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png) · [MATH-500 run](../docs/assets/screenshots/math500-reproducibility-performance.png) · [Runtime Fabric](../docs/assets/screenshots/runtime-fabric-live-performance.png) · [Local Server](../docs/assets/screenshots/local-server-live-acceptance.png). [2026-08-30 capture record](../docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md).

## Repository

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- Default ModelScope repo id: `haozi667788/first-llm-studio`
- Desktop candidate note: [`v1.1.0-rc.2`](../docs/releases/v1.1.0-rc.2_2026-07-16.md)

---

# 简体中文

First LLM Studio 是面向 Apple Silicon 的本地优先 LLM 工作台，把 MLX 本地运行时、远端 API 对比、Agent 会话、Compare Lab、Fine-tune/LoRA、Benchmark、模型发现、Retrieval、Experiments、replay、trace review、runtime recovery 和模型遥测统一到一个界面里。

![First LLM Studio 模型训练、评测与运行时性能概览](../docs/assets/github-hero-data.png)

> 主视觉中的数据为产品宣传用示例遥测，用于表达训练、评测与性能检测的产品能力；真实工作流与发布证据仍以项目文档为准。

## 当前版本

当前源码版本为 `v1.5.1`；最近公开 GitHub 发布为 `v0.4.0`；最近桌面候选为 `v1.1.0-rc.2`。分发为 `HOLD`，生产为 `BLOCKED`，详见 [`release-state.json`](../release-state.json)。

桌面候选包含 Apple Silicon 应用包、首次启动与恢复流程及本地 Ollama 证明；Developer ID/公证和独立组织验收仍是待完成门槛，后续源码批次不等于新的公开发布。

## 产品入口

| 模块 | 核心工作流 |
| --- | --- |
| Agent | 工具会话、target catalog、runtime rail、replay、trace review 和内嵌 Compare。 |
| Compare | Prompt 编排、lane preview、recipe 持久化、review drawer 和 benchmark handoff。 |
| Fine-tune | 数据集、配方、训练、评估、adapter proof loop、导出、报告、artifacts 和 LoRA 图表证据。 |
| Models | 社区/本地模型发现、安装验证、硬件适配、runtime profile、请求日志和 idle-unload 状态。 |
| Benchmarks | 运行控制、进度、baseline、报告、发布证据、不可用目标跳过和回归审阅。 |
| Retrieval | 本地知识导入、chunk 检查、权限过滤、引用和 grounded query 验证。 |
| Experiments | 统一 Session/Run 时间线、artifact lineage、跨功能链接、导航、筛选和 retention。 |
| Admin | Runtime、队列、provider health、compatibility usage、guardrails 和 audit timeline 的监控/配置镜像。 |

## 应用场景与价值

| 面向谁 | 要完成的工作 | 待试点验证的潜在价值 |
| --- | --- | --- |
| Apple Silicon 本地 AI 开发者 | 选择可运行的本地模型，结合运行时上下文对比已配置的远端目标。 | 减少模型管理器、命令行和笔记之间的手工切换。 |
| Agent / 工具链团队 | 检查会话、目标/工具状态、回放与对比交接。 | 更快区分模型、Provider、工具和运行时原因。 |
| 微调实践者 | 追踪数据集、配方、作业、checkpoint、报告与 adapter。 | 减少手工核对产物。 |
| 评测 / 平台工程师 | 审阅固定协议、判分器重放、baseline、来路和发布门槛。 | 让模型决策更可复查。 |

不宣称已测得的客户 ROI、节省工时或生产成果。[完整中英定位与试点度量](../docs/product-tour-and-positioning-2026-10-06.md)。

## 大版本核心功能

| 版本 | 核心能力 |
| --- | --- |
| `v0.1` | 本地优先 Studio 基础、MLX 网关工作流、target catalog、telemetry 和 Agent/Admin 分层。 |
| `v0.2` | Agent 工作台扩展、Compare 式审阅、replay/trace 检查、runtime recovery、benchmark 运维、baseline 和回归证据。 |
| `v0.3` | Fine-tune 操作循环、adapter chat/export、distillation starter、operation history、分区 typecheck、route/screenshot smoke 和发布素材。 |
| `v0.4` | 前台 `/fine-tune`、`/compare`、`/models`、`/benchmarks`、`/retrieval`、`/experiments`；feature-owned state/actions；artifact lineage；dark-glass studio/workbench 风格；canonical API 与带弃用头的 Admin compatibility wrappers。 |
| `v0.4.1` | 稳定基线：dataless recovery、runtime/status 修复、真实 Qwen3 4B LoRA 证据、checkpoint/report/chart 导出，以及最新高清截图。 |
| `v0.4.2` | 证据补丁：GitHub/ModelScope 高清截图同步、README LFS 阈值治理，以及 v0.5.0 Provider Health Desk v2 + Adapter Export wizard 第一段。 |
| `v0.5` | Preview-gated 企业 RAG、deployment registry、OpenAI-compatible API、telemetry、release-readiness gates、生产签收、quota、audit 和 control-plane rehearsal。 |
| `v1.0` | 统一 Agent、Compare、Model Hub、RAG、Fine-tune、Benchmark、Experiments、Admin 监控、application API、route ownership 和发布证据基线。 |
| `v1.1.0-rc.1` | 自包含 Apple Silicon app、内置 Node runtime、ZIP/DMG、首次启动和生命周期编排、真实本地对话证明及 clean-profile 启动证据；notarization 仍是 GA 门禁。 |
| `v1.1.0-rc.2` | 原生 arm64 launcher、内部代码/app/DMG 分层签名链、双层公证日志、staple/Gatekeeper 验证、独立 Mac 验收脚本以及带线下信任锚的 RSA 组织签收；真实外部证据仍是 GA 门禁。 |
| `v2.4.x` | AI 运行智能：读取真实 Runtime、Provider、SLO、Token/成本、Benchmark、Retrieval、Agent、Workflow 与 Fine-tune 信号，同时把独立签名复核保持为 HOLD。 |
| `v2.5.0-v2.5.4` | 部署生命周期：覆盖可移植性、数据主权、客户密钥、连续性/退出与独立闭环；生产授权继续由外部掌握并保持 BLOCKED。 |
| `v2.6.0-v2.6.9` | 受治理自治就绪度：把模型选择、Provider 路由、Grounded Context、工具权限、受保护动作、Workflow 回放、质量、Adapter 回滚和审计谱系收进一条独立复核链。 |
| `v2.7.0-v2.7.4` | 开放生态互操作：覆盖 OpenAI-compatible 客户端、MCP 扩展、模型/产物可移植性、Workspace Identity 与独立闭环。 |
| `v2.8.0-v2.8.9` | 运行整改：覆盖 Provider、Retrieval、模型供应链、Workspace 审计、Runtime、Agent、Workflow、Benchmark 与 Fine-tune 证据。 |
| `v2.9.0-v2.9.4` | 可持续运行：覆盖遥测、故障诊断、Admin compatibility sunset、桌面升级/数据生命周期与独立闭环。 |
| `v3.0.0-v3.0.9` | 整改控制面：加入 owner、优先级、依赖、验收条件、下一动作、证据指纹、确定性打包与独立签收。 |
| `v3.1.0-v3.1.4` | 服务就绪：覆盖客户披露、支持诊断、升级变更连续性、运行交接和独立闭环。 |
| `v3.2.0-v3.2.9` | 整改执行：覆盖幂等、租约/围栏、回滚、owner 执行和独立执行签收。 |
| `v3.3.0-v3.3.4` | 运营验收：覆盖 SLO/质量策略、事故/变更演练、owner 签收、发布决策和独立运营验收。 |
| `v3.4.0-v3.4.9` | Owner 工作负载准入：严格摘要绑定请求、只读准入、候选回执校验和独立回执闭环。 |
| `v3.5.0-v3.5.4` | 运营决策治理：覆盖证据时效/漂移、依赖影响、owner SLA、限时豁免和独立决策闭环。 |
| `v3.6.0-v3.6.9` | Owner 回执生命周期：带鉴权的候选回执接收、仅摘要隔离、乐观并发、补偿与独立账本闭环。 |
| `v3.7.0-v3.7.4` | 运营异常治理：SLA 超时检测、确认事件、限时豁免到期、决策包与独立异常闭环。 |
| `v3.8.0-v3.8.9` | **源码完成 / 待真实证据：** 官方来源注册表、Provider 能力探测/路由、Agent conformance/cache、隔离团队、沙箱、多模态准入、Model Hub v3 与 Local Server v3。 |
| `v3.9.0-v3.9.4` | **源码完成 / 待真实证据：** RAG 生命周期/质量、MLX/LLaMA-Factory/SWIFT 后端联邦、受治理 marketplace 与不超过 14 天的竞品 promotion gate。 |
| `v4.0.0-v4.1.4` | **源码完成 / 待真实证据：** 为 Provider/路由、真实 Agent/沙箱、多模态授权评测、模型/runtime 迁移、托管 RAG、联邦训练与团队资产建立严格观测回执和总晋级门禁。 |
| `v4.2.0-v4.3.4` | **源码完成 / 待真实证据：** 持久队列、重试围栏、严格提交、复核与导出、Provider 目录和 20 条路由质量/Shadow 回放，以及 8 个 feature-owned 领域执行器均已实现；非 live read model 会在回执提交前拒绝。 |
| `v4.4.0-v4.5.4` | **源码完成 / 待真实证据：** 复核身份、issuer/分离/quorum 策略、产物读回/保留、领域指标审定、复观察、可携导出、撤销与 fail-closed 总门禁。 |
| `v4.6.0-v4.7.4` | **源码完成 / 待真实证据：** 权威配置、持久包接收、围栏化生命周期、复观察/读回挑战绑定、撤销、可携导入、证据时效与 fail-closed 分发交接。 |
| `v4.8.0-v4.9.4` | **源码完成 / 待真实证据：** 非明文凭据引用、严格权威 Profile、信任/轮换/保留合同、十四领域 campaign、观察者分配、nonce 绑定挑战、回执隔离、时效、escrow 覆盖与权威分离。 |
| `v5.0.0-v5.1.4` | **源码完成 / 待真实证据：** 仅含摘要的 handoff、权威/归档见证、独立观察者交付、权威 dispatch、签名回执核验、异常 case、续期、决策请求/信封与生产安全互锁。 |
| `v5.2.0-v5.3.4` | **源码完成 / 待真实证据：** 固定 HTTPS Relay 描述符、非明文的一次性凭据解析、有界摘要请求/回执传输、隔离账本、时效/重放防护、14 域对账与不授予生产权限的防火墙。 |
| `v5.4.0-v5.5.4` | **源码完成 / 待真实证据：** 绑定 Relay/handoff 的激活清单、严格签名阶段接收、隔离、14 域时效、独立决策请求/回执绑定和生产准入防火墙。 |

证据：[`v2.4.0-v2.5.4 运行与部署生命周期 source gate`](../docs/release-evidence/v2.4.0-v2.5.4-operational-lifecycle-source-gate-2026-08-29.md) 记录了 8 个通过、5 个需关注和 2 个仅外部可满足的本地信号；独立外部签收仍为 `0/15`。

计划：[`v2.6.0-v2.7.4 受治理自治与开放生态互操作`](../docs/v2.6.0-v2.7.4-governed-interoperability-plan-2026-08-29.md) 新增 15 个 source-backed 版本切片；独立生态签收继续保持 `HOLD`，生产状态保持 `BLOCKED`。

Source gate：[`v2.6.0-v2.7.4`](../docs/release-evidence/v2.6.0-v2.7.4-governed-interoperability-source-gate-2026-08-29.md) 记录 9 个通过、4 个需关注、0 个不可用和 2 个仅外部可满足的信号；独立外部签收仍为 `0/15`。

上一阶段计划：[`v2.8.0-v2.9.4 运行整改与可持续运行`](../docs/v2.8.0-v2.9.4-operational-sustainability-plan-2026-08-30.md) 投影 6 个通过、7 个需关注、0 个不可用和 2 个仅外部可满足的 owner 信号；独立外部证据仍为 `0/15`，分发保持 `HOLD`，生产保持 `BLOCKED`。

已验证 source gate：[`v2.8.0-v2.9.4`](../docs/release-evidence/v2.8.0-v2.9.4-operational-sustainability-source-gate-2026-08-30.md) 记录 119/119 测试、73/73 CI 路由、完整 smoke、桌面/移动浏览器验证与机器可读证据导出。

上一阶段计划：[`v3.0.0-v3.1.4 整改控制与服务就绪`](../docs/v3.0.0-v3.1.4-remediation-service-readiness-plan-2026-08-30.md) 记录 5 个通过、8 个需关注、0 个不可用和 2 个仅外部可满足；控制面分类为 2 个 satisfied、3 个 open、8 个 blocked 和 2 个 external-only。独立证据仍为 `0/15`，生产保持 `BLOCKED`。

上一阶段已验证 source gate：[`v3.0.0-v3.1.4`](../docs/release-evidence/v3.0.0-v3.1.4-remediation-service-readiness-source-gate-2026-08-30.md) 记录 125/125 测试、75/75 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证。

最新计划：[`v3.2.0-v3.3.4 整改执行与运营验收`](../docs/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-plan-2026-08-30.md) 为 7 个 owner 动作增加确定性幂等、短租约、围栏、回滚和证据指纹。当前动作状态为 0 个 satisfied、3 个 ready、4 个 blocked；独立证据仍为 `0/15`，生产保持 `BLOCKED`。

最新已验证 source gate：[`v3.2.0-v3.3.4`](../docs/release-evidence/v3.2.0-v3.3.4-remediation-execution-operational-acceptance-source-gate-2026-08-30.md) 记录 131/131 测试、77/77 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证。

当前计划：[`v3.4.0-v3.5.4 Owner 工作负载与运营决策治理`](../docs/v3.4.0-v3.5.4-owner-workload-operational-decision-plan-2026-08-30.md) 为 7 类 owner 工作负载增加严格请求与候选回执合同。源码投影为 5 个通过、8 个需关注和 2 个仅外部可满足；外部证据仍为 `0/15`，生产保持 `BLOCKED`。

当前已验证 source gate：[`v3.4.0-v3.5.4`](../docs/release-evidence/v3.4.0-v3.5.4-owner-workload-operational-decision-source-gate-2026-08-30.md) 记录 137/137 测试、全部 11 个变更 TypeScript 分区、79/79 CI 路由、完整 smoke、生产构建、安全预检和桌面/移动浏览器验证。

当前计划：[`v3.6.0-v3.7.4 Owner 回执与异常生命周期`](../docs/v3.6.0-v3.7.4-owner-receipt-exception-lifecycle-plan-2026-08-30.md) 已实现带鉴权的 append-only 回执事件、隔离、补偿、升级确认、限时豁免到期和确定性决策包。源码投影为 6 个通过、7 个需关注、2 个仅外部可满足；本轮未提交真实 owner 回执，外部证据仍为 `0/15`，生产保持 `BLOCKED`。

当前竞品产品计划：[`v3.8.0-v3.9.4`](../docs/v3.8.0-v3.9.4-competitive-product-plan-2026-09-02.md) 已实现全部 15 个仓库自有契约；真实 Provider、runtime、多模态、托管 RAG/训练、组织、分发与生产证据继续作为独立 `HOLD` 门槛。

当前已验证 source gate：[`v3.8.0-v3.9.4`](../docs/release-evidence/v3.8.0-v3.9.4-competitive-product-source-gate-2026-09-02.md) 记录 156/156 测试、全部 11 个变更 TypeScript 分区、85/85 CI 路由、完整 smoke、生产构建、架构/持久化检查和安全预检。源码 15/15 通过，本地证据 12/15 通过；路由质量、多模态授权执行和真实 Hub 传输证据继续 HOLD。

当前证据运营计划：[`v4.0.0-v4.1.4`](../docs/v4.0.0-v4.1.4-evidence-operations-plan-2026-09-03.md) 在 `/experiments` 分开呈现 15 项 source/local/external/production 门禁，并提供严格、可持久化的候选回执接收。候选只能闭环本地证据；独立签名、不可变归档、分发与生产授权继续 fail closed。

最新已验证 source gate：[`v4.0.0-v4.1.4`](../docs/release-evidence/v4.0.0-v4.1.4-evidence-operations-source-gate-2026-09-04.md) 记录 164/164 测试、全部 11 个变更 TypeScript 分区、86/86 CI 路由、完整 smoke、53 页生产构建、架构/持久化检查与已归档的零漏洞安全预检；最新在线审计重跑因 npm registry 超时而正确 fail-closed，并非检出漏洞。源码为 15/15，本地真实证据为 3/15，候选为 0，外部签收为 0/15；分发继续 `HOLD`，生产继续 `BLOCKED`。

当前证据采集计划：[`v4.2.0-v4.3.4`](../docs/v4.2.0-v4.3.4-evidence-collection-plan-2026-09-05.md)。15 个源码机制均已实现：队列控制、Provider 目录、20 条路由质量/Shadow 执行器、复核/导出和 8 个 feature-owned 领域执行器。领域执行器会在回执提交前拒绝 reference、fixture 与 derived read model；本地确定性控制门禁为 `4/15`，真实 workload 证据仍待采集。不同复核 ID 不等于已认证的独立身份；[验证记录](../docs/release-evidence/v4.2.0-v4.3.4-evidence-collection-source-gate-2026-09-07.md) 区分隔离测试与真实 workload 证据。分发保持 `HOLD`，生产保持 `BLOCKED`。

当前证据审定计划：[`v4.4.0-v4.5.4`](../docs/v4.4.0-v4.5.4-evidence-adjudication-plan-2026-09-07.md)。[`源码门禁记录`](../docs/release-evidence/v4.4.0-v4.5.4-evidence-adjudication-source-gate-2026-09-07.md) 固化了 15 个已实现源码合同与 7 个本地确定性控制；尚无已接受 workload package、外部验证的复核身份、不可变归档读回或独立复观察，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前证据验收生命周期计划：[`v4.6.0-v4.7.4`](../docs/v4.6.0-v4.7.4-evidence-acceptance-plan-2026-09-08.md)。[`源码门禁记录`](../docs/release-evidence/v4.6.0-v4.7.4-evidence-acceptance-source-gate-2026-09-08.md) 固化了 15 个源码合同、8 个本地确定性生命周期控制与生产构建 route-smoke 回执；尚无受控外部权威、不可变归档读回、当前已核验 package、独立观察者或分发批准，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前权威证据活动计划：[`v4.8.0-v4.9.4`](../docs/v4.8.0-v4.9.4-evidence-authority-campaign-plan-2026-09-08.md)。[`源码门禁记录`](../docs/release-evidence/v4.8.0-v4.9.4-evidence-authority-campaign-source-gate-2026-09-08.md) 固化了 15 个源码合同、9 个本地确定性控制与生产构建 route-smoke 证据；尚未配置受控凭据解析器、live authority profile、campaign、外部签收回执、不可变归档读回、独立观察者或分发批准，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前外部证据交接计划：[`v5.0.0-v5.1.4`](../docs/v5.0.0-v5.1.4-external-evidence-handoff-plan-2026-09-08.md)。[`源码门禁记录`](../docs/release-evidence/v5.0.0-v5.1.4-external-evidence-handoff-source-gate-2026-09-08.md) 固化了 15 个源码合同、9 个本地确定性控制与生产构建 route-smoke 证据；尚未配置受控 resolver、权威见证、正式交接、签名核验、不可变归档读回、独立观察者或分发决策，因此外部与生产状态继续为 `HOLD` / `BLOCKED`。

当前外部证据 Relay 计划：[`v5.2.0-v5.3.4`](../docs/v5.2.0-v5.3.4-external-evidence-relay-plan-2026-09-08.md)。[`源码门禁记录`](../docs/release-evidence/v5.2.0-v5.3.4-external-evidence-relay-source-gate-2026-09-08.md) 将端点策略、非明文的一次性凭据解析、严格回执接收、隔离、时效与 14 域对账同真实权威证据分开记录。默认 Relay transport 不可用；尚未配置受控凭据、权威 Relay、不可变归档读回、观察者回执、独立决策、分发批准或生产切换，因此外部继续为 `HOLD`，生产继续为 `BLOCKED`。

当前外部证据激活计划：[`v5.4.0-v5.5.4`](../docs/v5.4.0-v5.5.4-external-evidence-activation-plan-2026-09-09.md)。对应的[`源码门禁记录`](../docs/release-evidence/v5.4.0-v5.5.4-external-evidence-activation-source-gate-2026-09-09.md)将源码、构建和路由证据同独立授权明确分开。它把 Relay/handoff 谱系收紧为激活清单、签名阶段观察、隔离、14 域时效与独立决策请求。默认 activation port 不可用；尚未配置受控 workload identity、权威观察、不可变归档读回、独立观察者、分发决策或生产切换，因此外部继续为 `HOLD`，生产继续为 `BLOCKED`。

## 竞品定位对比

本表基于 2026-08-31 可查的官方产品与模型文档。**核心**表示原生主流程，**已集成**表示具备但并非最深专长，**生态**表示通常由相邻客户端或插件组装。厂商自报 benchmark 不直接算作本项目证据。

| 产品 | 最强定位 | Runtime / Model Hub | Agent / RAG | Fine-tune | 评测 / 证据 |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | 证据驱动的本地模型全生命周期 | **核心**，MLX/硬件感知 | **核心**，工具 + Compare + ACL/引用 | **核心**，recipe/checkpoint/adapter lifecycle | **核心**，Benchmark + lineage + release gates |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | 桌面模型发现和本地服务 | **核心** | 通过 API/工具/MCP 集成 | 非主线 | Runtime 检查 |
| [Ollama](https://docs.ollama.com/api/introduction) | 简洁模型运行时与打包 | **核心** | 生态；原生 tool calling | 非主线 | 生态提供 |
| [Open WebUI](https://docs.openwebui.com/features/) | 自托管团队 AI 工作区 | 已集成 | **核心**，混合 RAG/工具/MCP | 非主线 | Arena/A-B/ELO/OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | 开源桌面助手 | **核心** | Agent/Project/MCP | 非主线 | Server 日志 |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG 与 Agent 自动化 | 已集成 | **核心**，Flow/Skill/定时任务 | 非主线 | Flow/Run 检查 |
| [Dify](https://docs.dify.ai/en/develop-plugin/getting-started/choose-plugin-type) | 可视化 AI 应用交付 | 已集成 | **核心**，Workflow/Agent/Knowledge/Plugin | 非主线 | 应用与运行检查 |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | 高效训练广度 | 训练/推理工具 | 面向任务 | **核心**，广泛 LoRA/QLoRA | **核心**，训练监控 |
| [ModelScope SWIFT](https://swift.readthedocs.io/en/v3.7/Instruction/Evaluation.html) | 国内模型训练与多模态评测广度 | 多后端 | 面向任务 | **核心**，训练/多模态方法 | **核心**，EvalScope/OpenCompass/VLMEvalKit |
| [LocalAI](https://localai.io/) | 模块化私有 AI runtime | **核心**，广后端/硬件 | **核心**，Agent/MCP/RAG | 已集成 | Runtime/控制面运维 |

当前官方模型/Agent 雷达包括 OpenAI `gpt-5.6-sol`、Anthropic `claude-fable-5` / `claude-opus-5` 与 Managed Agents、Google `gemini-3.7-flash` 与 Antigravity、DeepSeek V4、MiniMax M2.7、Kimi K2.6、智谱 `glm-5.2` 以及 Qwen3-Coder / Qwen Code Agent Team。它不代表本机已配置或购买全部模型。

First LLM Studio 在统一证据链上更有优势。`v3.8.0-v3.9.4` 的 15 个源码契约现已覆盖 provider 探测/路由、Agent conformance/cache、多 Agent 隔离、沙箱、多模态准入、Model Hub/Local Server、RAG、训练后端联邦、团队治理和不超过 14 天的 freshness gate；真实 workload 与外部回执继续 `HOLD`。完整双语分析见：[竞品格局与产品方向](../docs/competitive-landscape.md)。

## 真实 Fine-tune / LoRA 证据

v0.4.2 公开基线继续保留 v0.4.1 引入的真实本地 Qwen3 4B LoRA 训练：

- 基座模型：`mlx-community/Qwen3-4B-Instruct-2507-4bit`
- 数据集：First LLM Studio starter 960，训练/验证/测试 `816/96/48`
- 训练：816 steps，eval/save every 100 steps
- 峰值内存：3.316 GB
- 最新吞吐：247.4 tokens/s
- 最佳 checkpoint：step 800，`eval_loss=0.066`
- 证据：manifest、metrics CSV、report、chart JSON/SVG/PNG、checkpoint events、selected best checkpoint 和 full archive path

![Qwen3 4B LoRA 发布证据](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

矢量图：[`fine-tune-qwen4b-lora-chart.svg`](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg)。完整证据目录：[`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](../docs/release-evidence/finetune-qwen4b-lora-2026-07-01)。

## 历史本地运行证据（2026-08-30）

2026-08-30 的归档保留了当时运行应用生成的高清本地材料：

- Runtime Fabric：真实 MLX、Ollama、llama.cpp 3/3 后端通过，contract 6/6，标准化操作 42/42。
- Local Server：Ollama 0.31.1 + Qwen3 0.6B 通过 15/15 项，平均延迟 169 ms。
- Benchmark smoke：Local Qwen3 0.6B 完成 3/3 次运行，吞吐 234.02 tokens/s。
- MATH-500：完整 500 题全部判分，判分决定 500/500 重放一致，本地准确率 32%。
- Fine-tune：真实 Qwen3 4B LoRA 归档保留 816 steps 和 step 800 最佳 checkpoint。

完整指标、摘要、尺寸与证据边界见：[`v3.1.4-high-resolution-live-machine-capture-2026-08-30.md`](../docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md)。缺少独立外部证据的生产晋级继续保持 `HOLD` 或 `BLOCKED`。

## 截图

2026-10-06 当前图库从使用隔离数据的独立构建抓取，尺寸为 `1920 x 1200`，UI 文本中的本机路径已脱敏。画面展示控制项与空白/入门状态，不代表新完成的运行。[清单与边界](../docs/assets/product-tour/2026-10-06/manifest.json)。

![当前隔离环境的 Agent 工作台](../docs/assets/product-tour/2026-10-06/agent.png)
![当前隔离环境的 Compare Studio](../docs/assets/product-tour/2026-10-06/compare.png)
![当前隔离环境的 Fine-tune Studio](../docs/assets/product-tour/2026-10-06/fine-tune.png)
![当前隔离环境的 Benchmark Studio](../docs/assets/product-tour/2026-10-06/benchmarks.png)

[模型](../docs/assets/product-tour/2026-10-06/models.png) · [检索](../docs/assets/product-tour/2026-10-06/retrieval.png) · [实验](../docs/assets/product-tour/2026-10-06/experiments.png) · [后台](../docs/assets/product-tour/2026-10-06/admin.png)。

**历史本地证据，不是 2026-10-06 新结果：** [Qwen3 4B LoRA 曲线](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png) · [MATH-500 运行](../docs/assets/screenshots/math500-reproducibility-performance.png) · [Runtime Fabric](../docs/assets/screenshots/runtime-fabric-live-performance.png) · [Local Server](../docs/assets/screenshots/local-server-live-acceptance.png)。[2026-08-30 抓图记录](../docs/release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md)。

## 仓库地址

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope 主页: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- 默认 ModelScope repo id：`haozi667788/first-llm-studio`
- 桌面候选版说明：[`v1.1.0-rc.2`](../docs/releases/v1.1.0-rc.2_2026-07-16.md)
