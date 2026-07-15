# Architecture Refactor Plan

Last updated: 2026-06-12
Target line: v0.4.x architecture and product information architecture refactor

## Why This Refactor Exists

First LLM Studio has moved from a local Agent demo into a broad local-first LLM workbench. The product now contains Agent chat, Compare, Benchmark, Retrieval, Fine-tune, community model discovery, provider health, runtime guardrails, reports, bundles, screenshots, release evidence, and admin operations.

That breadth is useful, but the current implementation has started to show two risks:

1. Product information architecture drift: many user-facing workflows live under `/admin`, even though they are daily product workflows rather than operator-only controls.
2. Code architecture pressure: several large UI and service files carry too many responsibilities, which makes iteration slower and increases regression risk.

This refactor should preserve the working product while moving it toward a high-cohesion, low-coupling architecture. In Brooks's terms from *The Mythical Man-Month*, the goal is conceptual integrity: a small number of clear ideas repeated consistently, not a pile of heroic one-off code paths.

## Current Version Status

Package version: `0.3.2`
Current public product name: `First LLM Studio`
Current branch state at planning time: `main` aligned with `origin/main`, with only local runtime output folders untracked.
Recent release head: `feat: polish fine-tune bundles and compare responsive layout`

Current core capabilities:

- Local and remote Agent workbench with streaming chat.
- Compare Lab for lane-based output comparison and benchmark handoff.
- Benchmark execution, regression history, reports, trends, and formal milestone sets.
- Provider health, retry/timeout policy, and usage-oriented remote target management.
- Local runtime controls, prewarm/release/restart/log viewing, and memory guardrails.
- Retrieval stage two with lexical/vector hybrid recall, rerank, evidence spans, and grounded answer verification.
- Server-side workbench snapshot persistence, sessions, timeline, and conflict prompts.
- Fine-tune workflow with dataset validation, community presets, local MLX worker, logs, loss curves, adapter attach, compare/benchmark handoff, report preview, bundle download, and multi-run overlays.
- Community model and dataset discovery across local/community sources with hardware fit and install preflight.
- Release evidence through route smoke, screenshot smoke, partitioned typecheck, release notes, and docs assets.

## Historical Version Map

| Version | Date | Main Development Content |
| --- | --- | --- |
| v0.1.0 | 2026-03-26 | Initial local-first Agent workbench foundation, local runtime wiring, early UI and release baseline. |
| v0.2.0 | 2026-03-27 | Runtime and benchmark hardening, local model workflow expansion, first serious public-shape iteration. |
| v0.2.1 | 2026-03-28 | Release hygiene, runtime fixes, incremental benchmark/report polish. |
| v0.2.2 | 2026-03-28 | More benchmark and runtime stability work, export/report refinements. |
| v0.2.3 | 2026-03-30 | Local/remote target readiness, social/public release preparation, visual identity work. |
| v0.3.0 | 2026-04-11 | Rebrand to First LLM Studio, public launch posture, Compare Lab embedded into `/agent`, stronger release documentation. |
| v0.3.1 | 2026-05-02 | Fine-tune report preview, full bundle download, same-adapter multi-run overlays, stronger community dataset conversion, compact Compare small-screen behavior. |
| v0.3.2 | 2026-05-18 | Fine-tune operations closure, evaluation/chat/export/distillation actions, partitioned typecheck, screenshot smoke, LLaMA-Factory parity roadmap, UI polish. |

## Current Architectural Pressure Points

These are not failures; they are normal scaling signals. They need to be handled before the next large feature wave.

