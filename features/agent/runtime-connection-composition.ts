"use client";

import { useAgentConnectionComposition } from "./connection-composition";
import { useAgentRuntimeComposition } from "./runtime-composition";

type RuntimeCompositionInput = Parameters<
  typeof useAgentRuntimeComposition
>[0];
type ConnectionCompositionInput = Parameters<
  typeof useAgentConnectionComposition
>[0];

type RuntimeConnectionCompositionInput = {
  runtime: RuntimeCompositionInput;
  connection: Omit<ConnectionCompositionInput, "mutations"> & {
    mutations: Omit<
      ConnectionCompositionInput["mutations"],
      "loadRuntimeStatus"
    >;
  };
};

export function useAgentRuntimeConnectionComposition({
  runtime: runtimeInput,
  connection: connectionInput,
}: RuntimeConnectionCompositionInput) {
  const runtime = useAgentRuntimeComposition(runtimeInput);
  const connection = useAgentConnectionComposition({
    ...connectionInput,
    mutations: {
      ...connectionInput.mutations,
      loadRuntimeStatus: runtime.loadRuntimeStatus,
    },
  });
  return { runtime, connection };
}
