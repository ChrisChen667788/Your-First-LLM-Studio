import { createHash } from "node:crypto";

import { agentTargets } from "@/lib/agent/catalog";
import { getBenchmarkTargetCapability } from "@/features/benchmark/model-capabilities";
import { runMultimodalEvaluatorConformance } from "@/features/benchmark/multimodal-official-evaluators";
import type { MultimodalExecutionPlan } from "@/features/benchmark/reproducibility-contracts";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildMultimodalExecutionPlan(): MultimodalExecutionPlan {
  const target = agentTargets.find((entry) => entry.id === "minimax-m3") || null;
  const capability = target ? getBenchmarkTargetCapability(target) : null;
  const conformance = runMultimodalEvaluatorConformance();
  const candidateTarget = target && capability
    ? {
        id: target.id,
        label: target.label,
        modalities: capability.effectiveModalities,
        capabilityStatus: capability.evidenceStatus,
        officialDocsUrl: capability.officialDocsUrl,
      }
    : null;
  const protocols: MultimodalExecutionPlan["protocols"] = [
    {
      id: "mmmu",
      label: "MMMU",
      requiredModalities: ["text", "image"],
      adapterStatus: conformance.passed === conformance.total ? "pass" : "hold",
      executionStatus: "hold",
      judgeMode: "deterministic",
      requirements: [
        "Pinned official validation split and image assets",
        "Verified image-capable target and transport",
        "Seeded batch policy for otherwise unparseable choice output",
      ],
      blockers: ["Official image assets are not installed in the local evidence store."],
    },
    {
      id: "mathvista",
      label: "MathVista",
      requiredModalities: ["text", "image"],
      adapterStatus: conformance.passed === conformance.total ? "pass" : "hold",
      executionStatus: "hold",
      judgeMode: "external-required",
      requirements: [
        "Pinned official testmini/test split and image assets",
        "Verified image-capable target and transport",
        "Configured answer-extraction judge with auditable model/version",
      ],
      blockers: [
        "Official image assets are not installed.",
        "A calibrated extraction judge is not configured.",
      ],
    },
    {
      id: "mmbench",
      label: "MMBench",
      requiredModalities: ["text", "image"],
      adapterStatus: conformance.passed === conformance.total ? "pass" : "hold",
      executionStatus: "hold",
      judgeMode: "submission-required",
      requirements: [
        "Pinned circular-evaluation rows and image assets",
        "All circular variants must pass per item",
        "Official submission artifact and remote score receipt",
      ],
      blockers: [
        "Official image assets are not installed.",
        "External submission and score receipt are unavailable.",
      ],
    },
    {
      id: "video-mme-v2",
      label: "Video-MME v2",
      requiredModalities: ["text", "video"],
      adapterStatus: conformance.passed === conformance.total ? "pass" : "hold",
      executionStatus: "hold",
      judgeMode: "deterministic",
      requirements: [
        "Licensed official videos and annotations",
        "Verified native video target and bounded frame policy",
        "A-H extraction with grouped nonlinear scoring",
      ],
      blockers: ["Licensed videos are absent from the local evidence store."],
    },
  ];
  const blockers = [...new Set(protocols.flatMap((protocol) => protocol.blockers))];
  const withoutDigest = {
    schemaVersion: "benchmark.multimodal-execution-plan.v1" as const,
    generatedAt: new Date().toISOString(),
    localStatus:
      candidateTarget &&
      candidateTarget.modalities.includes("image") &&
      candidateTarget.modalities.includes("video") &&
      conformance.passed === conformance.total
        ? ("ready" as const)
        : ("hold" as const),
    productionStatus: "hold" as const,
    candidateTarget,
    protocols,
    conformance: { total: conformance.total, passed: conformance.passed },
    blockers,
  };
  return { ...withoutDigest, planDigest: digest(withoutDigest) };
}