| Area | Current Signal | Risk |
| --- | --- | --- |
| Agent Workbench | `components/agent/AgentWorkbench.tsx` is roughly 3.1k lines after the latest shell, transcript, and provider self-check extractions. | Main shell still owns chat run orchestration and some layout wiring, but transcript panel/container rendering, turn rendering, provider self-check UI, and most shell tooling now live under `features/agent`. |
| Fine-tune UI | `components/finetune/FineTuneStudioPanel.tsx` is roughly 2.4k lines after the first route-owned extraction. | Dataset, recipe, jobs, reports, charts, and operations now flow through feature-owned setup/run/evidence composer adapters, but the foreground composer still owns broad state assembly. |
| Compare UI | `components/agent/AgentCompareLab.tsx` is roughly 2.1k lines. | Compare target selection, prompt editor, lane preview, review, and benchmark handoff still need clearer sub-boundaries. |
| Fine-tune Store | `lib/finetune/store.ts` is roughly 4.3k lines. | Persistence, job state, reporting, bundles, metrics, and artifact bookkeeping are concentrated in one store module. |
| Product IA | Fine-tune, model discovery, benchmark reports, and dataset workflows are mostly under `/admin`. | Users must enter an operator-feeling area for normal product work. This weakens product clarity and makes admin feel crowded. |

## Product Information Architecture Target

The product should separate daily user workflows from operator/admin workflows.

### Foreground Product Surfaces

These are product workflows that should be visible outside `/admin`.

| New Surface | Purpose | Moves From |
| --- | --- | --- |
| `/agent` | Chat, coding workbench, lightweight runtime status, session continuity. | Keep existing, but reduce compare/fine-tune burden inside the shell. |
| `/compare` or `/studio/compare` | Compare recipes, lane matrix, prompt editor, output review, diff drawer, benchmark handoff. | Heavy Compare workflow currently embedded in `/agent`. |
| `/fine-tune` or `/studio/fine-tune` | Train, Evaluate & Predict, Chat Adapter, Export, dataset presets, reports, bundle download. | User-facing fine-tune workflow currently in `/admin`. |
| `/models` | Local model catalog, community discovery, hardware fit, install/download, risk badges, source links. | Community/local model discovery currently mixed into admin and agent sidebars. |
| `/benchmarks` | Run benchmark suites, compare reports, release evidence, export reports. | User-facing benchmark execution/report browsing currently under `/admin`. |
| `/experiments` | Unified timeline of sessions, compare runs, benchmark runs, fine-tune jobs, reports, artifacts. | Timeline/admin history panels. |

### Admin Surfaces

Admin should become monitoring, configuration, management, and audit.

| Admin Module | Scope |
| --- | --- |
| Provider Health Desk | Timeout, 429, auth failure, quota, cost ledger, retry/timeout policy, provider-specific output contracts. |
| Runtime Operations | Gateway lifecycle, loaded model inventory, prewarm/release policy, memory guardrails, process logs. |
| Benchmark Governance | Baselines, release evidence, formal milestone reports, retention policy, fallback source badges. |
| Data and Storage Management | Dataset cache, artifact cleanup, bundle retention, model install directories, disk pressure. |
| Security and Audit | Secret scan status, publish checklist, external source trust, operation audit trail. |
| Worker Queue | Fine-tune worker status, failed jobs, retries, cancellation, resource limits. |

## Architecture Principles

The goal is not a big rewrite. The goal is controlled separation.

1. Conceptual integrity first
   - Each user-facing concept should have one canonical home: model, dataset, run, report, artifact, provider, runtime, session.
   - Avoid duplicate state shapes across Agent, Admin, Benchmark, and Fine-tune.

2. High cohesion, low coupling
   - Keep domain rules close together.
   - Keep UI, persistence, API transport, and worker execution separate.
   - Feature modules can coordinate through application services and typed contracts, not direct store mutation.

3. Thin route handlers and thin page shells
   - `app/**/page.tsx` should mostly compose page modules.
   - API routes should validate input, call application services, and return typed responses.

4. Ports and adapters
   - Domain/application code should not know whether a provider is OpenAI-compatible, Anthropic-compatible, local MLX, filesystem, or community API.
   - Infrastructure adapters handle provider quirks, filesystem paths, process control, and external API schemas.

5. No big-bang rewrite
   - Build strangler seams around current modules.
   - Move one workflow at a time behind stable interfaces.
   - Keep old route behavior until the new surface passes smoke and screenshot checks.

6. Explicit budgets
   - Large files are allowed temporarily, not as the final architecture.
   - New feature containers should stay below roughly 500 lines.
   - Reusable UI components should stay below roughly 250 lines.
   - Domain services should have one reason to change.

## Target Code Layout

