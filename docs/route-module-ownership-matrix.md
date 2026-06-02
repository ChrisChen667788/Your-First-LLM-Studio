# Route and Module Ownership Matrix

Last updated: 2026-06-02
Refactor phase: Phase 0 ownership map

This matrix captures the current route ownership, the intended product surface, and the module boundary that should own future implementation. It is the routing companion to [`architecture-refactor-plan.md`](./architecture-refactor-plan.md).

## Ownership Rules

- Product routes are for daily user workflows.
- Admin routes are for monitoring, configuration, management, audit, and worker operations.
- API routes should be thin transport adapters over feature application services.
- UI components should depend on feature contracts and application ports, not deep persistence or provider internals.
- Cross-feature handoff should happen through typed contracts, timeline events, or report/artifact references.

## Current Route Matrix

| Route | Current Role | Current Primary Modules | Future Product Surface | Future Owner | Migration Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | Landing and product introduction. | `app/page.tsx`, layout/i18n copy. | `/` | `features/marketing` or app shell | Keep lightweight and release-oriented. |
| `/agent` | Main Agent workbench, chat, target selection, embedded Compare entry, runtime summary. | `components/agent/AgentWorkbench.tsx`, `features/compare/embedded-workbench-adapter.ts`, `features/compare/preference-persistence-model.ts`, `features/compare/reproduce-artifacts.ts`, `lib/agent/*` | `/agent` | `features/agent` + `features/compare` | Chat shell stays in Agent; embedded Compare wiring, compare preference hydration/persistence input, and Compare reproduce artifacts now go through feature-owned ports instead of inline orchestration/props assembly. |
| `/compare` | Foreground Compare Studio route with route-owned target sync, preferences, state/actions, recipe orchestration, and shell prop assembly. | `app/compare/page.tsx`, `features/compare/CompareStudioShell.tsx`, `features/compare/CompareRouteWorkbench.tsx`, `features/compare/CompareWorkbench.tsx`, `features/compare/CompareWorkbenchShell.tsx`, `features/compare/components/*`, `features/compare/CompareWorkbenchSidebar.tsx`, `features/compare/workbench-state-model.ts`, `features/compare/workbench-orchestration-model.ts`, `features/compare/workbench-shell-props.ts`, `components/agent/AgentCompareLab.tsx`, `components/agent/AgentRecipeGallery.tsx`, `components/agent/compare/*`, `features/compare/*` | `/compare` | `features/compare` | Product entry no longer borrows `AgentWorkbench`; `/compare` injects `sourceSurface: compare-studio` from `CompareRouteWorkbench`; the runtime workbench and composer/review/lane/recipe components now live under `features/compare`, while old Agent paths are compatibility re-exports for embedded Compare during shell cleanup. |
| `/fine-tune` | Foreground Fine-tune Studio entry for Train, Evaluate & Predict, Chat Adapter, Export, reports, and artifacts. | `app/fine-tune/page.tsx`, `components/finetune/FineTuneStudioShell.tsx`, `components/finetune/FineTuneStudioPanel.tsx`, `components/finetune/panels/*`, `features/finetune/*` | `/fine-tune` | `features/finetune` | Product entry injects `sourceSurface: fine-tune-studio`; foreground composition no longer depends on `AdminFineTunePanel`; surface/setup/run state, preview builders, submit handlers, clipboard/report actions, chart/report cache, preset catalog metadata, Runs/Assets job actions, and adapter runtime/handoff/proof-loop orchestration now start in `features/finetune`. |
| `/models` | Foreground model catalog and community install entry. | `app/models/page.tsx`, `app/api/models/discovery/route.ts`, `features/models/ModelsStudioShell.tsx`, `features/models/ModelDiscoveryPanel.tsx`, `features/models/contracts.ts`, `features/models/application.ts`, `components/admin/AdminModelDiscoveryPanel.tsx` | `/models` | `features/models` | Product route now imports the renamed model discovery/install panel from `features/models`; frontend calls `/api/models/discovery`, admin keeps a compatibility re-export, and model discovery API behavior delegates to `features/models/application.ts`. |
| `/benchmarks` | Foreground benchmark history, run controls, and release-evidence entry. | `app/benchmarks/page.tsx`, `features/benchmark/BenchmarksStudioShell.tsx`, `features/benchmark/contracts.ts`, `features/benchmark/application.ts`, `lib/agent/benchmark-*` | `/benchmarks` | `features/benchmark` | Product route now owns prompt benchmark run controls and progress display; admin remains the monitoring/config mirror while release evidence and prompt-set application wrappers live under `features/benchmark/application.ts`. |
| `/agent/full` | Full-size Agent variant. | `components/agent/AgentWorkbench.tsx` | `/agent` responsive mode | `features/agent` | Replace route fork with layout mode when shell is smaller. |
| `/agent/rescue` | Rescue/fallback Agent route. | Agent rescue shell. | `/admin/runtime` or diagnostics | `features/runtime` + `features/admin` | Keep only if needed for recovery; otherwise fold into admin diagnostics. |
| `/admin` | Dashboard, benchmark, fine-tune mirror, model discovery, provider health, runtime guardrails, timeline. | `components/admin/*`, `lib/agent/*`, `lib/finetune/*`, `lib/community/*` | Split across product and admin routes. | `features/admin` | Fine-tune, Compare, Models, and Benchmarks now have foreground entries; keep admin as monitor/config/queue mirror while full product run controls finish moving. |
| `/admin/full` | Full-size admin variant. | Admin shell. | `/admin` responsive mode | `features/admin` | Replace route fork with layout mode if possible. |
| `/admin/rescue` | Admin rescue console. | `AdminRescueConsole` | `/admin/runtime` diagnostics | `features/runtime` + `features/admin` | Keep for recovery and health checks. |
| `/focus` | Focus workflow. | `components/focus/*` | `/focus` | `features/focus` | Low priority for this refactor unless it touches sessions. |
| `/inbox` | Inbox workflow. | `components/inbox/*` | `/inbox` | `features/inbox` | Low priority for this refactor. |
| `/item/[id]` | Item details. | `components/item/*` | `/item/[id]` | `features/items` | Low priority for this refactor. |
| `/session-summary` | Session summary. | `components/session/*`, session store | `/experiments` or `/sessions` | `features/experiments` | Should become part of unified experiment/session history. |

