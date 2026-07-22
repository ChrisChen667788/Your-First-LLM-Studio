# Release Train and Post-v1 Product Roadmap

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

Last updated: 2026-07-18

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

## Current Slice

The latest tagged release remains `v1.1.0-rc.2`. Active development is now `v1.3.1`; the Desktop package still requires real Developer ID notarization and a separately trusted clean-machine organization receipt before GA promotion.

The earlier `v1.1.1` Community/DX batch absorbed the remaining GitHub issues: latest runtime recovery visibility, line-level `read_file` evidence, compact benchmark issue exports, production route-smoke artifacts, Chinese contributor onboarding, a repository setup checklist, local/remote lane guidance, and a reproducible MP4 workflow. The real multi-file transfer and physical external-disk receipt pass; only refreshed ModelScope identity evidence remains required for authenticated promotion.

Evidence: [`docs/release-evidence/v1.1.1-community-dx-2026-07-16.md`](./release-evidence/v1.1.1-community-dx-2026-07-16.md).

The real Model Hub continuation now resolves ModelScope manifests to immutable commits, verifies provider SHA-256 for every selected file, emits a final transfer receipt, and performs operator-approved physical-volume migration with per-file re-hashing and a volume-bound ownership manifest. The public 9-file workload and `HP ZHAN SSD` migration pass; the combined gate remains `7/8 PASS` because the previous ModelScope token returned `401` from the official identity endpoint. Evidence: [`docs/release-evidence/v1.1.1-model-hub-promotion-2026-07-16.md`](./release-evidence/v1.1.1-model-hub-promotion-2026-07-16.md).

The `v1.2.1` local Runtime Fabric is complete. Six adapters share one normalized operation contract, and real MLX, Ollama, and llama.cpp processes pass health, discovery, chat, SSE, and usage normalization on Apple Silicon. Production promotion remains HOLD for real LocalAI, Linux/NVIDIA vLLM and SGLang, and heterogeneous remote-node failover receipts. Evidence: [`docs/release-evidence/v1.2.1-runtime-fabric-acceptance-2026-07-18.md`](./release-evidence/v1.2.1-runtime-fabric-acceptance-2026-07-18.md).

The `v1.3.0` local MCP and secure extension ecosystem is complete. A pinned official filesystem server passes real MCP stdio initialization, tool discovery, and read execution under macOS Seatbelt; signed install/update/rollback, permission/secret boundaries, quarantine, malicious bundle rejection, and dependency blocking pass 11/11 checks. Production promotion remains HOLD for an independently managed publisher trust root, Linux and Windows isolation receipts, and a remote Streamable HTTP OAuth lifecycle. Evidence: [`docs/release-evidence/v1.3.0-mcp-extension-acceptance-2026-07-19.md`](./release-evidence/v1.3.0-mcp-extension-acceptance-2026-07-19.md).

The `v1.3.1` Workflow Studio implementation is now active. Its local promotion state is derived from a fresh durable acceptance receipt rather than a hardcoded complete flag; production remains fail-closed until authenticated non-loopback invocation, distributed worker recovery, and collaborative conflict evidence exist.

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

- Inject workload identity plus `FIRST_LLM_AWS_KMS_KEY_ID` and an Object Lock enabled `FIRST_LLM_AUDIT_S3_BUCKET`, then run `/api/deployment` with `requireCloud=true` to produce real cloud production sign-off.
- After v0.9 cloud sign-off is present, enter v1.0.0 GA closure: final release evidence, API compatibility sunset evidence, docs/screenshots freshness, and cross-surface route smoke.
- Continue non-cloud GA closure by refreshing screenshots/docs close to release time, keeping source-tagged runtime compatibility hits at zero, and recording final post-sunset compatibility evidence after 2026-09-30.
- Select a configured remote target in Admin Provider Ops and run a real release probe before promotion; the gate intentionally remains WATCH when no fresh chat request or successful probe exists.
- Write the GA evidence bundle from `/experiments`, review the non-cloud blockers, and keep production cloud sign-off blocked until real workload identity, KMS, and immutable archive evidence exist.

## 中文说明

这份版本列车是 `v0.4.2` 之后的主线契约，并已同步到代码：

- `features/experiments/release-train.ts`
- `app/api/experiments/release-train/route.ts`
- `features/experiments/ReleaseTrainPanel.tsx`

当前正式标签仍是 `v1.1.0-rc.2`，active development 已推进到 `v1.3.1`。可视化 Workflow Studio 已进入本地验收阶段，画布编辑、严格校验、版本发布、断点/回放、受保护工具恢复和 OpenAI-compatible 调用由新 promotion contract 动态判定；认证非回环调用、分布式 worker 恢复和多用户冲突证据继续保持生产阻塞。原生 launcher 的 Developer ID notarization 和独立可信 clean-machine/组织签收同样保持 fail-closed。