Recommended target structure:

```text
app/
  (product)/
    agent/
    compare/
    fine-tune/
    models/
    benchmarks/
    experiments/
  admin/
    providers/
    runtime/
    benchmarks/
    data/
    audit/
features/
  agent/
    domain/
    application/
    infrastructure/
    ui/
  compare/
    domain/
    application/
    infrastructure/
    ui/
  finetune/
    domain/
    application/
    infrastructure/
    ui/
  benchmark/
    domain/
    application/
    infrastructure/
    ui/
  models/
    domain/
    application/
    infrastructure/
    ui/
  retrieval/
    domain/
    application/
    infrastructure/
    ui/
  providers/
    domain/
    application/
    infrastructure/
    ui/
  experiments/
    domain/
    application/
    infrastructure/
    ui/
core/
  result/
  errors/
  events/
  ids/
  time/
platform/
  filesystem/
  http/
  process/
  telemetry/
  storage/
```

Existing `lib/**` modules do not need to disappear immediately. During migration they should become compatibility exports or infrastructure implementations behind feature-level interfaces.

## Module Boundaries

### Compare

Owns:

- Compare recipe definitions.
- Lane selection and lane matrix.
- Prompt/system prompt/output contract settings.
- Compare run status and review models.
- Diff drawer and report/export handoff.

Should not own:

- Provider HTTP details.
- Runtime process control.
- Benchmark persistence internals.
- Agent session persistence internals.

### Fine-tune

Owns:

- Dataset manifest and validation result.
- Recipe/config schema.
- Training job lifecycle.
- Training metrics and normalized/raw loss series.
- Adapter artifact metadata.
- Evaluate, Chat Adapter, Export, Report, Bundle workflows.

Should not own:

- Provider health UI.
- General benchmark governance.
- Generic filesystem process execution outside a worker adapter.

### Benchmark

Owns:

- Workload sets, run definitions, metrics, baseline/delta, reports, release evidence.
- Handoff contracts from Compare and Fine-tune.

Should not own:

- Fine-tune job storage.
- Provider-specific HTTP behavior beyond consuming normalized provider events.

### Models

Owns:

- Local model registry.
- Community model candidates.
- Install plan/preflight/result.
- Hardware fit and risk policy presentation.

Should not own:

- Training recipes.
- Benchmark scoring.
- Provider health ledger.

### Admin

Admin can observe and configure all modules, but should avoid becoming the place where all product work happens.

## Migration Plan

### Phase 0: Freeze the Map

Goal: make current behavior explicit before moving code.

Tasks:

- Add architecture notes and route ownership map.
- Add dependency boundary notes for Agent, Compare, Fine-tune, Benchmark, Models, Providers, Retrieval, Experiments.
- Ensure route smoke covers `/agent`, `/admin`, and any new foreground route created in the migration.
- Keep screenshot smoke baselines for before/after layout comparison.

Acceptance:

- Current feature inventory is documented.
- No code movement without a target module and rollback path.
- Route smoke still passes.

### Phase 1: Extract Contracts

Goal: define stable contracts before moving UI.

Tasks:

- Extract Compare contracts: recipe, lane, run, review, export, benchmark handoff.
- Extract Fine-tune contracts: dataset, recipe, job, metrics, report, bundle, adapter artifact.
- Extract Benchmark contracts: workload, run, result, report, evidence.
- Extract Provider contracts: health event, retry policy, timeout policy, cost ledger entry.
- Extract Model contracts: model candidate, install plan, hardware risk, source link.

Acceptance:

- UI imports feature contracts, not deep `lib` internals.
- API routes use validators close to contracts.
- Typecheck partitions still pass.

### Phase 2: Split Large Files Behind Existing Routes

Goal: reduce risk without changing URLs first.

Tasks:

- Split `AgentWorkbench.tsx` into shell, target sidebar, session panel, runtime summary, primary workspace, and mode routing.
- Split `AgentCompareLab.tsx` into prompt editor, recipe matrix, lane matrix, review drawer, benchmark handoff, export actions.
- Split `FineTuneStudioPanel.tsx` into dataset step, recipe step, train step, evaluate step, chat adapter step, export step, report/bundle panels, job list.
- Split `lib/finetune/store.ts` into repository, job service, report service, bundle service, metrics service.

