import type { ComponentProps } from "react";
import type { AppLocale } from "@/lib/i18n";
import { AgentSessionToolsPanel } from "./session-tools-panel";
import { AgentTargetProfilePanel } from "./target-profile-panel";
import { TargetCatalogPanel } from "./target-catalog-panel";
import { AgentToolRegistryPanel } from "./tool-registry-panel";

export type AgentWorkbenchSidebarContentProps = {
  locale: AppLocale;
  targetCatalogProps: ComponentProps<typeof TargetCatalogPanel>;
  targetProfileProps: ComponentProps<typeof AgentTargetProfilePanel>;
  sessionToolsProps: ComponentProps<typeof AgentSessionToolsPanel>;
};

export function AgentWorkbenchSidebarContent({
  locale,
  targetCatalogProps,
  targetProfileProps,
  sessionToolsProps,
}: AgentWorkbenchSidebarContentProps) {
  return (
    <>
      <TargetCatalogPanel {...targetCatalogProps} />
      <AgentTargetProfilePanel {...targetProfileProps} />
      <AgentSessionToolsPanel {...sessionToolsProps} />
      <AgentToolRegistryPanel locale={locale} />
    </>
  );
}