## Current API Matrix

| API Route | Current Role | Future Owner | Target Shape |
| --- | --- | --- | --- |
| `/api/agent/chat` | Agent chat transport, provider/runtime/retrieval orchestration. | `features/agent/application` | Thin route over `AgentChatService`. |
| `/api/agent/compare` | Compare lane execution, local runtime prewarm/recovery, retrieval, provider calls. | `features/compare/application` | Thin route over `CompareRunService`; runtime/provider handled through ports. |
| `/api/agent/recipes` | Studio recipe list/persistence. | `features/compare` + `features/agent` | Split recipe contract by use case. |
| `/api/agent/runtime` | Runtime prewarm/release/status. | `features/runtime/application` | Runtime operations port. |
| `/api/agent/sessions` | Session snapshot and conflict behavior. | `features/experiments` or `features/sessions` | Session repository/service. |
| `/api/agent/targets` | Target catalog. | `features/models` + `features/providers` | Model/provider catalog read API. |
| `/api/admin/benchmark` | Benchmark run orchestration and history. | `features/benchmark/run-application` | Thin route re-export over the feature-owned runner handler; `/benchmarks` can now start prompt runs; runner internals now split plan/build, request context, target selection, progress plan assembly, results/delta, network/retry, control, lifecycle runtime, local runtime lifecycle, local prewarm, concurrency, log append, local/remote sample runners, sample orchestration, result builders, result group execution, payload/context builders, control response builders, local prewarm failure recording, and progress lifecycle ports. |
| `/api/admin/benchmark/baseline` | Benchmark baseline save/rename/default/delete. | `features/benchmark/baseline-application` | Thin route re-export over feature-owned baseline handlers. |
| `/api/admin/benchmark/progress` | Benchmark progress polling and stop/abandon controls. | `features/benchmark/application` | Thin route over progress read/control helpers; stale-worker handling is now in the feature application boundary. |
| `/api/admin/benchmark/prompt-sets` | Managed benchmark prompt sets. | `features/benchmark/application` | Thin route over prompt-set application helpers. |
| `/api/admin/benchmark/report` | Benchmark report export. | `features/benchmark/report-application` | Thin route re-export over feature-owned report preview/export handler. |
| `/api/admin/dashboard` | Admin metrics aggregation. | `features/admin/application` | Admin-only read model. |
| `/api/admin/finetune` | Fine-tune dataset/recipe/job/report/bundle/eval/chat/export operations. | `features/finetune/application` | Split into service actions behind typed contracts; route smoke now asserts the GET summary contract so `localTargets`, `datasets`, `recipes`, `jobs`, `adapters`, and `operations` cannot drift into a frontend-crashing shape unnoticed. |
| `/api/admin/knowledge-base` | Knowledge document CRUD/retrieval validation. | `features/retrieval/application` | Product retrieval management can move out of admin later. |
| `/api/admin/model-discovery` | Community model discovery/install/verify. | `features/models/application` | User-facing `/models`; admin only queue/cleanup/audit. |
| `/api/models/discovery` | Foreground model discovery/install/verify transport for `/models`. | `features/models/application` | Thin route re-export over the feature-owned model discovery handlers; `/api/admin/model-discovery` remains a compatibility mirror. |
| `/api/admin/runtime-guardrail` | Runtime safety policy configuration. | `features/runtime/application` | Admin policy editor; product consumes read-only risk results. |
| `/api/admin/timeline` | Unified timeline. | `features/experiments/application` | Product history and admin audit share same source. |

