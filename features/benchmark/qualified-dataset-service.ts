import type { AgentBenchmarkDataset } from "@/lib/agent/types";
import {
  MATH500_QUALIFIED_DATASET_ID,
} from "@/features/benchmark/qualification-contracts";
import {
  readBenchmarkQualification,
  readQualifiedMath500Rows,
} from "@/features/benchmark/qualification-service";

export function getQualifiedBenchmarkDataset(
  id?: string | null,
): AgentBenchmarkDataset | null {
  if (id !== MATH500_QUALIFIED_DATASET_ID) return null;
  const qualification = readBenchmarkQualification();
  const summary = qualification.qualifiedDataset;
  const rows = readQualifiedMath500Rows();
  if (!summary || !rows) return null;
  return {
    id: summary.id,
    label: summary.label,
    description: summary.description,
    sourceLabel: summary.sourceLabel,
    sourceUrl: summary.sourceUrl,
    taskCategory: summary.taskCategory,
    scoringLabel: summary.scoringLabel,
    sampleCount: rows.length,
    items: rows.map((row) => ({
      id: row.unique_id,
      prompt: `${row.problem}\n\nSolve concisely. End with exactly one final line in the form \\boxed{...}.`,
      evaluator: {
        kind: "math-equivalence",
        gold: row.answer,
        evaluatorId: "huggingface-math-verify",
        evaluatorVersion: "0.9.0",
        configId: "math-500-v1",
      },
      expectedAnswerPreview: row.answer,
      sourceSplit: "test",
      sourceSubset: `${row.subject} · level ${row.level}`,
      requiredModalities: ["text"],
    })),
  };
}
