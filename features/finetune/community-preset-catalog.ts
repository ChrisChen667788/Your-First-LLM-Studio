import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetQuality,
  AgentFineTuneUpstreamDatasetCandidate,
} from "@/lib/agent/types";
import type {
  CommunityDatasetPreset,
  PresetDatasetSaveMetadata,
} from "./setup-state";
import { normalizeFineTuneSlug } from "./preview-builders";

export const COMMUNITY_DATASET_PRESETS: CommunityDatasetPreset[] = [
  {
    id: "first-llm-studio-starter-960",
    label: {
      en: "First LLM Studio long-run 960",
      zh: "First LLM Studio 长轮次 960",
    },
    description: {
      en: "A bundled long-run starter for 800-1,000 optimizer steps, covering compare, benchmark, runtime, retrieval, fine-tune, model discovery, provider, and release workflows.",
      zh: "内置长轮次 starter，适合 800-1,000 个优化 step，覆盖 compare、benchmark、运行时、检索、微调、模型发现、provider 和发布工作流。",
    },
    bestFor: {
      en: "Default long-run beginner path when 8-row smoke data is too small and external community data still needs conversion.",
      zh: "当 8 行 smoke 数据太小、外部社区数据又还要转换时，作为默认长轮次新手路径。",
    },
    source: "Bundled",
    sourceUrl: "https://github.com/ChrisChen667788/local-agent-lab",
    docsUrl: "https://github.com/ChrisChen667788/local-agent-lab",
    localPath: "data/fine-tune/first-llm-studio-starter-960.jsonl",
    format: "instruction-jsonl",
    upstreamQuery:
      "first llm studio local agent compare benchmark fine tune long run starter",
    sampleCount: 960,
    bootstrapRows: 960,
    recommendedSamples: 960,
    recommendedEpochs: 4,
    recommendedSteps: {
      en: "About 960 optimizer steps with batch 4, grad accumulation 1, and 10% validation split.",
      zh: "batch 4、梯度累积 1、10% 验证集时，约 960 个优化 step。",
    },
    difficulty: {
      en: "Best default",
      zh: "最佳默认",
    },
    license: "Project sample data",
    recipeNotes: {
      en: "Use this for the first satisfying long local run. It is large enough for hundreds to 1k steps without requiring external dataset conversion.",
      zh: "第一次想认真跑长轮次本地微调时优先用它。样本量足够支撑数百到约 1k step，且不需要外部数据转换。",
    },
  },
  {
    id: "first-llm-studio-starter-384",
    label: {
      en: "First LLM Studio starter 384",
      zh: "First LLM Studio 新手默认 384",
    },
    description: {
      en: "A bundled, project-shaped SFT starter with compare, benchmark, runtime, retrieval, model discovery, release, and fine-tune support replies.",
      zh: "内置的项目语境 SFT starter，覆盖 compare、benchmark、运行时、检索、模型发现、发布和微调状态回复。",
    },
    bestFor: {
      en: "Default beginner path: safe local LoRA practice on 0.6B or 4B models with enough rows for hundreds of steps.",
      zh: "默认新手路径：适合 0.6B 或 4B 本地模型做安全 LoRA 体验，样本量足够支撑数百 step。",
    },
    source: "Bundled",
    sourceUrl: "https://github.com/ChrisChen667788/local-agent-lab",
    docsUrl: "https://github.com/ChrisChen667788/local-agent-lab",
    localPath: "data/fine-tune/first-llm-studio-starter-384.jsonl",
    format: "instruction-jsonl",
    upstreamQuery:
      "first llm studio local agent compare benchmark fine tune starter",
    sampleCount: 384,
    bootstrapRows: 384,
    recommendedSamples: 384,
    recommendedEpochs: 12,
    recommendedSteps: {
      en: "About 1k optimizer steps with batch 4, grad accumulation 1, and 10% validation split.",
      zh: "batch 4、梯度累积 1、10% 验证集时，约 1k 个优化 step。",
    },
    difficulty: {
      en: "Beginner default",
      zh: "新手默认",
    },
    license: "Project sample data",
    recipeNotes: {
      en: "Default local starter: use this before pulling large public datasets. It teaches product-specific answer style and avoids brittle community formats.",
      zh: "默认本地 starter：先用它体验，再拉大型公开数据集。它训练项目特定回复风格，并规避社区数据格式不稳定问题。",
    },
  },
  {
    id: "alpaca-cleaned-52k",
    label: {
      en: "Alpaca cleaned 52K",
      zh: "Alpaca cleaned 52K",
    },
    description: {
      en: "Classic instruction/output SFT data with broad task coverage and a simple schema that is easy to sample down locally.",
      zh: "经典 instruction/output SFT 数据，任务覆盖广、结构简单，适合本地抽样后训练。",
    },
    bestFor: {
      en: "General instruction following baselines and first external dataset imports.",
      zh: "适合通用指令跟随基线，以及第一次导入外部数据集。",
    },
    source: "Hugging Face",
    sourceUrl: "https://huggingface.co/datasets/yahma/alpaca-cleaned",
    docsUrl: "https://github.com/tatsu-lab/stanford_alpaca",
    paperUrl: "https://crfm.stanford.edu/2023/03/13/alpaca.html",
    localPath: "data/fine-tune/community/alpaca-cleaned-sample.jsonl",
    format: "instruction-jsonl",
    upstreamQuery: "yahma alpaca-cleaned instruction output",
    sampleCount: 51800,
    bootstrapRows: 192,
    recommendedSamples: 1000,
    recommendedEpochs: 4,
    recommendedSteps: {
      en: "Sample 1k to 2k rows first; 4 epochs is usually enough for a local smoke adapter.",
      zh: "先抽样 1k 到 2k 行；本地 smoke adapter 通常 4 个 epoch 足够。",
    },
    difficulty: {
      en: "Beginner external",
      zh: "新手外部集",
    },
    license: "CC BY 4.0, verify upstream before commercial use",
    recipeNotes: {
      en: "Use an extracted local sample before training. Keep validation split enabled because Alpaca-style rows are broad and mixed.",
      zh: "训练前先抽成本地小样本。因为 Alpaca 风格任务较杂，建议保留验证集。",
    },
  },
  {
    id: "belle-cn-instruction",
    label: {
      en: "BELLE Chinese instruction",
      zh: "BELLE 中文指令集",
    },
    description: {
      en: "Large Chinese instruction-tuning family from BELLE, better aligned with Chinese UI copy and assistant replies.",
      zh: "BELLE 系列中文指令微调数据，更贴近中文 UI、助手回复和新手解释场景。",
    },
    bestFor: {
      en: "Chinese assistant tone, beginner explanations, and local product-support adapters.",
      zh: "适合中文助手语气、新手解释和本地产品支持类 adapter。",
    },
    source: "Hugging Face",
    sourceUrl: "https://huggingface.co/datasets/BelleGroup/train_1M_CN",
    docsUrl: "https://github.com/LianjiaTech/BELLE",
    localPath: "data/fine-tune/community/belle-cn-sample.jsonl",
    format: "instruction-jsonl",
    upstreamQuery: "BelleGroup train_1M_CN Chinese instruction tuning",
    sampleCount: 917000,
    bootstrapRows: 192,
    recommendedSamples: 2000,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Sample 1k to 3k rows for local runs; use lower epochs because the source is large and repetitive.",
      zh: "本地先抽样 1k 到 3k 行；源数据较大且可能重复，epoch 不宜过高。",
    },
    difficulty: {
      en: "Chinese beginner",
      zh: "中文新手",
    },
    license: "GPL-3.0, verify upstream terms",
    recipeNotes: {
      en: "Good next step after the bundled starter when the user wants stronger Chinese instruction behavior.",
      zh: "当用户想增强中文指令跟随能力时，这是内置 starter 之后的合适升级。",
    },
  },
  {
    id: "ultrachat-200k",
    label: {
      en: "UltraChat 200K",
      zh: "UltraChat 200K",
    },
    description: {
      en: "High-coverage chat data for multi-turn assistant style; useful after the basic instruction path is working.",
      zh: "覆盖面更广的多轮对话数据，适合在基础指令路径跑通后增强聊天风格。",
    },
    bestFor: {
      en: "Conversation quality, long-form answers, and assistant tone comparisons.",
      zh: "适合对话质量、长文回答和助手语气对比。",
    },
    source: "Hugging Face",
    sourceUrl: "https://huggingface.co/datasets/HuggingFaceH4/ultrachat_200k",
    docsUrl: "https://huggingface.co/datasets/HuggingFaceH4/ultrachat_200k",
    localPath: "data/fine-tune/community/ultrachat-200k-sample.jsonl",
    format: "chat-jsonl",
    upstreamQuery: "HuggingFaceH4 ultrachat_200k chat sft",
    sampleCount: 208000,
    bootstrapRows: 160,
    recommendedSamples: 1000,
    recommendedEpochs: 2,
    recommendedSteps: {
      en: "Start with 500 to 1k conversations; keep epochs low to avoid overfitting generic chat style.",
      zh: "先抽 500 到 1k 条对话；epoch 保持较低，避免过拟合泛化聊天风格。",
    },
    difficulty: {
      en: "Intermediate chat",
      zh: "进阶对话",
    },
    license: "MIT, verify card before redistribution",
    recipeNotes: {
      en: "Use when the adapter should sound more conversational than the project-specific starter.",
      zh: "当 adapter 需要比项目 starter 更偏自然对话时使用。",
    },
  },
  {
    id: "openhermes-2-5-chat",
    label: {
      en: "OpenHermes 2.5 chat starter",
      zh: "OpenHermes 2.5 对话 starter",
    },
    description: {
      en: "A chat-style preset inspired by OpenHermes 2.5 formats, useful for longer multi-turn assistant warmups.",
      zh: "参考 OpenHermes 2.5 格式的对话 starter，适合更长轮次的多轮助手热身。",
    },
    bestFor: {
      en: "Beginner-friendly chat SFT after the bundled project starter is stable.",
      zh: "内置项目 starter 跑稳后，用作新手友好的聊天 SFT 升级。",
    },
    source: "Hugging Face",
    sourceUrl: "https://huggingface.co/datasets/teknium/OpenHermes-2.5",
    docsUrl: "https://huggingface.co/datasets/teknium/OpenHermes-2.5",
    localPath: "data/fine-tune/community/openhermes-2-5-chat-sample.jsonl",
    format: "chat-jsonl",
    upstreamQuery: "teknium OpenHermes 2.5 chat messages",
    sampleCount: 1000000,
    bootstrapRows: 192,
    recommendedSamples: 1500,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Start from the bundled 192-row slice, then sample 1k-2k upstream rows once conversion is verified.",
      zh: "先用内置 192 行切片，转换验证通过后再抽 1k-2k 条上游样本。",
    },
    difficulty: {
      en: "Chat upgrade",
      zh: "对话升级",
    },
    license: "Dataset card terms, verify upstream before redistribution",
    recipeNotes: {
      en: "Good for longer chat behavior runs; keep validation split on and compare against the base adapter.",
      zh: "适合更长轮次的对话行为训练；保留验证集，并与 base adapter 做 compare。",
    },
  },
  {
    id: "openassistant-oasst1",
    label: {
      en: "OpenAssistant OASST1 starter",
      zh: "OpenAssistant OASST1 starter",
    },
    description: {
      en: "Conversation-tree assistant data with a robust local slice using community-style `conversations` rows.",
      zh: "对话树助手数据，本地切片使用社区常见的 `conversations` 行格式来验证自动转换。",
    },
    bestFor: {
      en: "Testing community chat conversion and longer assistant-style fine-tune runs.",
      zh: "适合测试社区对话数据转换，并跑更长的助手风格微调。",
    },
    source: "Hugging Face",
    sourceUrl: "https://huggingface.co/datasets/OpenAssistant/oasst1",
    docsUrl: "https://open-assistant.io/",
    localPath: "data/fine-tune/community/openassistant-oasst1-sample.jsonl",
    format: "chat-jsonl",
    upstreamQuery: "OpenAssistant oasst1 conversations assistant dataset",
    sampleCount: 84000,
    bootstrapRows: 192,
    recommendedSamples: 1200,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Use the local slice first to confirm conversation conversion, then import a filtered 1k+ sample.",
      zh: "先用本地切片确认 conversations 转换，再导入过滤后的 1k+ 样本。",
    },
    difficulty: {
      en: "Community conversion",
      zh: "社区转换",
    },
    license: "Apache-2.0, verify dataset card",
    recipeNotes: {
      en: "Useful for validating the automatic converter because upstream rows often differ from simple messages JSONL.",
      zh: "适合验证自动转换器，因为上游行格式通常不只是简单 messages JSONL。",
    },
  },
  {
    id: "code-alpaca-20k",
    label: {
      en: "Code Alpaca 20K starter",
      zh: "Code Alpaca 20K starter",
    },
    description: {
      en: "Instruction-style code tasks for a small coding adapter baseline before using larger code datasets.",
      zh: "代码任务指令集，适合作为更大代码数据集之前的小型 coding adapter 基线。",
    },
    bestFor: {
      en: "Code explanation, small patches, and coding benchmark smoke runs.",
      zh: "适合代码解释、小补丁和 coding benchmark 冒烟。",
    },
    source: "GitHub",
    sourceUrl: "https://github.com/sahil280114/codealpaca",
    docsUrl: "https://github.com/sahil280114/codealpaca",
    localPath: "data/fine-tune/community/code-alpaca-20k-sample.jsonl",
    format: "instruction-jsonl",
    upstreamQuery: "code alpaca 20k instruction code dataset GitHub",
    sampleCount: 20000,
    bootstrapRows: 192,
    recommendedSamples: 1000,
    recommendedEpochs: 4,
    recommendedSteps: {
      en: "Start with 1k rows for local coding adapters, then benchmark code review and patch tasks.",
      zh: "本地 coding adapter 先从 1k 行开始，再跑代码审阅和补丁任务 benchmark。",
    },
    difficulty: {
      en: "Coding beginner",
      zh: "代码新手",
    },
    license: "MIT, verify upstream repository",
    recipeNotes: {
      en: "Pair it with compare lanes that ask for concrete code edits rather than generic explanations.",
      zh: "建议配合要求具体代码修改的 compare lane，而不是只看泛泛解释。",
    },
  },
  {
    id: "magicoder-oss-instruct-75k",
    label: {
      en: "Magicoder OSS-Instruct 75K",
      zh: "Magicoder 代码指令 75K",
    },
    description: {
      en: "Code-focused instruction data generated from open-source code contexts, useful for coding assistant adapters.",
      zh: "面向开源代码上下文生成的代码指令数据，适合编码助手 adapter。",
    },
    bestFor: {
      en: "Code review, patch explanation, and coding workflow compare lanes.",
      zh: "适合代码审阅、补丁解释和编码工作流对比 lane。",
    },
    source: "Hugging Face",
    sourceUrl:
      "https://huggingface.co/datasets/ise-uiuc/Magicoder-OSS-Instruct-75K",
    docsUrl: "https://github.com/ise-uiuc/magicoder",
    paperUrl: "https://arxiv.org/abs/2312.02120",
    localPath: "data/fine-tune/community/magicoder-oss-instruct-sample.jsonl",
    format: "instruction-jsonl",
    upstreamQuery: "Magicoder OSS-Instruct 75K code instruction dataset",
    sampleCount: 75000,
    bootstrapRows: 192,
    recommendedSamples: 1500,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Sample 1k to 2k rows for local coding adapters; combine with project-specific review rows.",
      zh: "本地代码 adapter 先抽 1k 到 2k 行；建议和项目内代码审阅样本混合。",
    },
    difficulty: {
      en: "Coding adapter",
      zh: "代码 adapter",
    },
    license: "MIT, verify dataset card",
    recipeNotes: {
      en: "Use for coding-specific adapters, not as the first general assistant dataset.",
      zh: "适合代码专项 adapter，不建议作为第一个通用助手数据集。",
    },
  },
  {
    id: "xlam-function-calling-60k",
    label: {
      en: "xLAM function calling 60K",
      zh: "xLAM 函数调用 60K",
    },
    description: {
      en: "Function-calling data for tool selection and JSON argument generation; useful once basic LoRA runs are stable.",
      zh: "函数调用数据，训练工具选择和 JSON 参数生成；适合基础 LoRA 跑稳后使用。",
    },
    bestFor: {
      en: "Tool-first lanes, OpenAI-compatible provider behavior, and structured tool output checks.",
      zh: "适合 tool-first lane、OpenAI-compatible provider 行为和结构化工具输出检查。",
    },
    source: "Hugging Face",
    sourceUrl:
      "https://huggingface.co/datasets/Salesforce/xlam-function-calling-60k",
    docsUrl: "https://www.salesforceairesearch.com/opensource/xlam",
    paperUrl: "https://arxiv.org/abs/2406.18518",
    localPath: "data/fine-tune/community/xlam-function-calling-sample.jsonl",
    format: "chat-jsonl",
    upstreamQuery: "Salesforce xLAM function calling 60k tool use dataset",
    sampleCount: 60000,
    bootstrapRows: 160,
    recommendedSamples: 1000,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Convert a small slice into the project's tool schema first; do not train directly before validating JSON fields.",
      zh: "先把小样本转换成项目工具 schema；校验 JSON 字段前不要直接训练。",
    },
    difficulty: {
      en: "Advanced tool use",
      zh: "进阶工具调用",
    },
    license: "CC BY 4.0, gated terms require acceptance",
    recipeNotes: {
      en: "Use only after tool schema conversion. Best paired with compare lanes that check function-call structure.",
      zh: "必须先做工具 schema 转换；最好配合检查 function-call 结构的 compare lane。",
    },
  },
  {
    id: "coig-modelscope-cn",
    label: {
      en: "COIG Chinese instruction catalog",
      zh: "COIG 中文指令目录",
    },
    description: {
      en: "Chinese open instruction datasets are useful discovery sources on ModelScope, especially for domestic mirrors and Chinese tasks.",
      zh: "中文开源指令数据适合作为魔搭社区发现源，尤其方便国内镜像和中文任务。",
    },
    bestFor: {
      en: "Finding Chinese SFT candidates and keeping scheduled upstream refresh checks useful.",
      zh: "适合发现中文 SFT 候选，并让定期上游检查更有价值。",
    },
    source: "ModelScope",
    sourceUrl:
      "https://www.modelscope.cn/datasets?name=COIG%20instruction%20tuning",
    docsUrl: "https://github.com/BAAI-Zlab/COIG",
    paperUrl: "https://arxiv.org/abs/2304.07987",
    localPath: "data/fine-tune/community/coig-cn-sample.jsonl",
    format: "instruction-jsonl",
    upstreamQuery: "COIG Chinese instruction tuning ModelScope",
    sampleCount: 190000,
    bootstrapRows: 192,
    recommendedSamples: 1500,
    recommendedEpochs: 3,
    recommendedSteps: {
      en: "Use as a discovery preset first; import a validated slice before local training.",
      zh: "先作为发现预设使用；训练前导入并校验一个本地切片。",
    },
    difficulty: {
      en: "Chinese discovery",
      zh: "中文发现源",
    },
    license: "Research/community use, verify upstream terms",
    recipeNotes: {
      en: "Useful for scheduled community discovery; convert and deduplicate before using it as the active dataset.",
      zh: "适合定期社区发现；作为训练集前需要转换、去重并抽样。",
    },
  },
];

