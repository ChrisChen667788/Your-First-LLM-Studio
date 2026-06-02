import type { ReactNode } from "react";
import { FineTuneSectionCard } from "./FineTuneSectionCard";

type FineTuneNamedSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const SECTION_EYEBROWS = {
  dataset: "Dataset",
  recipe: "Recipe",
  train: "Train",
  evaluate: "Evaluate",
  chatAdapter: "Chat adapter",
  export: "Export",
  reports: "Reports",
} as const;

function NamedSection({
  name,
  title,
  description,
  actions,
  children,
}: FineTuneNamedSectionProps & { name: keyof typeof SECTION_EYEBROWS }) {
  return (
    <FineTuneSectionCard
      eyebrow={SECTION_EYEBROWS[name]}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </FineTuneSectionCard>
  );
}

export function FineTuneDatasetSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="dataset" {...props} />;
}

export function FineTuneRecipeSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="recipe" {...props} />;
}

export function FineTuneTrainSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="train" {...props} />;
}

export function FineTuneEvaluateSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="evaluate" {...props} />;
}

export function FineTuneChatAdapterSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="chatAdapter" {...props} />;
}

export function FineTuneExportSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="export" {...props} />;
}

export function FineTuneReportsSection(props: FineTuneNamedSectionProps) {
  return <NamedSection name="reports" {...props} />;
}