Acceptance:

- No single new UI file exceeds the agreed budget unless documented.
- Existing `/agent` and `/admin` behavior remains intact.
- Screenshot smoke shows no major regression.

### Phase 3: Move User Workflows to Foreground Routes

Goal: make the product feel like a polished studio instead of an admin console.

Tasks:

- Create foreground Fine-tune Studio route with tabs: `Train`, `Evaluate & Predict`, `Chat Adapter`, `Export`, `Reports`.
- Create foreground Compare Studio route with stable three-part layout: primary editor, lane matrix, diff/review drawer.
- Create foreground Models route for local/community catalog and install workflows. ✅ Initial `/models` shell added with `features/models/*` contracts and model discovery application wrapper.
- Create foreground Benchmarks route for run/report workflows. ✅ Initial `/benchmarks` shell added with `features/benchmark/*` contracts and release-evidence application wrapper.
- Keep `/admin` links as monitor/config mirrors, not primary task entry points.

Acceptance:

- Normal users can train, compare, benchmark, inspect models, and export reports without entering `/admin`.
- `/admin` is mostly monitoring/configuration/audit.
- Navigation labels match product intent.

### Phase 4: Unify Experiment History

Goal: every meaningful operation becomes part of one experiment history.

Tasks:

- Normalize timeline events across session, compare, benchmark, fine-tune, retrieval, model install, and provider health. ✅ All current producers write through `features/experiments/timeline-service.ts`; the admin timeline route delegates to `features/experiments/application.ts`.
- Add report/artifact references to timeline events. ✅ Structured `artifacts[]` and `links[]` contracts now cover fine-tune operation files, Compare/Benchmark progress and reports, retrieval sources, model install state, and provider health exports.
- Add cross-links from Fine-tune adapter -> Compare run -> Benchmark run -> Report bundle. ✅ Fine-tune handoffs carry a typed `ExperimentSourceContext` through Compare and Benchmark.

Acceptance:

- A user can answer: what did I run, with which model/data/config, what changed, where is the artifact?
- Admin can audit failures and resource usage without reading raw logs first.

### Phase 5: Public Release Cleanup

Goal: make the refactor visible as a product-quality release.

Tasks:

- Update README bilingual feature map. ✅ Foreground Retrieval and Experiments routes are included in the v0.4 source checkpoint map.
- Update product whitepaper and module docs.
- Update screenshots for Agent, Compare, Fine-tune, Models, Benchmarks, Admin.
- Add migration notes for users. ✅ Route ownership and compatibility behavior are documented for the v0.4 checkpoint.
- Add release note for v0.4.x. ✅ Source-checkpoint release evidence lives under `docs/releases` before the formal tag.

Acceptance:

- GitHub docs explain foreground workflows clearly.
- Screenshots match current UI.
- No sensitive keys, local paths, or private data appear in release assets.

## Proposed Version Plan

| Version | Theme | Scope |
| --- | --- | --- |
| v0.3.3-2026-05 | Refactor preparation | Contracts, dependency map, split first large UI modules behind existing routes. |
| v0.4.0-2026-06 | Product IA refactor | Foreground Fine-tune, Compare, Models, Benchmarks, Retrieval, and Experiments routes; admin narrowed to ops/config/audit. |
| v0.4.1-2026-06 | Experiment timeline | Unified experiment history and cross-links across fine-tune, compare, benchmark, session, model install. |
| v0.5.0-2026-07 | Release-grade studio | Public docs, whitepaper, screenshots, packaged workflows, stronger governance and artifact export. |

## Definition of Done for the Refactor

- Daily user workflows no longer require `/admin` as the main entry.
- `/admin` reads as monitoring, configuration, management, and audit.
- Large UI files are split into cohesive feature components.
- Domain/application/infrastructure/UI boundaries are explicit.
- API routes are thin and typed.
- Fine-tune, Compare, Benchmark, Models, Providers, Retrieval, and Experiments can evolve independently.
- Route smoke, screenshot smoke, lint, and partitioned typecheck pass for changed areas.
- New release docs and screenshots reflect the new product IA.