export function getCommunityPresetLabel(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.label.en : preset.label.zh;
}

export function getCommunityPresetDescription(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.description.en : preset.description.zh;
}

export function getCommunityPresetBestFor(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.bestFor.en : preset.bestFor.zh;
}

export function getCommunityPresetRecommendedSteps(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.recommendedSteps.en : preset.recommendedSteps.zh;
}

export function getCommunityPresetDifficulty(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.difficulty.en : preset.difficulty.zh;
}

export function getCommunityPresetRecipeNotes(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  return isEnglish ? preset.recipeNotes.en : preset.recipeNotes.zh;
}

export function getCommunityPresetLicenseRiskLevel(
  preset: CommunityDatasetPreset,
): AgentFineTuneDatasetQuality["licenseRisk"] {
  const license = preset.license.toLowerCase();
  if (
    license.includes("gpl") ||
    license.includes("gated") ||
    license.includes("non-commercial") ||
    license.includes("nc")
  ) {
    return "high";
  }
  if (license.includes("verify") || license.includes("terms")) {
    return "medium";
  }
  if (license.includes("project sample") || license.includes("cc by")) {
    return "low";
  }
  return "unknown";
}

export function getCommunityPresetLicenseRiskLabel(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  const risk = getCommunityPresetLicenseRiskLevel(preset);
  if (risk === "high") return isEnglish ? "review required" : "需复核";
  if (risk === "medium") return isEnglish ? "medium" : "中等";
  return isEnglish ? "low" : "较低";
}

