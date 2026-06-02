"use client";

import type { CompareWorkbenchProps } from "@/features/compare/CompareWorkbench";
import { CompareWorkbenchShell } from "@/features/compare/CompareWorkbenchShell";

export function CompareWorkbenchPortal(props: CompareWorkbenchProps) {
  return <CompareWorkbenchShell {...props} />;
}
