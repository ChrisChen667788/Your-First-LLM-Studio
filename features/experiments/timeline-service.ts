import {
  appendTimelineEvent,
  getTimelineFilePath,
  readTimelineEvents,
  rewriteTimelineEvents,
} from "@/lib/agent/timeline-store";
import type {
  AppendExperimentEventInput,
  ExperimentEvent,
  ReadExperimentTimelineOptions,
} from "@/features/experiments/contracts";

export function appendExperimentEvent(input: AppendExperimentEventInput) {
  return appendTimelineEvent(input as Parameters<typeof appendTimelineEvent>[0]) as ExperimentEvent;
}

export function readExperimentTimeline(options?: ReadExperimentTimelineOptions) {
  return readTimelineEvents(
    options as Parameters<typeof readTimelineEvents>[0],
  ) as ExperimentEvent[];
}

export function getExperimentTimelineFilePath() {
  return getTimelineFilePath();
}

export function rewriteExperimentTimeline(events: ExperimentEvent[]) {
  rewriteTimelineEvents(
    events as Parameters<typeof rewriteTimelineEvents>[0],
  );
}
