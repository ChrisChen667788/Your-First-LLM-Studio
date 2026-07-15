import { runRemoteConnectionCheck } from "@/lib/agent/connection-check";
import { resolveTarget } from "@/lib/agent/providers";
import { getServerAgentTarget } from "@/lib/agent/server-targets";

export async function runProviderReleaseProbe(targetId: string) {
  const target = getServerAgentTarget(targetId);
  if (!target) {
    throw new Error(`Unknown provider target: ${targetId}`);
  }
  if (target.execution !== "remote") {
    throw new Error("Release probes only apply to remote provider targets.");
  }
  if (target.transport !== "openai-compatible") {
    throw new Error(
      `${target.label} does not use the OpenAI-compatible transport required by release probes.`,
    );
  }

  const resolvedTarget = resolveTarget(targetId);
  if (!resolvedTarget.resolvedApiKey) {
    throw new Error(
      `${target.label} is not configured. Set ${target.apiKeyEnv || "its API key"} before running a release probe.`,
    );
  }

  return runRemoteConnectionCheck(targetId, {
    mode: "quick",
    log: true,
    evidencePurpose: "release-probe",
  });
}