## Module Ownership Matrix

| Module Area | Current Location | Future Boundary | Notes |
| --- | --- | --- | --- |
| Agent shell and chat | `components/agent/AgentWorkbench.tsx`, `lib/agent/providers.ts` | `features/agent` | Shell should coordinate, not own Compare/Fine-tune internals. |
| Compare | `features/compare/CompareWorkbench.tsx`, `features/compare/components/*`, `features/compare/*`, `components/agent/AgentCompareLab.tsx`, `components/agent/AgentRecipeGallery.tsx`, `components/agent/compare/*`, `lib/agent/compare-*` | `features/compare` | Contract facade starts at `features/compare/contracts.ts`; `/compare` uses `CompareRouteWorkbench`, Agent embedded Compare uses feature adapters, and the old `components/agent/AgentCompareLab.tsx`, `components/agent/AgentRecipeGallery.tsx`, and `components/agent/compare/*` paths are now only compatibility re-exports. |
| Fine-tune | `components/finetune/*`, `features/finetune/studio-view-model-adapters.ts`, `features/finetune/studio-composer-adapters.ts`, `components/admin/AdminFineTunePanel.tsx`, `lib/finetune/*` | `features/finetune` | Foreground composition lives under `components/finetune` with setup/run/evidence composers plus feature-owned view-model and prop adapters; `AdminFineTunePanel` remains a thin admin mirror wrapper. Contract facade starts at `features/finetune/contracts.ts`; service seams now cover dataset/job/runtime/report/bundle/evaluation/chat-adapter/export/distillation. |
| Benchmark | `features/benchmark/*`, `components/admin/AdminDashboard.tsx`, `lib/agent/benchmark-*`, admin benchmark routes | `features/benchmark` | Product `/benchmarks` now owns history/evidence, prompt run controls, progress display, release-evidence wrappers, prompt-set helpers, progress/control helpers, baseline/report handlers, and the physically migrated runner handler; runner internals have service ports for plan/build, run request context, target selection, progress plan assembly, results/delta, network/retry, control, run lifecycle runtime, local runtime lifecycle, local prewarm, concurrency, log append, local/remote sample execution, sample orchestration, result builders, result group execution, payload/context/control response builders, local prewarm failure recording, progress group lifecycle, and local/remote group execution. |
| Models and installs | `features/models/*`, `app/api/models/discovery/route.ts`, `lib/community/model-discovery.ts`, Agent target sidebar, admin discovery compatibility wrapper | `features/models` | Product `/models` now owns the route shell, renamed discovery/install panel, foreground model discovery API, and model-discovery application wrapper; admin keeps a thin re-export mirror. |
| Retrieval | `lib/agent/retrieval-*`, admin knowledge-base route | `features/retrieval` | Product knowledge workflow can later move to foreground. |
| Providers | `lib/agent/providers.ts`, `provider-health-desk.ts`, remote policies | `features/providers` | Provider quirks live behind ports/adapters. |
| Runtime | `lib/agent/local-gateway.ts`, `runtime-*`, runtime API routes | `features/runtime` | Runtime risk and process control should be reusable across product/admin. |
| Experiments/timeline | `lib/agent/timeline-store.ts`, session store, fine-tune/benchmark events | `features/experiments` | Unified history should stitch sessions, compare, benchmark, fine-tune, installs. |
| Admin | `components/admin/*`, admin routes | `features/admin` | Admin composes monitoring/config/audit views only. |

