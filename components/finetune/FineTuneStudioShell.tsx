"use client";

import { FineTuneStudioPanel } from "@/components/finetune/FineTuneStudioPanel";
import { useLocale } from "@/components/layout/LocaleProvider";
import {
  StudioIdentityBand,
  StudioSegmentedChips,
  StudioSurface,
} from "@/components/layout/StudioPageShell";

export function FineTuneStudioShell() {
  const { locale } = useLocale();
  const isEnglish = locale.startsWith("en");

  return (
    <StudioSurface accent="cyan">
      <StudioIdentityBand
        accent="cyan"
        eyebrow={isEnglish ? "Product studio" : "前台工作流"}
        title={isEnglish ? "Fine-tune Studio" : "Fine-tune Studio"}
        description={
          isEnglish
            ? "Train, evaluate, chat-test, export, and review adapter evidence without entering the admin console."
            : "训练、评估、Adapter 对话、导出和证据复盘前移到产品工作流；后台继续保留监控、队列和治理入口。"
        }
        side={
          <StudioSegmentedChips
            labels={[
              isEnglish ? "Train" : "训练",
              isEnglish ? "Evaluate & Predict" : "评估与预测",
              isEnglish ? "Export evidence" : "导出证据",
            ]}
          />
        }
      />
      <FineTuneStudioPanel locale={locale} surface="fine-tune-studio" />
    </StudioSurface>
  );
}