export function getCommunityPresetModelFit(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
) {
  if (preset.recommendedSamples <= 1000) {
    return isEnglish ? "0.6B-4B safe" : "0.6B-4B 安全";
  }
  if (preset.recommendedSamples <= 2000) {
    return isEnglish ? "4B preferred" : "更适合 4B";
  }
  return isEnglish ? "4B+ cautious" : "4B+ 谨慎";
}

export function getFineTuneLicenseRiskLabel(
  risk: AgentFineTuneDatasetQuality["licenseRisk"] | undefined,
  isEnglish: boolean,
) {
  switch (risk) {
    case "low":
      return isEnglish ? "Low" : "较低";
    case "medium":
      return isEnglish ? "Medium" : "中等";
    case "high":
      return isEnglish ? "Review required" : "需复核";
    default:
      return isEnglish ? "Unknown" : "未知";
  }
}

export function buildCommunityPresetDatasetQuality(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
): AgentFineTuneDatasetQuality {
  const licenseRisk = getCommunityPresetLicenseRiskLevel(preset);
  const score = Math.max(
    0,
    Math.min(
      100,
      96 -
        (preset.source === "Bundled" ? 0 : 6) -
        (preset.bootstrapRows < 128 ? 10 : 0) -
        (preset.bootstrapRows < preset.recommendedSamples ? 4 : 0) -
        (licenseRisk === "high"
          ? 18
          : licenseRisk === "medium"
            ? 8
            : licenseRisk === "unknown"
              ? 5
              : 0),
    ),
  );
  const recommendedRange =
    preset.recommendedSamples <= 400
      ? { min: 200, max: 800 }
      : preset.recommendedSamples <= 1000
        ? { min: 600, max: 1200 }
        : preset.recommendedSamples <= 2500
          ? { min: 1000, max: 3000 }
          : { min: 1500, max: 5000 };

  return {
    score,
    licenseRisk,
    downloadedRows: preset.sampleCount,
    convertedRows: preset.bootstrapRows,
    sampledRows: preset.recommendedSamples,
    duplicateRows: 0,
    skippedRows: Math.max(0, preset.sampleCount - preset.bootstrapRows),
    piiRiskRows: 0,
    schemaConversion:
      preset.format === "chat-jsonl"
        ? "preset rows kept as messages[] chat JSONL"
        : "preset rows kept as instruction/input/output JSONL",
    recommendedSteps: {
      ...recommendedRange,
      label: getCommunityPresetRecommendedSteps(preset, isEnglish),
    },
  };
}