## First Extraction Order

0. P0 inserted before remaining refactor work: align `/compare`, `/models`, `/benchmarks`, `/admin` mirrors, and future templates to the current Agent + Fine-tune studio/workbench design standard before continuing deeper ownership moves.
1. Fine-tune contracts and service seams.
2. Compare contracts and service seams.
3. Fine-tune UI split behind current `/admin` route.
4. Compare UI split behind current `/agent` route.
5. Foreground `/fine-tune` and `/compare` route shells. ✅ `/fine-tune` no longer depends on `AdminFineTunePanel`; `/compare` no longer depends on `AgentWorkbench` and now composes its state/actions through `CompareRouteWorkbench`.
6. Models and Benchmarks foreground route shells. ✅ Initial `/models` and `/benchmarks` shells added with feature contracts.
7. Admin cleanup and route deprecation notes. In progress; admin still hosts full benchmark run controls and model discovery compatibility UI.

## Guardrails Before Moving Code

- Treat current `/agent` and `/fine-tune` as the canonical visual/interaction source of truth for foreground templates. Route shells and mirrors should converge through `components/layout/StudioPageShell.tsx` before more architecture-only cleanup preserves older template language.
- Do not move persistence and UI in the same patch unless the contract already exists.
- Do not change URLs and file boundaries in the same patch unless route smoke is updated.
- Do not remove current `/admin` entry points until foreground routes pass route and screenshot smoke.
- Every feature crossing should use a contract type, application service, timeline event, or artifact reference.

## Phase 2 / Phase 3 In-Progress Notes

- `lib/finetune/store.ts` is now a compatibility facade over split services; direct API imports should prefer the owning service file.
- `evaluation-service`, `chat-adapter-service`, `export-service`, and `distillation-service` own their operation-specific artifact writes and timeline events.
- `/fine-tune`, `/compare`, `/models`, and `/benchmarks` are foreground product entries, while `/admin` remains the monitoring/configuration mirror until Benchmark run controls and model install management fully move forward.
- `AgentCompareSourceSurface` and `AgentFineTuneSourceSurface` now live in `lib/agent/types.ts`; feature contracts alias those types so route ownership and API requests share the same vocabulary.
- Compare frontend state, workbench implementation, composer/review/lane/recipe components, workbench state model, workbench orchestration model, lifecycle, preference persistence model, reproduce artifacts, review helpers, action calls, recipe persistence, recipe apply/run orchestration, `/compare` route shell, route-owned target sync/preferences, embedded Agent Compare adapter, Compare dynamic-loading shell, and workbench prop adapter now route through `features/compare/*`; remaining old Agent Compare files are compatibility re-exports, and remaining Compare work is mostly shrinking generic Agent session/chat coupling around the embedded entry.
- Fine-tune frontend action calls plus surface, setup, run form state, preview builders, submit handlers, clipboard/report actions, chart/report cache, community preset actions/catalog metadata, training args snapshot, tab submit actions, Runs/Assets job actions, and adapter runtime/handoff/proof-loop orchestration now route through `features/finetune/*`; `/fine-tune` now uses `FineTuneStudioPanel` directly, with setup/run/evidence composers and feature-owned prop adapters splitting the foreground composition.
- Route and screenshot smoke now include `/compare`, `/fine-tune`, `/models`, and `/benchmarks` so product IA movement has regression coverage before admin entry points are narrowed further.
