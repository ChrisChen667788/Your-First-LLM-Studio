export type AgentSidebarCompositionInput = {
  shell: string;
  title: string;
  subtitle: string;
  targets: string;
  model: string;
  local: string;
  remote: string;
  healthHealthy: string;
  healthWarning: string;
  healthDegraded: string;
  healthUnknown: string;
};

export function buildAgentSidebarComposition(
  input: AgentSidebarCompositionInput,
) {
  return {
    identity: {
      eyebrow: input.shell,
      title: input.title,
      subtitle: input.subtitle,
    },
    targetLabels: {
      targets: input.targets,
      model: input.model,
      local: input.local,
      remote: input.remote,
      healthHealthy: input.healthHealthy,
      healthWarning: input.healthWarning,
      healthDegraded: input.healthDegraded,
      healthUnknown: input.healthUnknown,
    },
  };
}