export function buildCommunityPresetDatasetSaveMetadata(
  preset: CommunityDatasetPreset,
  isEnglish: boolean,
): PresetDatasetSaveMetadata {
  const quality = buildCommunityPresetDatasetQuality(preset, isEnglish);
  const qualityWarnings = [
    "Preset source: " + preset.source + ". Verify upstream license before redistribution.",
    "Recommended training window: " +
      (quality.recommendedSteps?.label || preset.recommendedSteps.en) +
      ".",
    quality.licenseRisk !== "low"
      ? "License risk is " +
        quality.licenseRisk +
        "; review upstream terms before publishing adapters."
      : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    sourceType:
      preset.source === "Bundled" ? "bundled-preset" : "community-preset",
    sourceUrl: preset.sourceUrl,
    sourceLabel:
      preset.source + " · " + getCommunityPresetLabel(preset, isEnglish),
    license: preset.license,
    quality,
    qualityWarnings,
  };
}

type BuildDatasetCandidateImportPlanOptions = {
  dataset: AgentFineTuneDataset;
  candidate: AgentFineTuneUpstreamDatasetCandidate;
  isEnglish: boolean;
  formatDateTime: (value?: string) => string;
  formatSampleCount: (value?: number | null) => string;
};

export function buildDatasetCandidateImportPlan({
  dataset,
  candidate,
  isEnglish,
  formatDateTime,
  formatSampleCount,
}: BuildDatasetCandidateImportPlanOptions) {
  const slug = normalizeFineTuneSlug(candidate.source + "-" + candidate.repoId);
  const outputPath =
    "data/fine-tune/community/" +
    (slug || "community-dataset") +
    "-sample.jsonl";
  const format = dataset.format || "instruction-jsonl";
  if (isEnglish) {
    return [
      "# Fine-tune Dataset Import Plan",
      "",
      "- Active dataset registry: " + dataset.label,
      "- Candidate source: " + candidate.source,
      "- Repository: " + candidate.repoId,
      "- Source page: " + candidate.repoUrl,
      candidate.docsUrl ? "- Docs: " + candidate.docsUrl : undefined,
      candidate.paperUrl ? "- Paper: " + candidate.paperUrl : undefined,
      "- Upstream rows: " + formatSampleCount(candidate.sampleCount),
      "- Last updated: " + formatDateTime(candidate.updatedAt),
      "- Target local file: " + outputPath,
      "- Target format: " + format,
      "",
      "## Required steps before training",
      "1. Download or export a small starter slice first. Keep 128-512 rows for smoke tests and 1k-5k rows for longer local LoRA runs.",
      "2. Convert rows to " + format + ". Keep one instruction/response or messages array per line.",
      "3. Remove duplicate prompts, empty answers, license-incompatible rows, and rows that expose secrets or private data.",
      "4. Run dataset validation in First LLM Studio and save the dataset only after warnings are reviewed.",
      "5. Start with batch size 1-4, validation split 10%, and save checkpoints every 100-200 steps for long runs.",
    ].filter(Boolean).join("\n");
  }
  return [
    "# 微调数据集导入计划",
    "",
    "- 当前数据集注册项：" + dataset.label,
    "- 候选来源：" + candidate.source,
    "- 仓库：" + candidate.repoId,
    "- 来源页：" + candidate.repoUrl,
    candidate.docsUrl ? "- 说明页：" + candidate.docsUrl : undefined,
    candidate.paperUrl ? "- 论文：" + candidate.paperUrl : undefined,
    "- 上游样本：" + formatSampleCount(candidate.sampleCount),
    "- 更新时间：" + formatDateTime(candidate.updatedAt),
    "- 建议落地文件：" + outputPath,
    "- 目标格式：" + format,
    "",
    "## 训练前必须完成",
    "1. 先下载或导出小样本切片；smoke 建议 128-512 条，数百到上千步本地 LoRA 建议 1k-5k 条。",
    "2. 转换为 " + format + "；每行保留一条 instruction/output 或 messages 数组。",
    "3. 去掉重复 prompt、空回复、许可证不兼容样本，以及任何密钥、隐私或个人数据。",
    "4. 回到 First LLM Studio 跑数据集校验，确认 warning 后再保存。",
    "5. 长轮次训练先用 batch size 1-4、验证集 10%，并每 100-200 step 保存 checkpoint。",
  ].filter(Boolean).join("\n");
}
