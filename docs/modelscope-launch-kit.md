# ModelScope Launch Kit · First LLM Studio

Reviewed 2026-10-06. This is positioning guidance, not a publication approval. The current source is `v1.5.1`, latest public GitHub release is `v0.4.0`, distribution is `HOLD`, and production is `BLOCKED`; verify [`release-state.json`](../release-state.json) before posting. See [Product Tour and Positioning](./product-tour-and-positioning-2026-10-06.md) for the current bilingual copy and media provenance.

## Recommended repository name

- English: `First LLM Studio`
- Chinese: `First LLM Studio｜本地优先 LLM 工作台`

## Recommended short description

### English

A local-first model workbench for Apple Silicon connecting Agent sessions, model comparison, fine-tuning, benchmarks, retrieval, runtime operations, and reviewable evidence.

### 中文

面向 Apple Silicon 的本地优先模型工作台，把 Agent、模型对比、微调、评测、检索、运行时操作和可复查证据连成一条工作流。

## Target users

### English

- local AI builders on Apple Silicon
- agent and tooling teams
- evaluation and platform engineers

### 中文

- Apple Silicon 本地 AI 开发者
- Agent / 工具链团队
- 评测 / 平台工程团队

## Core value bullets

### English

- select local and configured remote targets, then hand comparison questions into evaluation
- connect dataset, recipe, job, checkpoint, and adapter review without losing lineage
- inspect scorer, baseline, replay, and runtime context when making model decisions
- keep external approval, distribution, and production gates visible rather than implied

### 中文

- 选择本地与已配置远端目标，并把对比问题交给评测
- 串联数据集、配方、任务、checkpoint 与 adapter 的产物来路
- 做模型决策时查看判分器、baseline、回放与运行时上下文
- 明示外部验收、分发和生产门槛，不把源码完成等同于上线

## Suggested launch headline

### English

First LLM Studio: an open-source local-first LLM workbench for Apple Silicon

### 中文

First LLM Studio：面向 Apple Silicon 的开源本地优先 LLM 工作台

## Suggested launch body

### English

First LLM Studio is built for teams that need more than a chat UI. It connects local MLX and configured remote targets with Agent, Compare, Fine-tune, Benchmark, Retrieval, Experiments, and runtime review. The value proposition is a more reviewable model decision with fewer manual handoffs; these are pilot hypotheses, not measured customer ROI.

### 中文

First LLM Studio 面向需要审阅模型决策过程的团队：把本地 MLX 与已配置远端目标接到 Agent、Compare、微调、评测、检索、实验记录和运行时审阅。减少手工切换、提高可复查性是待试点验证的价值假设，不是已测得的客户 ROI。

## Recommended screenshot stack

1. `docs/assets/product-tour/first-llm-studio-promo.jpg` (link to MP4)
2. `docs/assets/product-tour/2026-10-06/agent.png`
3. `docs/assets/product-tour/2026-10-06/compare.png`
4. `docs/assets/product-tour/2026-10-06/fine-tune.png`
5. `docs/assets/product-tour/2026-10-06/benchmarks.png`

These are isolated UI captures. The dated LoRA/MATH-500 local runs are separate archived evidence, not results from this capture.

## Messaging angle for ModelScope

### English

Lead with the [product film](./assets/product-tour/first-llm-studio-promo.mp4), then show the dated Agent, Compare, Fine-tune, and Benchmark UI captures. Describe training and scoring with their distinct historical receipts; do not present illustrative hero telemetry or isolated UI as a new run.

### 中文

先展示[产品短片](./assets/product-tour/first-llm-studio-promo.mp4)和带日期的 Agent、Compare、微调、评测界面；训练与评分分别引用历史证据，不把主视觉示例遥测或隔离界面写成新的运行结果。
