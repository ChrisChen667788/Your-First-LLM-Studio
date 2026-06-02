"use client";

import {
  FineTuneStudioPanel,
  type FineTuneStudioPanelProps,
} from "@/components/finetune/FineTuneStudioPanel";

type AdminFineTunePanelProps = FineTuneStudioPanelProps;

export function AdminFineTunePanel({
  locale,
  surface = "admin-embedded",
}: AdminFineTunePanelProps) {
  return <FineTuneStudioPanel locale={locale} surface={surface} />;
}
