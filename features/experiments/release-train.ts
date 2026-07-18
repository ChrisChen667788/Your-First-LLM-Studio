import type {
  ReleaseTrainMilestone,
  ReleaseTrainResponse,
} from "@/features/experiments/contracts";

export const RELEASE_TRAIN_ACTIVE_VERSION = "v1.2.1" as const;

export const RELEASE_TRAIN_MILESTONES: ReleaseTrainMilestone[] = [
  {
    version: "v0.5.0",
    label: "Admin Ops v2",
    status: "complete",
    track: "ops",
    targetWindow: "2026-07",
    objective:
      "Promote Provider Health Desk v2, retry policy visibility, release evidence grouping, and Adapter Export into a stable operations layer.",
    scope: [
      "Provider health trend and recommendation model",
      "Retry, timeout, fallback policy read-model",
      "Benchmark to release evidence summary",
      "Adapter Export publish checklist and model card evidence",
    ],
    acceptance: [
      "Remote providers have actionable health, cost, and policy signals.",
      "Adapter export evidence is complete enough for GitHub or ModelScope release review.",
    ],
    evidence: [
      "Route smoke covers runtime operations contracts.",
      "Release note records Provider Health Desk and Adapter Export closure.",
    ],
    nextSlice:
      "Run a configured Provider Ops release probe, retain fresh remote evidence, and close the v0.5.0 promotion source.",
  },
  {
    version: "v0.5.1",
    label: "Public Release System",
    status: "complete",
    track: "release",
    targetWindow: "2026-07",
    objective:
      "Make public docs, screenshots, launch assets, contributor flow, and Distillation v1 repeatable instead of hand-assembled.",
    scope: [
      "Docs route and bilingual quickstart",
      "Demo capture and screenshot automation",
      "Public roadmap and contributor checklist",
      "Teacher to synthetic dataset to student adapter workflow",
    ],
    acceptance: [
      "A release can refresh docs, evidence, screenshots, and launch snippets from one workflow.",
      "Distillation data passes the same quality, source, and risk gates as imported datasets.",
    ],
    evidence: [
      "Route smoke covers the public release docs route and public release evidence API.",
      "Distillation sample manifest links to Dataset Pipeline evidence.",
      "Demo capture manifest refreshes release screenshots from repeatable routes.",
    ],
    nextSlice: "Capture public release screenshots and promote distillation evidence into the v0.5.1 release note.",
  },
  {
    version: "v0.6.0",
    label: "Unified Model Hub",
    status: "complete",
    track: "models",
    targetWindow: "2026-08",
    objective:
      "Merge download, install, verification, runtime state, hardware fit, and server controls into one model hub.",
    scope: [
      "Unified local/community model inventory",
      "Install verification and runtime readiness on each model card",
      "OpenAI-compatible local server controls",
      "Hardware budget and storage pressure policy",
    ],
    acceptance: [
      "A user can install, verify, load, unload, and inspect a model without leaving /models.",
      "Model state is canonical for Agent, Compare, Fine-tune, and Benchmark.",
    ],
    evidence: [
      "Model Hub route smoke covers discovery and runtime operations.",
      "Install verification events appear in Experiments timeline.",
    ],
    nextSlice: "Move model runtime state and server controls into the primary /models card grid.",
  },
  {
    version: "v0.6.1",
    label: "Runtime Profile Registry",
    status: "complete",
    track: "models",
    targetWindow: "2026-08",
    objective:
      "Promote temperature, context, tools, RAG, thinking, provider profile, and hardware budget into durable reusable runtime profiles.",
    scope: [
      "Backend profile registry",
      "Profile apply contract for Agent and Compare",
      "Developer API panel beside each model",
      "Token accounting and latency summary per profile",
    ],
    acceptance: [
      "Profiles can be saved once and reused across Agent, Compare, Benchmark, and API examples.",
      "Developer snippets reflect the active endpoint, key status, model, profile, and token accounting.",
    ],
    evidence: [
      "Runtime profile API smoke covers save/delete/read behavior.",
      "Request log drawer shows latency and token accounting from real turns.",
    ],
    nextSlice: "Wire profile apply into Agent target selection and Compare lane recipes.",
  },
  {
    version: "v0.7.0",
    label: "Enterprise RAG Starter",
    status: "complete",
    track: "rag",
    targetWindow: "2026-08",
    objective:
      "Turn Retrieval into an enterprise starter with vector storage, hybrid recall, rerank, citations, ACL filters, and evaluation sets.",
    scope: [
      "pgvector or Milvus adapter boundary",
      "Hybrid lexical/vector retrieval and reranker comparison",
      "Citation evidence and access-control filters",
      "RAG evaluation dataset and report",
    ],
    acceptance: [
      "A private document can be retrieved only by authorized queries.",
      "RAG quality is measured with citation, answer, and retrieval metrics.",
    ],
    evidence: [
      "ACL migration and query integration tests.",
      "Embedding/reranker comparison report.",
    ],
    nextSlice: "Add database-level ACL migration tests and reranker eval evidence.",
  },
  {
    version: "v0.7.1",
    label: "RAG Playground",
    status: "complete",
    track: "rag",
    targetWindow: "2026-09",
    objective:
      "Make knowledge bases a foreground playground with query replay, citation inspection, permission preview, and benchmark handoff.",
    scope: [
      "RAG-first playground layout",
      "Document and chunk inspection",
      "Query replay with reranker deltas",
      "Citation evidence export to Benchmark and Experiments",
    ],
    acceptance: [
      "Users can debug why a citation was selected or rejected.",
      "RAG runs can become repeatable benchmark cases.",
    ],
    evidence: [
      "Retrieval route screenshot with citation drilldown.",
      "Experiments lineage from retrieval query to benchmark report.",
    ],
    nextSlice: "Add query replay drawer and citation failure labels.",
  },
  {
    version: "v0.8.0",
    label: "Fine-tune Pro",
    status: "complete",
    track: "finetune",
    targetWindow: "2026-09",
    objective:
      "Close the professional LoRA loop from recipe contract to eval, best checkpoint, charts, export, and adapter attach.",
    scope: [
      "LLaMA-Factory-parity train/eval/chat/export tabs",
      "Best checkpoint selector and marker layer",
      "Eval and save event chart overlays",
      "Recipe contract compatibility and YAML builder",
    ],
    acceptance: [
      "A LoRA recipe is durable, reproducible, and executable from UI, YAML, command, and worker bundle.",
      "Best checkpoint can be exported, attached, compared, and benchmarked directly.",
    ],
    evidence: [
      "Real multi-round LoRA run with chart export.",
      "Report includes best checkpoint and eval marker evidence.",
    ],
    nextSlice: "Promote Evaluate & Predict and Chat Adapter into dedicated foreground tabs.",
  },
  {
    version: "v0.8.1",
    label: "Adapter Lifecycle",
    status: "complete",
    track: "finetune",
    targetWindow: "2026-09",
    objective:
      "Manage adapter variants, merges, quantization plans, distillation datasets, and rollback-safe runtime attachment.",
    scope: [
      "Adapter registry and provenance",
      "Merge and quantized export plan",
      "Runtime attach/detach proof loop",
      "Adapter to Compare to Benchmark lineage",
    ],
    acceptance: [
      "Every adapter variant has source recipe, dataset, metrics, and export evidence.",
      "Runtime attachment can be verified and rolled back without breaking Agent sessions.",
    ],
    evidence: [
      "Adapter manifest diff and attach proof log.",
      "Compare and Benchmark lineage links from adapter registry.",
    ],
    nextSlice: "Add adapter registry filters and rollback evidence.",
  },
  {
    version: "v0.9.0",
    label: "Production Control Plane",
    status: "blocked",
    track: "deployment",
    targetWindow: "2026-10",
    objective:
      "Stabilize deployment registry, quota, audit, workload identity, telemetry, KMS signing, and failover rehearsals.",
    scope: [
      "Deployment registry optimistic concurrency",
      "Audit outbox and external archive",
      "Quota/token accounting adapters",
      "Workload identity, KMS receipt signing, and failover evidence",
    ],
    acceptance: [
      "Registry and quota decisions are auditable and concurrency-safe.",
      "Promotion, failover, and archive evidence can be rehearsed without manual patching.",
    ],
    evidence: [
      "Postgres-http runtime cutover evidence.",
      "Failover rehearsal report with RPO/RTO, AWS KMS receipts, and S3 Object Lock archive proof.",
    ],
    nextSlice: "Inject workload identity and run the cloud KMS/Object Lock rehearsal with requireCloud=true.",
  },
  {
    version: "v1.0.0",
    label: "Local LLM Studio GA",
    status: "complete",
    track: "release",
    targetWindow: "2026-10",
    objective:
      "Ship a coherent local-first LLM studio where Agent, Model Hub, RAG, Fine-tune, Benchmark, Compare, and Ops all share evidence contracts.",
    scope: [
      "End-to-end release evidence gate",
      "Public docs and packaged workflows",
      "Security and secret-scan checklist",
      "GitHub and ModelScope synchronized release process",
    ],
    acceptance: [
      "A new user can install, run, evaluate, fine-tune, retrieve, export, and audit from documented flows.",
      "Release evidence is complete, current, and reproducible from the repository.",
    ],
    evidence: [
      "Full route, screenshot, typecheck, audit, and release evidence bundle.",
      "GitHub and ModelScope fresh-clone verification.",
    ],
    nextSlice:
      "Refresh route smoke and screenshot evidence, keep Admin compatibility runtime hits at zero, retain fresh Provider Ops probe evidence, and archive final zero-hit evidence after sunset.",
  },
  {
    version: "v1.1.0",
    label: "Desktop Onboarding",
    status: "evidence-needed",
    track: "desktop",
    targetWindow: "2026-11",
    objective:
      "Match desktop-first products on installation, first-run diagnosis, upgrades, permissions, and background-service clarity without hiding runtime truth.",
    scope: [
      "Signed macOS application package and update channel",
      "First-run hardware, storage, gateway, and provider diagnosis",
      "Background service lifecycle and permission repair",
      "Fresh-install and upgrade migration rehearsal",
    ],
    acceptance: [
      "A new Apple Silicon user can reach a verified local chat without terminal setup.",
      "Upgrade, rollback, and uninstall preserve or deliberately migrate user data.",
    ],
    evidence: [
      "Clean-machine install and upgrade capture",
      "Signed package, migration, rollback, and uninstall manifests",
    ],
    nextSlice: "Promote the locally complete v1.1.0-rc.2 package only after Developer ID notarization and a trusted clean-machine organization receipt.",
  },
  {
    version: "v1.1.1",
    label: "Model Hub Lifecycle + Community DX",
    status: "evidence-needed",
    track: "models",
    targetWindow: "2026-11",
    objective:
      "Turn model acquisition, verification, storage, compatibility, and removal into one resumable lifecycle inspired by polished desktop model hubs.",
    scope: [
      "Download queue with pause, resume, checksum, and retry",
      "External-disk placement, migration, deduplication, and cleanup",
      "Format, license, tokenizer, template, and hardware compatibility checks",
      "Install-to-load-to-benchmark handoff from one model card",
      "Runtime recovery evidence, line-level tool citations, and compact benchmark issue exports",
      "Bilingual contributor onboarding, repository setup checklist, lane comparison, and reproducible demo capture",
    ],
    acceptance: [
      "Interrupted downloads resume without corrupting model state.",
      "Every installed model exposes verified bytes, provenance, runtime compatibility, and storage ownership.",
      "Runtime, benchmark, and tool evidence can be copied into an issue without reconstructing state from logs.",
      "A Chinese-speaking contributor can run, validate, document, and submit a focused change from one quickstart.",
    ],
    evidence: [
      "Interrupted-download and external-disk migration tests",
      "Model provenance and integrity manifest",
      "CI route-smoke artifact, benchmark issue-summary export, and Agent demo-video receipt",
      "Community/DX issue closure matrix linked to durable repository documentation",
      "Immutable multi-file Hub checksum receipt and physical-volume ownership manifest",
    ],
    nextSlice: "Refresh the rejected ModelScope token and rerun the passing 9-file/physical-volume workflow without anonymous mode to close authenticatedHubReceipt.",
  },
  {
    version: "v1.2.0",
    label: "Local Server Fleet",
    status: "evidence-needed",
    track: "runtime",
    targetWindow: "2026-12",
    objective:
      "Make OpenAI-compatible serving a first-class fleet with model hot-switch, idle eviction, request logs, profiles, and safe network exposure.",
    scope: [
      "One-click server start, stop, restart, and health diagnosis",
      "Multi-model hot-switch, pinned models, idle TTL, and auto-evict",
      "Request log drawer with token, latency, error, and profile evidence",
      "LAN binding, API keys, trusted hosts, CORS, and rate limits",
    ],
    acceptance: [
      "A model card can safely serve, switch, unload, and explain every state transition.",
      "Every request is attributable to endpoint, model, profile, token usage, latency, and caller key.",
    ],
    evidence: [
      "Hot-switch and idle-unload stress run",
      "Authenticated LAN server and request-accounting report",
      "Real Ollama 15-slice local acceptance with streaming, concurrency, accounting, and unload/reload evidence",
    ],
    nextSlice: "Retain separate-device authenticated LAN traffic and a sustained idle-eviction daemon window; local real-model acceptance is already 15/15.",
  },
  {
    version: "v1.2.1",
    label: "Runtime Fabric",
    status: "evidence-needed",
    track: "runtime",
    targetWindow: "2026-12",
    objective:
      "Expand beyond the MLX-first runtime while preserving one target, profile, health, accounting, and failure contract.",
    scope: [
      "MLX, llama.cpp, Ollama, LocalAI, vLLM, and SGLang adapters",
      "Apple Silicon, NVIDIA, AMD, Linux, Windows, and remote-node capability discovery",
      "Backend-neutral load, unload, prewarm, cancel, and health ports",
      "Routing by fit, latency, quality, cost, and residency policy",
    ],
    acceptance: [
      "Agent, Compare, Benchmark, and API callers do not depend on backend-specific payloads.",
      "Unsupported model/hardware combinations fail before download or execution with an actionable reason.",
    ],
    evidence: [
      "Backend conformance suite",
      "Cross-platform capability and failure-mapping matrix",
      "Real MLX, Ollama, and llama.cpp chat/stream acceptance through one normalized port",
      "Six implemented adapters with 42/42 normalized operation decisions",
    ],
    nextSlice: "Retain real LocalAI, Linux/NVIDIA vLLM and SGLang, plus heterogeneous remote-node failover receipts; the local three-backend fabric is complete.",
  },
  {
    version: "v1.3.0",
    label: "MCP and Extensions",
    status: "evidence-needed",
    track: "ecosystem",
    targetWindow: "2027-01",
    objective:
      "Add a permissioned extension ecosystem for MCP servers, tools, skills, provider adapters, and reusable product templates.",
    scope: [
      "MCP server registry and capability discovery",
      "Signed extension packages with version and compatibility metadata",
      "Per-tool permission, secret scope, confirmation, and audit policy",
      "Install, disable, update, rollback, and quarantine flows",
    ],
    acceptance: [
      "Community capabilities cannot bypass tool confirmation, secret boundaries, or audit evidence.",
      "Extension updates are reversible and dependency conflicts are visible before activation.",
    ],
    evidence: [
      "Malicious and incompatible extension rejection tests",
      "Signed package install, update, and rollback rehearsal",
    ],
    nextSlice: "Install one real community registry package and retain an OS-enforced sandbox acceptance receipt.",
  },
  {
    version: "v1.3.1",
    label: "Workflow Graph Studio",
    status: "complete",
    track: "workflow",
    targetWindow: "2027-01",
    objective:
      "Make Agent, RAG, evaluation, and protected-tool flows visually composable, versioned, replayable, and deployable as APIs.",
    scope: [
      "Typed graph nodes for model, retrieval, tool, guard, evaluator, and human approval",
      "Versioned workflow recipes and runtime profiles",
      "Breakpoint, replay, state diff, resume, and failure recovery",
      "Deploy-as-API with generated OpenAI-compatible examples",
    ],
    acceptance: [
      "A workflow can be reproduced from a versioned graph plus immutable input artifacts.",
      "Protected actions remain resumable and side effects remain idempotent across graph recovery.",
    ],
    evidence: [
      "Graph replay and protected-tool resume report",
      "Workflow version diff and deployed API smoke",
    ],
    nextSlice: "Retain fresh graph replay, protected-tool resume, state-diff, and deployed API route evidence.",
  },
  {
    version: "v1.4.0",
    label: "Team Governance",
    status: "evidence-needed",
    track: "governance",
    targetWindow: "2027-02",
    objective:
      "Promote ACL foundations into multi-user workspaces, enterprise identity, shared assets, policy, and auditable administration.",
    scope: [
      "Organizations, workspaces, roles, groups, and resource ACLs",
      "OIDC/SSO, SCIM, service accounts, and external secret vaults",
      "Shared knowledge bases, models, profiles, datasets, adapters, and workflows",
      "Policy simulation, approval queues, and immutable audit export",
    ],
    acceptance: [
      "Authorization is enforced in storage queries and application actions, not only hidden in UI controls.",
      "Identity, role, policy, and secret rotation events are externally auditable.",
    ],
    evidence: [
      "Database-level tenant and ACL isolation suite",
      "OIDC/SCIM lifecycle and policy-replay rehearsal",
    ],
    nextSlice: "Connect trusted OIDC and SCIM identities plus external secret scopes to the passing Postgres RLS boundary.",
  },
  {
    version: "v1.4.1",
    label: "Quality and Training Lab",
    status: "evidence-needed",
    track: "evaluation",
    targetWindow: "2027-02",
    objective:
      "Combine LLaMA-Factory-grade training compatibility with repeatable evaluation sweeps, judge calibration, and CI regression policy.",
    scope: [
      "Training backend capability matrix for LoRA, QLoRA, DoRA, preference, and distributed methods",
      "Hyperparameter sweeps with hardware budgets and early-stop policy",
      "Public benchmark adapters, custom eval sets, judge calibration, and confidence intervals",
      "PR/release regression gates with pinned datasets, models, prompts, and scoring versions",
    ],
    acceptance: [
      "The UI only offers train configurations supported by the selected model, backend, quantization, and hardware.",
      "Quality regressions are reproducible and attributable to a versioned model, adapter, prompt, dataset, and judge.",
    ],
    evidence: [
      "Training backend conformance and unsupported-combination report",
      "Pinned evaluation sweep with calibrated judge and CI gate",
    ],
    nextSlice: "Promote the fail-closed LLaMA-Factory preview into a production executor and add the remaining Transformers/PEFT adapter.",
  },
  {
    version: "v1.5.0",
    label: "Artifact Marketplace",
    status: "evidence-needed",
    track: "ecosystem",
    targetWindow: "2027-03",
    objective:
      "Publish and consume trusted model, adapter, dataset, RAG, evaluation, profile, and workflow packages with provenance.",
    scope: [
      "Unified artifact manifest, semantic versioning, dependencies, and compatibility",
      "Signing, license, attribution, safety, secret, and malware checks",
      "GitHub, ModelScope, Hugging Face, and private registry adapters",
      "Ratings derived from reproducible local evidence rather than popularity alone",
    ],
    acceptance: [
      "Every installed artifact has verifiable origin, digest, license, compatibility, and rollback state.",
      "Published quality claims link to reproducible benchmark or training evidence.",
    ],
    evidence: [
      "Cross-registry publish/install round trip",
      "Tampered package and incompatible dependency rejection report",
    ],
    nextSlice: "Run GitHub, ModelScope, and Hugging Face staging publish-install round trips from the signed local registry source.",
  },
  {
    version: "v1.5.1",
    label: "Enterprise HA and FinOps",
    status: "blocked",
    track: "platform",
    targetWindow: "2027-03",
    objective:
      "Close multi-node availability, durable accounting, immutable audit, capacity, and billing reconciliation after real cloud evidence is available.",
    scope: [
      "Multi-node registry, health routing, fencing, automatic promotion, and regional failover",
      "Durable usage outbox, quota policy, billing reconciliation, and exports",
      "OpenTelemetry/Langfuse operations, SLOs, alert receivers, and evidence retention",
      "Real KMS/HSM receipts, immutable archives, operator rotation, and organization sign-off",
    ],
    acceptance: [
      "Failover meets declared RPO/RTO without split-brain or duplicate billing side effects.",
      "Usage, audit, signing, archive, and organizational approval evidence reconcile end to end.",
    ],
    evidence: [
      "Multi-node failover and fencing rehearsal",
      "Cloud KMS/HSM, immutable archive, billing, and organizational receipt bundle",
    ],
    nextSlice: "Keep requireCloud fail-closed and resume this slice only when real workload identity and production manifests are available.",
  },
];

export function readReleaseTrain(): ReleaseTrainResponse {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    activeVersion: RELEASE_TRAIN_ACTIVE_VERSION,
    milestones: RELEASE_TRAIN_MILESTONES,
  };
}
