"use client";

import { ExperimentTimelinePanel } from "@/features/experiments/ExperimentTimelinePanel";

export function AdminTimelinePanel({ locale }: { locale: string }) {
  return <ExperimentTimelinePanel locale={locale} />;
}
