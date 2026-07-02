import type {
  ReleaseTrainMilestone,
  ReleaseTrainResponse,
} from "@/features/experiments/contracts";

export const RELEASE_TRAIN_ACTIVE_VERSION = "v0.5.0" as const;

export const RELEASE_TRAIN_MILESTONES: ReleaseTrainMilestone[] = [
  {
    version: "v0.5.0",
    label: "Admin Ops v2",
    status: "active",
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
    nextSlice: "Finish retry/timeout strategy visualization and release evidence grouping.",
  },
  {
    version: "v0.5.1",
    label: "Public Release System",
    status: "planned",
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
      "Screenshot smoke includes public docs and roadmap.",
      "Distillation sample manifest links to Dataset Pipeline evidence.",
    ],
    nextSlice: "Add public roadmap route and demo capture manifest.",
  },
  {
    version: "v0.6.0",
    label: "Unified Model Hub",
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
    status: "planned",
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
      "Failover rehearsal report with RPO/RTO and signed receipts.",
    ],
    nextSlice: "Add durable usage outbox and external audit archive adapter.",
  },
  {
    version: "v1.0.0",
    label: "Local LLM Studio GA",
    status: "planned",
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
    nextSlice: "Define GA release gate and block criteria after v0.9 evidence lands.",
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