## Phase 0 / Phase 1 Starting Artifacts

The first ownership and contract seams now live in:

- [`docs/route-module-ownership-matrix.md`](./route-module-ownership-matrix.md)
- `features/finetune/contracts.ts`
- `features/compare/contracts.ts`
- `components/finetune/FineTuneStudioShell.tsx`
- `app/fine-tune/page.tsx`
- `app/compare/page.tsx`

These files are intentionally contract-first. Existing routes and large components can keep working while new code starts importing stable feature contracts instead of deep store/provider internals.

## Current Refactor Checkpoint

- Fine-tune persistence and operations have been split behind `lib/finetune/*-service.ts`, with `store.ts` kept as a compatibility facade.
- Evaluation, Chat Adapter, Export, and Distillation each have a dedicated operation service and are imported directly by the fine-tune API route.
- `FineTuneStudioPanel.tsx` now owns foreground Fine-tune composition under `components/finetune`, delegates setup, run-mode, and evidence composition to `components/finetune/composers/*`, delegates their view-model state creation to `features/finetune/studio-view-model-adapters.ts`, delegates their prop assembly to `features/finetune/studio-composer-adapters.ts`, and reuses panels under `components/finetune/panels/*`; `AdminFineTunePanel.tsx` is only a compatibility wrapper for the admin mirror.
- Compare physical extraction covers the prompt composer, lane matrix, review drawer, lane preview, recipe matrix/gallery, and execution handoff under `features/compare/components/*`; the zero-caller `components/agent/compare/*`, `AgentCompareLab.tsx`, and `AgentRecipeGallery.tsx` compatibility paths were removed on 2026-07-11.
- Foreground `/fine-tune`, `/compare`, `/models`, `/benchmarks`, `/retrieval`, and `/experiments` routes are live as product IA shells. Retrieval now owns document/import/query UI and Experiments owns timeline navigation and retention; `/admin` remains the monitoring/configuration mirror while deeper governance services continue to move forward.
- Compare reducer state, workbench implementation, composer/review/lane components, orchestration, lifecycle, persisted preferences, reproduce artifacts, recipe apply/run behavior, route shell, embedded Agent adapters, dynamic loading shell, and prop adapters live under `features/compare/*`; `AgentWorkbench.tsx` delegates embedded Compare orchestration, preference input persistence, and reproduce artifacts through feature ports without Agent-side compatibility exports.
- Agent session sorting/normalization/merge/export/Markdown serialization/title generation/turn flattening now live under `features/agent/session-model.ts`; localStorage session/preference persistence, server snapshot GET/PUT transport, conflict payload normalization, sync outcome parsing, and snapshot merge helpers live under `features/agent/session-persistence.ts`; stored workbench preference normalization/building lives under `features/agent/workbench-preferences.ts`; restored session/preference apply rules live under `features/agent/session-apply.ts`; initial hydration, server reload, runtime switch history persistence, active session autosave, server sync, force overwrite, and session sidebar selectors now live under `features/agent/session-hydration.ts`, `features/agent/session-server-sync.ts`, and `features/agent/session-sidebar-selectors.ts`; get-code/runtime rail/session filter state starts in `features/agent/workbench-shell-state.ts`; runtime rail state, connection/scan state, transcript scroll/unseen state, and copy/replay state now start in `features/agent/runtime-shell-state.ts`, `features/agent/connection-shell-state.ts`, `features/agent/transcript-shell-state.ts`, and `features/agent/copy-replay-state.ts`; runtime status polling/prewarm/release/restart/log API actions and target scan/connection-check API actions now live in `features/agent/runtime-actions.ts` and `features/agent/connection-actions.ts`; target catalog rendering, runtime/status rail rendering, provider self-check rendering, transcript follow tooling, composer controls, session tools, workspace file preview/open-fetch tooling, tool review rendering, tool-run review cards, full transcript turn cards, and runtime/target formatters now live in `features/agent/target-catalog-panel.tsx`, `features/agent/runtime-status-rail.tsx`, `features/agent/agent-provider-self-check-panel.tsx`, `features/agent/transcript-follow-banner.tsx`, `features/agent/agent-composer-form.tsx`, `features/agent/session-tools-panel.tsx`, `features/agent/workspace-file-preview-panel.tsx`, `features/agent/workspace-file-actions.ts`, `features/agent/agent-tool-review-panel.tsx`, `features/agent/agent-tool-run-review-card.tsx`, `features/agent/agent-transcript-turn-card.tsx`, and `features/agent/runtime-formatters.ts`.
- Fine-tune shared surface state, setup dataset/recipe state, train/evaluate/chat/export run form state, setup/run/evidence view-model adapters, workflow step contracts, command/YAML preview builders, submit handlers, clipboard/report actions, UI-only chart/report caches, community preset actions/catalog metadata, training args snapshot, tab submit actions, Runs/Assets job actions, and adapter runtime/handoff/proof-loop orchestration now live under `features/finetune/*`; `/fine-tune` now assembles the studio without depending on `AdminFineTunePanel.tsx`.
- Models and Benchmark now have route ownership contracts under `features/models/contracts.ts` and `features/benchmark/contracts.ts`; model discovery/install UI is renamed into `features/models/ModelDiscoveryPanel.tsx`, `/api/models/discovery` and `/api/admin/model-discovery` delegate to `features/models/application.ts`, and benchmark run, release-evidence, prompt-set, progress/control, baseline, and report routes delegate into `features/benchmark/*application.ts`. Benchmark runner internals are also split into `run-plan`, `run-request-context`, `run-targets`, `run-progress-plan`, `run-results`, `run-network`, `run-control`, `run-control-response`, `run-lifecycle`, `run-local-runtime-lifecycle`, `run-local-prewarm`, `run-local-prewarm-failure`, `run-concurrency`, `run-log`, `run-payload`, `local-sample-runner`, `remote-sample-runner`, `run-sample-orchestration`, `run-result-builders`, `run-result-group`, `run-group-execution`, `run-completion-policy`, `run-execution-outcome`, `run-execution`, and `run-progress` ports so request normalization, target selection, planned progress groups, response context creation, progress initialization, run lifecycle runtime, run controller/heartbeat cleanup, local runtime prepare/release, payload building, control partial responses, per-target result group execution, local prewarm failure handling, local/remote sample execution, local/remote group execution, result aggregation, skipped-sample construction, route-level execution sequencing, completion/log/progress finish policy, execution outcome mapping, and progress lifecycle are no longer owned by the route application body.
- 2026-06-11 continuation checkpoint: repository Git metadata and tracked source readability were restored without discarding the active refactor diff; dataless source placeholders and the dependency tree were repaired so partitioned typecheck can produce real results again. Admin no longer renders benchmark configuration/run/report controls: it now uses `features/benchmark/AdminBenchmarkHandoffPanel.tsx` to hand work to `/benchmarks`, while provider health, release evidence, and regression history remain in the governance mirror. `features/benchmark/run-application.ts` now delegates route sequencing to `run-execution.ts`, with completion and execution outcomes behind dedicated ports.
- 2026-06-11 Phase 4 boundary checkpoint: unreachable Benchmark prompt-set/run-control/baseline/report-preview state and actions were removed from `AdminDashboard.tsx`; Models and Fine-tune full product mirrors were replaced by compact `features/admin/AdminFeatureHandoffPanel.tsx` governance handoffs. Embedded Agent Compare session preference snapshot/apply behavior now enters Agent through one `CompareSessionPreferencePort`, and lane target reconciliation lives in the Compare adapter. Timeline contracts, service access, and the thin admin API handler now live in `features/experiments/*`; session, compare, benchmark, and fine-tune event producers no longer import the JSONL timeline store directly.
- 2026-06-12 Phase 4 artifact checkpoint: `ExperimentEvent` now carries structured artifact and entity-link references; Fine-tune job/operation/runtime events expose bundles, reports, datasets, logs, and adapter directories; Fine-tune handoffs preserve adapter/job/dataset lineage through Compare and Benchmark report events. Retrieval CRUD/query, model discovery/install/verify/cleanup, and provider connection checks now produce timeline events. Compare, Fine-tune, Admin dashboard, Retrieval, and Provider connection routes are thin re-exports over feature application handlers; shared runtime prewarm logic moved to `features/agent/runtime-prewarm.ts`.
- 2026-06-12 Phase 5 foreground/evidence checkpoint: Agent stream/resume/tool-decision transport and stream event reduction moved to `features/agent/chat-actions.ts`, with runtime phase/stage/guardrail projection in `runtime-view-model.ts`. `/retrieval` and `/experiments` are foreground routes with canonical APIs; Admin's unreachable Retrieval state/actions were deleted and replaced by a governance handoff. Experiments now supports retention and artifact cross-link navigation. README, route ownership, release process, route smoke, and screenshot smoke include both routes.
- 2026-06-12 v0.4 release checkpoint: Agent submit/replay/resume/tool-decision lifecycle moved to `features/agent/turn-lifecycle.ts`, and secondary prompt/hint/provider panels moved to `secondary-analysis-panel.tsx`. Admin runtime requests live in `features/admin/runtime-operations.ts`; provider/telemetry projections live in `dashboard-read-model.ts`. `/api/finetune` is canonical, and legacy Fine-tune/Retrieval/Models/Timeline Admin APIs expose deprecation, sunset, and successor headers.
- 2026-07-10 GA hardening checkpoint: Provider release probes, SHA-256 verified snapshots, pin/delete/retention/export rules, and Provider target rendering live under `features/providers`; pinned evidence is bounded by the underlying event time. Admin compatibility wrappers expose a per-route deletion manifest and gated operator sign-off, route smoke preserves historical trend evidence, and `/experiments` owns a checksummed GA bundle with history/export/retention plus release security preflight. Agent runtime and connection shell state now enter `AgentWorkbench` through `features/agent/runtime-connection-shell.ts`, with actions composed by the narrower runtime and connection ports.
- 2026-07-10 GA auditability checkpoint: security preflight and route-smoke reports now have checksummed history; GA evidence separates persisted-file integrity from live-state drift and exposes source drilldowns. Provider Ops Admin composition lives in `ProviderOpsAdminShell`, Provider/GA/compatibility routes delegate to feature application services, and Agent runtime plus connection actions enter through `runtime-connection-composition.ts`.
- 2026-07-10 Admin/Agent boundary checkpoint: Admin benchmark release evidence, benchmark history composition, match-source formatting, and provider comparison rendering moved into feature-owned panels. Agent target/profile, outer sidebar identity, tool registry, and runtime rail prop assembly moved behind `features/agent` composition ports. Workspace file reads, connection-check history/export, protected-tool decisions, and runtime status/target resolution now use feature-owned application services with thin API routes.
- 2026-07-11 shell and analysis checkpoint: zero-caller Agent Compare compatibility exports were deleted; Get Code, header, status band, prompt strip, conversation/session projections, and panel prop assembly moved under `features/agent`. Admin telemetry/runtime presentation and Benchmark heatmap/failure interpretation moved into owning feature modules. Runtime application results are transport-neutral and the API route alone owns `NextResponse` serialization.
- 2026-07-11 workspace and runtime-card checkpoint: Agent sidebar/main/layout and Chat/Compare mode rendering now compose under `features/agent`, leaving `AgentWorkbench` as the state/action creator. Admin runtime target derivation, six hardware metric charts, and log search/summary rendering moved into feature-owned view-model and panels. Remote runtime status construction moved out of the local gateway application body.
- 2026-07-11 session, runtime-state, and history-detail checkpoint: Agent session commands/export and turn-lifecycle input assembly moved behind feature-owned action/application adapters. Admin runtime trace plus model-state/action rendering and Benchmark history identity/run-note detail rendering moved into governance feature panels. Local runtime recovering/ready/unavailable status builders moved out of the probing application, leaving the application focused on target resolution, health checks, auto-start, and metric collection.
- 2026-07-11 local GA closure checkpoint: Agent base chat/session state creation, Benchmark result groups, Admin recent-history/model/context operations rendering, and local runtime probe/ensure policy moved into owning feature modules. Compatibility deletion now has a 5/5 pre-sunset rehearsal, the public demo manifest covers nine 2x-DPR product/evidence flows, and a real DeepSeek release probe satisfies the current Provider promotion window without weakening the dated sunset or cloud-production gates.
- 2026-07-12 v1.0.1 non-cloud hardening checkpoint: Agent target/locale/session projection/export effects, Admin filter/query/report/progress/runtime-history glue, and Benchmark coverage/heatmap rendering moved behind feature-owned hooks, applications, and panels. Compatibility rehearsal is exportable, screenshot dimensions and digests are validated into a durable report, and the GA bundle contains a dedicated local-closure source. The release train now truthfully marks v0.5-v0.8.1 complete, v0.9 blocked, and v1.0 active.
- 2026-07-12 post-v1 ten-slice foundation checkpoint: desktop first-run diagnostics, durable model acquisition jobs, local server instances, runtime adapter conformance, signed extension policy, typed workflow graphs, workspace identity, training backend capability checks, unified artifact packages, and HA/FinOps readiness now live behind domain-owned contracts and thin APIs. Experiments renders a separate foundation-evidence panel so these early slices do not promote the planned releases; real desktop signing, transfer workers, community installation, database tenant isolation, additional training/runtime adapters, publishing, and cloud production evidence remain explicit next work.
- 2026-07-12 executable foundation checkpoint: local package receipts now drive install/upgrade/rollback/uninstall rehearsal while Developer ID remains separate; model acquisition executes bounded Range transfers with pause/resume and SHA-256; Ollama has a live health/discovery/prewarm/unload adapter; extension verification writes accepted/rejected receipts and quarantines tampered bytes; workflow graphs have a persisted reducer with approval/resume/idempotency; workspace ACL is enforced by versioned SQLite migrations and parameterized authorization joins. The real rehearsal passes all local executable checks while live Ollama, Apple notarization, sandbox execution, Postgres RLS, and external identity stay unresolved.

