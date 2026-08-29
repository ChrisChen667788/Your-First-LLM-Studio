import { createHash } from "node:crypto";

import {
  buildExternalAssuranceChainState,
  type ExternalAssuranceAnchor,
  type ExternalAssuranceArtifact,
  type ExternalAssuranceDefinition,
} from "@/features/experiments/external-assurance-chain";
export type SourceBackedSignalStatus =
  | "pass"
  | "attention"
  | "unavailable"
  | "external-only";

export type SourceBackedSignal<TId extends string = string> = {
  id: TId;
  status: SourceBackedSignalStatus;
};

export type SourceBackedSignalSnapshot<TSignal extends SourceBackedSignal> = {
  signals: TSignal[];
};

export type SourceBackedAssuranceDefinition<TId extends string = string> =
  ExternalAssuranceDefinition & {
  sourceSignalId: TId;
};

function projectionDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSourceBackedAssuranceProjection<
  TSignal extends SourceBackedSignal,
>(input: {
  definitions: SourceBackedAssuranceDefinition<TSignal["id"]>[];
  anchor: ExternalAssuranceAnchor;
  artifacts: ExternalAssuranceArtifact[];
  sourceSignals: SourceBackedSignalSnapshot<TSignal>;
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
  ) as TSignal[];
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
