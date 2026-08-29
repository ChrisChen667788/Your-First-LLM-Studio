import { createHash } from "node:crypto";

import {
  buildExternalAssuranceChainState,
  type ExternalAssuranceAnchor,
  type ExternalAssuranceArtifact,
  type ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
import type {
  GovernedAutonomySourceSignal,
  GovernedAutonomySourceSignalId,
  GovernedAutonomySourceSignalSnapshot,
} from "@/features/experiments/governed-autonomy-source-signals";

export type SourceBackedAssuranceDefinition = ExternalAssuranceDefinition & {
  sourceSignalId: GovernedAutonomySourceSignalId;
};

function projectionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSourceBackedAssuranceProjection(input: {
  definitions: SourceBackedAssuranceDefinition[];
  anchor: ExternalAssuranceAnchor;
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: GovernedAutonomySourceSignalSnapshot;
  now: number;
}) {
  const assurance = buildExternalAssuranceChainState({
    definitions: input.definitions,
    anchor: input.anchor,
    artifacts: input.artifacts,
    now: input.now,
  });
  const signals = new Map(input.sourceSignals.signals.map((entry) => [entry.id, entry]));
  const versions = assurance.versions.map((version, index) => ({
    ...version,
    sourceSignal:
      signals.get(input.definitions[index]!.sourceSignalId) || null,
  }));
  const selectedSignals = versions.flatMap((version) =>
    version.sourceSignal ? [version.sourceSignal] : [],
  ) as GovernedAutonomySourceSignal[];
  const sourceOwnedSignals = selectedSignals.filter(
    (entry) => entry.status !== "external-only",
  );
  const sourceSummary = {
    totalSignals: selectedSignals.length,
    sourceOwnedSignals: sourceOwnedSignals.length,
    passingSignals: selectedSignals.filter((entry) => entry.status === "pass").length,
    attentionSignals: selectedSignals.filter((entry) => entry.status === "attention").length,
    unavailableSignals: selectedSignals.filter((entry) => entry.status === "unavailable").length,
    externalOnlySignals: selectedSignals.filter((entry) => entry.status === "external-only").length,
  };
  const withoutDigest = {
    ...assurance,
    versions,
    localStatus: sourceOwnedSignals.every((entry) => entry.status === "pass")
      ? ("pass" as const)
      : ("attention" as const),
    sourceSummary,
    sourceSignalDigest: projectionDigest(selectedSignals),
    assuranceStateDigest: assurance.stateDigest,
  };
  return { ...withoutDigest, projectionDigest: projectionDigest(withoutDigest) };
}
