import type { ComponentProps } from "react";
import { AgentGetCodePanel } from "./get-code-panel";
import { AgentWorkbenchMain } from "./workbench-main";
import { AgentWorkbenchSidebar } from "./workbench-sidebar";
import { AgentWorkbenchSidebarContent } from "./workbench-sidebar-content";

export type AgentWorkbenchLayoutProps = {
  sidebarIdentity: ComponentProps<typeof AgentWorkbenchSidebar>["identity"];
  sidebarContentProps: ComponentProps<typeof AgentWorkbenchSidebarContent>;
  mainProps: ComponentProps<typeof AgentWorkbenchMain>;
  getCodeProps: ComponentProps<typeof AgentGetCodePanel>;
};

export function AgentWorkbenchLayout({
  sidebarIdentity,
  sidebarContentProps,
  mainProps,
  getCodeProps,
}: AgentWorkbenchLayoutProps) {
  return (
    <section className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-3 py-4 text-slate-100 sm:px-5 xl:px-6 2xl:px-8">
      <div className="mx-auto grid w-full max-w-[2100px] gap-5 xl:grid-cols-[408px_minmax(0,1fr)] 2xl:grid-cols-[456px_minmax(0,1fr)]">
        <AgentWorkbenchSidebar identity={sidebarIdentity}>
          <AgentWorkbenchSidebarContent {...sidebarContentProps} />
        </AgentWorkbenchSidebar>
        <AgentWorkbenchMain {...mainProps} />
      </div>
      <AgentGetCodePanel {...getCodeProps} />
    </section>
  );
}