## Immediate Next Step

### P0 Insert: Studio Visual Convergence

Before the remaining extraction work continues, align product templates around the current Agent and Fine-tune modules. They are now the canonical design standard for foreground workbench surfaces.

This inserted priority applies to:

- `/compare` route shell, sidebar composition, recipe panels, review drawer, lane previews, and embedded Agent Compare entry.
- `/models` discovery/install route and admin compatibility mirror.
- `/benchmarks` run controls, progress, history, release evidence, and admin mirror.
- `/admin` dashboard/config/audit surfaces that should mirror the studio language instead of defining a separate template family.

Acceptance for this P0 pass:

- Agent and Fine-tune remain the visual references: dark-glass workbench, compact identity bands, dense segmented controls, semantic status chips, and scan-friendly side rails.
- Other templates no longer feel like separate admin/marketing layouts.
- Route/module ownership docs and screenshot smoke stay aligned with the visual convergence, so architecture movement does not preserve obsolete template patterns.
- New route templates should start from `components/layout/StudioPageShell.tsx`; `/api/admin/finetune` summary shape is covered by route smoke before deeper Fine-tune/API extraction continues.

The visual convergence pass is now established across the foreground shells. Continue from the route/module ownership matrix with these remaining Phase 2-5 boundaries:

1. Keep the successful remote Provider request or pinned release-probe evidence inside the 24-hour promotion window when preparing an actual release candidate.
2. Archive final zero-hit compatibility evidence and delete deprecated wrappers only after the September 30, 2026 sunset.
3. Run the fail-closed production rehearsal only after real workload identity, KMS, and immutable object-storage configuration are available.
4. Re-run the nine-flow screenshot capture, route smoke, security preflight, and GA bundle write immediately before the final tag candidate.
5. Continue shrinking the remaining large Agent chat stream, runtime action, targets, recipes, and Admin dashboard application routes into transport-neutral feature services.

The next extraction should keep shrinking generic Agent shell state around the outer transcript container and Agent-owned chat orchestration, while Benchmark can continue moving result orchestration and runtime/control policies behind smaller service ports and Fine-tune workflow contracts become the source of tab routing.
