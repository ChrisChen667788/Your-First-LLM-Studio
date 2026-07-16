# First LLM Studio

> English | [简体中文](#简体中文)

A local-first LLM studio for Apple Silicon that brings MLX local runtimes, remote API comparison, Agent sessions, Compare Lab, Fine-tune/LoRA, Benchmark, model discovery, Retrieval, Experiments, replay, trace review, runtime recovery, and telemetry into one workspace.

![First LLM Studio hero](../docs/assets/github-hero.svg)

## Current Release

Current version: `v1.1.0-rc.2`.

This desktop-onboarding release candidate packages the current Studio as an Apple Silicon app with an official bundled Node runtime, ZIP/DMG artifacts, first-run diagnosis, permission and service recovery, data/update rollback rehearsals, a real Ollama local-chat proof, and clean-profile DMG boot evidence. Ad-hoc local codesign is reported separately from the still-open Developer ID/notarization GA gate.

## Product Surfaces

| Surface | Core workflow |
| --- | --- |
| Agent | Tool-enabled sessions, target catalog, runtime rail, replay, trace review, and embedded Compare entry. |
| Compare | Prompt composer, lane preview, recipe persistence, review drawer, and benchmark handoff. |
| Fine-tune | Datasets, recipes, training, evaluation, adapter proof loops, export, reports, artifacts, and LoRA chart evidence. |
| Models | Community/local model discovery, install verification, hardware fit, runtime profiles, request logs, and idle-unload state. |
| Benchmarks | Run controls, progress, baselines, reports, release evidence, fatal-target skip handling, and regression review. |
| Retrieval | Local knowledge import, chunk inspection, permission-aware retrieval, citations, and grounded query validation. |
| Experiments | Unified session/run timeline, artifact lineage, cross-links, navigation, filters, and retention. |
| Admin | Monitoring/configuration mirror for runtime, queues, provider health, compatibility usage, guardrails, and audit timelines. |

## Major Versions

| Version | Core capabilities |
| --- | --- |
| `v0.1` | Local-first studio foundation, MLX gateway workflow, target catalog, telemetry, and Agent/Admin split. |
| `v0.2` | Agent workbench expansion, Compare-style review, replay/trace inspection, runtime recovery, benchmark ops, baselines, and regression evidence. |
| `v0.3` | Fine-tune operation loops, adapter chat/export, distillation starters, operation history, partitioned typechecks, route/screenshot smoke, and launch assets. |
| `v0.4` | Foreground `/fine-tune`, `/compare`, `/models`, `/benchmarks`, `/retrieval`, and `/experiments`; feature-owned state/actions; artifact lineage; dark-glass studio/workbench style; canonical APIs with deprecated Admin compatibility wrappers. |
| `v0.4.1` | Stability baseline with dataless recovery, runtime/status fixes, real Qwen3 4B LoRA evidence, checkpoint/report/chart exports, and refreshed high-resolution screenshots. |
| `v0.4.2` | Evidence patch for GitHub/ModelScope high-resolution screenshot sync, README LFS threshold hygiene, and the first v0.5.0 Provider Health Desk v2 + Adapter Export wizard slice. |
| `v0.5` | Preview-gated Enterprise RAG, deployment registry, OpenAI-compatible API, telemetry, release-readiness gates, production attestation, quota, audit, and control-plane rehearsals. |
| `v1.0` | Integrated Agent, Compare, Model Hub, RAG, Fine-tune, Benchmark, Experiments, Admin monitoring, application APIs, route ownership, and release-evidence baseline. |
| `v1.1.0-rc.1` | Self-contained Apple Silicon app, bundled Node runtime, ZIP/DMG, first-run and lifecycle orchestration, real local-chat proof, and clean-profile boot evidence; notarization remains a GA gate. |
| `v1.1.0-rc.2` | Native arm64 launcher, nested-code/app/DMG signing workflow, dual notarization logs, staple/Gatekeeper verification, external-Mac runner, and RSA organization receipts with an out-of-band trust pin; real external evidence still gates GA. |

## Competitive Position

Official-documentation review dated 2026-07-12. **Core** means a primary first-party workflow; **integrated** means available but not the product's deepest specialization; **ecosystem** means normally assembled through adjacent clients or plugins.

| Product | Strongest position | Runtime / Model Hub | Agent / RAG | Fine-tune | Evaluation / evidence |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | Evidence-driven local model lifecycle | **Core**, MLX/hardware-aware | **Core**, tools + Compare + ACL/citations | **Core**, recipe/checkpoint/adapter lifecycle | **Core**, Benchmark + lineage + release gates |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | Desktop discovery and local serving | **Core** | Integrated via API/tools/MCP | Not primary | Runtime inspection |
| [Ollama](https://docs.ollama.com/api/introduction) | Simple model runtime and packaging | **Core** | Ecosystem; native tool calling | Not primary | Ecosystem |
| [Open WebUI](https://docs.openwebui.com/features/) | Self-hosted team AI workspace | Integrated | **Core**, hybrid RAG/tools/MCP | Not primary | Integrated arena/A-B/ELO/OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | Open-source desktop assistant | **Core** | Integrated agents/projects/MCP | Not primary | Server logs |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG and agent automation | Integrated | **Core**, flows/skills/jobs | Not primary | Flow/run inspection |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | Efficient training breadth | Training/inference tooling | Task-focused | **Core**, broad LoRA/QLoRA | **Core** training monitors |
| [LocalAI](https://localai.io/) | Modular private AI runtime | **Core**, broad backends/hardware | **Core**, agents/MCP/RAG | Integrated | Runtime/control-plane ops |

First LLM Studio is strongest where these workflows need one reproducible evidence chain. It is currently weaker in desktop packaging, runtime breadth, extension/community scale, team identity/governance, visual workflow authoring, and real cloud/multi-node production proof. See the full bilingual [competitive landscape and post-v1 direction](../docs/competitive-landscape.md).

## Real Fine-tune / LoRA Evidence

The v0.4.2 public baseline preserves the real local Qwen3 4B LoRA run introduced in v0.4.1:

- Base model: `mlx-community/Qwen3-4B-Instruct-2507-4bit`
- Dataset: First LLM Studio starter 960, split into train/valid/test `816/96/48`
- Training: 816 steps, eval/save every 100 steps
- Peak memory: 3.316 GB
- Latest throughput: 247.4 tokens/s
- Best checkpoint: step 800, `eval_loss=0.066`
- Evidence: manifest, metrics CSV, report, chart JSON/SVG/PNG, checkpoint events, selected best checkpoint, and full archive path

![Qwen3 4B LoRA release evidence](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

Vector chart: [`fine-tune-qwen4b-lora-chart.svg`](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg). Full evidence directory: [`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](../docs/release-evidence/finetune-qwen4b-lora-2026-07-01).

## Screenshots

README screenshots are captured from the running local app at 2x DPR. Route screenshots are 3200x2000; the LoRA evidence chart PNG is 3360x1960 and is exported from SVG for sharp display.

![Agent workbench](../docs/assets/screenshots/agent-workbench.png)
![Fine-tune Studio](../docs/assets/screenshots/fine-tune-studio.png)
![Fine-tune training curve](../docs/assets/screenshots/fine-tune-training-curve.png)
![Benchmark Studio](../docs/assets/screenshots/benchmarks-studio.png)
![Benchmark evidence](../docs/assets/screenshots/benchmark-run-evidence.png)
![Models Studio](../docs/assets/screenshots/models-studio.png)
![Compare Studio](../docs/assets/screenshots/compare-studio.png)
![Retrieval Studio](../docs/assets/screenshots/retrieval-studio.png)
![Admin dashboard](../docs/assets/screenshots/admin-dashboard.png)

## Repository

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- Default ModelScope repo id: `haozi667788/first-llm-studio`
- Latest release note: [`v1.1.0-rc.2`](../docs/releases/v1.1.0-rc.2_2026-07-16.md)

---

# 简体中文

First LLM Studio 是面向 Apple Silicon 的本地优先 LLM 工作台，把 MLX 本地运行时、远端 API 对比、Agent 会话、Compare Lab、Fine-tune/LoRA、Benchmark、模型发现、Retrieval、Experiments、replay、trace review、runtime recovery 和模型遥测统一到一个界面里。

![First LLM Studio hero](../docs/assets/github-hero.svg)

## 当前版本

当前版本：`v1.1.0-rc.2`。

该桌面首次启动发布候选把当前 Studio 打包为 Apple Silicon app，内置官方 Node runtime，并生成 ZIP/DMG、首次诊断、权限与服务恢复、数据/更新回滚演练、真实 Ollama 本地对话证明和 clean-profile DMG 启动证据。ad-hoc 本地 codesign 与仍待完成的 Developer ID/notarization GA 门禁会分开报告。

## 产品入口

| 模块 | 核心工作流 |
| --- | --- |
| Agent | 工具会话、target catalog、runtime rail、replay、trace review 和内嵌 Compare。 |
| Compare | Prompt 编排、lane preview、recipe 持久化、review drawer 和 benchmark handoff。 |
| Fine-tune | 数据集、配方、训练、评估、adapter proof loop、导出、报告、artifacts 和 LoRA 图表证据。 |
| Models | 社区/本地模型发现、安装验证、硬件适配、runtime profile、请求日志和 idle-unload 状态。 |
| Benchmarks | 运行控制、进度、baseline、报告、发布证据、不可用目标跳过和回归审阅。 |
| Retrieval | 本地知识导入、chunk 检查、权限过滤、引用和 grounded query 验证。 |
| Experiments | 统一 Session/Run 时间线、artifact lineage、跨功能链接、导航、筛选和 retention。 |
| Admin | Runtime、队列、provider health、compatibility usage、guardrails 和 audit timeline 的监控/配置镜像。 |

## 大版本核心功能

| 版本 | 核心能力 |
| --- | --- |
| `v0.1` | 本地优先 Studio 基础、MLX 网关工作流、target catalog、telemetry 和 Agent/Admin 分层。 |
| `v0.2` | Agent 工作台扩展、Compare 式审阅、replay/trace 检查、runtime recovery、benchmark 运维、baseline 和回归证据。 |
| `v0.3` | Fine-tune 操作循环、adapter chat/export、distillation starter、operation history、分区 typecheck、route/screenshot smoke 和发布素材。 |
| `v0.4` | 前台 `/fine-tune`、`/compare`、`/models`、`/benchmarks`、`/retrieval`、`/experiments`；feature-owned state/actions；artifact lineage；dark-glass studio/workbench 风格；canonical API 与带弃用头的 Admin compatibility wrappers。 |
| `v0.4.1` | 稳定基线：dataless recovery、runtime/status 修复、真实 Qwen3 4B LoRA 证据、checkpoint/report/chart 导出，以及最新高清截图。 |
| `v0.4.2` | 证据补丁：GitHub/ModelScope 高清截图同步、README LFS 阈值治理，以及 v0.5.0 Provider Health Desk v2 + Adapter Export wizard 第一段。 |
| `v0.5` | Preview-gated 企业 RAG、deployment registry、OpenAI-compatible API、telemetry、release-readiness gates、生产签收、quota、audit 和 control-plane rehearsal。 |
| `v1.0` | 统一 Agent、Compare、Model Hub、RAG、Fine-tune、Benchmark、Experiments、Admin 监控、application API、route ownership 和发布证据基线。 |
| `v1.1.0-rc.1` | 自包含 Apple Silicon app、内置 Node runtime、ZIP/DMG、首次启动和生命周期编排、真实本地对话证明及 clean-profile 启动证据；notarization 仍是 GA 门禁。 |
| `v1.1.0-rc.2` | 原生 arm64 launcher、内部代码/app/DMG 分层签名链、双层公证日志、staple/Gatekeeper 验证、独立 Mac 验收脚本以及带线下信任锚的 RSA 组织签收；真实外部证据仍是 GA 门禁。 |

## 竞品定位对比

本表基于 2026-07-12 可查的官方产品文档。**核心**表示原生主流程，**已集成**表示具备但并非最深专长，**生态**表示通常由相邻客户端或插件组装。

| 产品 | 最强定位 | Runtime / Model Hub | Agent / RAG | Fine-tune | 评测 / 证据 |
| --- | --- | --- | --- | --- | --- |
| **First LLM Studio** | 证据驱动的本地模型全生命周期 | **核心**，MLX/硬件感知 | **核心**，工具 + Compare + ACL/引用 | **核心**，recipe/checkpoint/adapter lifecycle | **核心**，Benchmark + lineage + release gates |
| [LM Studio](https://lmstudio.ai/docs/developer/core/server) | 桌面模型发现和本地服务 | **核心** | 通过 API/工具/MCP 集成 | 非主线 | Runtime 检查 |
| [Ollama](https://docs.ollama.com/api/introduction) | 简洁模型运行时与打包 | **核心** | 生态；原生 tool calling | 非主线 | 生态提供 |
| [Open WebUI](https://docs.openwebui.com/features/) | 自托管团队 AI 工作区 | 已集成 | **核心**，混合 RAG/工具/MCP | 非主线 | Arena/A-B/ELO/OTel |
| [Jan](https://www.jan.ai/docs/desktop/api-server) | 开源桌面助手 | **核心** | Agent/Project/MCP | 非主线 | Server 日志 |
| [AnythingLLM](https://docs.anythingllm.com/) | Workspace RAG 与 Agent 自动化 | 已集成 | **核心**，Flow/Skill/定时任务 | 非主线 | Flow/Run 检查 |
| [LLaMA-Factory](https://github.com/hiyouga/LlamaFactory) | 高效训练广度 | 训练/推理工具 | 面向任务 | **核心**，广泛 LoRA/QLoRA | **核心**，训练监控 |
| [LocalAI](https://localai.io/) | 模块化私有 AI runtime | **核心**，广后端/硬件 | **核心**，Agent/MCP/RAG | 已集成 | Runtime/控制面运维 |

First LLM Studio 在需要统一可复现证据链时更有优势；当前短板是桌面打包、运行时广度、扩展/社区规模、团队身份与治理、可视化 workflow，以及真实云/多节点生产证据。完整双语分析与 post-v1 规划见：[竞品格局与产品方向](../docs/competitive-landscape.md)。

## 真实 Fine-tune / LoRA 证据

v0.4.2 公开基线继续保留 v0.4.1 引入的真实本地 Qwen3 4B LoRA 训练：

- 基座模型：`mlx-community/Qwen3-4B-Instruct-2507-4bit`
- 数据集：First LLM Studio starter 960，训练/验证/测试 `816/96/48`
- 训练：816 steps，eval/save every 100 steps
- 峰值内存：3.316 GB
- 最新吞吐：247.4 tokens/s
- 最佳 checkpoint：step 800，`eval_loss=0.066`
- 证据：manifest、metrics CSV、report、chart JSON/SVG/PNG、checkpoint events、selected best checkpoint 和 full archive path

![Qwen3 4B LoRA 发布证据](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

矢量图：[`fine-tune-qwen4b-lora-chart.svg`](../docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg)。完整证据目录：[`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](../docs/release-evidence/finetune-qwen4b-lora-2026-07-01)。

## 截图

README 截图来自本地运行版本，按 2x DPR 生成。页面截图为 3200x2000，LoRA 证据图为 3360x1960，并从 SVG 导出以保证放大后清晰。

![Agent 工作台](../docs/assets/screenshots/agent-workbench.png)
![Fine-tune Studio](../docs/assets/screenshots/fine-tune-studio.png)
![Fine-tune 训练曲线](../docs/assets/screenshots/fine-tune-training-curve.png)
![Benchmark Studio](../docs/assets/screenshots/benchmarks-studio.png)
![Benchmark 证据](../docs/assets/screenshots/benchmark-run-evidence.png)
![Models Studio](../docs/assets/screenshots/models-studio.png)
![Compare Studio](../docs/assets/screenshots/compare-studio.png)
![Retrieval Studio](../docs/assets/screenshots/retrieval-studio.png)
![Admin dashboard](../docs/assets/screenshots/admin-dashboard.png)

## 仓库地址

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope 主页: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- 默认 ModelScope repo id：`haozi667788/first-llm-studio`
- 最新版本说明：[`v1.1.0-rc.2`](../docs/releases/v1.1.0-rc.2_2026-07-16.md)
