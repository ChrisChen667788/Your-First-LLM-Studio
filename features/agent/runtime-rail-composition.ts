import type {
  RuntimeStatusRailProps,
  RuntimeStatusRailText,
} from "./runtime-status-rail";

type RuntimeRailTextInput = Omit<
  RuntimeStatusRailText,
  "runtimeCurrentLoaded" | "runtimeSwitchingNow" | "runtimeLastSwitchLoad" | "runtimeLastSwitchAt"
> & Partial<Pick<
  RuntimeStatusRailText,
  "runtimeCurrentLoaded" | "runtimeSwitchingNow" | "runtimeLastSwitchLoad" | "runtimeLastSwitchAt"
>>;

export function buildRuntimeStatusRailText(
  input: RuntimeRailTextInput,
  locale: string,
): RuntimeStatusRailText {
  const en = locale.startsWith("en");
  return {
    ...input,
    runtimeCurrentLoaded: input.runtimeCurrentLoaded || (en ? "Loaded" : "已加载"),
    runtimeSwitchingNow: input.runtimeSwitchingNow || (en ? "Switching" : "切换中"),
    runtimeLastSwitchLoad: input.runtimeLastSwitchLoad || (en ? "Last load" : "最近加载"),
    runtimeLastSwitchAt: input.runtimeLastSwitchAt || (en ? "Last switch at" : "最近切换"),
  };
}

export function buildRuntimeStatusRailProps(
  input: RuntimeStatusRailProps,
): RuntimeStatusRailProps {
  return input;
}
