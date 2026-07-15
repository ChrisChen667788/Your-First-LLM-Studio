import type { ComponentProps } from "react";
import type { AgentWorkbenchMode } from "@/lib/agent/types";
import { RuntimeStatusRail } from "./runtime-status-rail";
import { AgentWorkbenchHeader } from "./workbench-header";
import { AgentWorkbenchModeContent, type AgentWorkbenchModeContentProps } from "./workbench-mode-content";
import { AgentWorkbenchPromptStrip } from "./workbench-prompt-strip";
import { AgentWorkbenchStatusBand } from "./workbench-status-band";

export type AgentWorkbenchMainProps = {
  mode: AgentWorkbenchMode;
  headerProps: ComponentProps<typeof AgentWorkbenchHeader>;
  statusBandProps: ComponentProps<typeof AgentWorkbenchStatusBand>;
  promptStripProps: ComponentProps<typeof AgentWorkbenchPromptStrip>;
  modeContentProps: AgentWorkbenchModeContentProps;
  runtimeRailProps: ComponentProps<typeof RuntimeStatusRail>;
};

export function AgentWorkbenchMain({
  mode,
  headerProps,
  statusBandProps,
  promptStripProps,
  modeContentProps,
  runtimeRailProps,
}: AgentWorkbenchMainProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/75 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur">
      <AgentWorkbenchHeader {...headerProps} />
      <AgentWorkbenchStatusBand {...statusBandProps} />
      <div
        className={`grid gap-0 ${
          mode === "compare"
            ? "2xl:grid-cols-[minmax(0,1fr)_400px]"
            : "xl:grid-cols-[minmax(0,1.4fr)_420px] 2xl:grid-cols-[minmax(0,1.62fr)_500px]"
        }`}
      >
        <div className="border-b border-white/10 xl:border-b-0 xl:border-r xl:border-white/10">
          <AgentWorkbenchPromptStrip {...promptStripProps} />
          <AgentWorkbenchModeContent {...modeContentProps} />
        </div>
        <RuntimeStatusRail {...runtimeRailProps} />
      </div>
    </div>
  );
}
