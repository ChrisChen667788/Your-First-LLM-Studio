# First LLM Studio

[English](#english) | [简体中文](#简体中文)

![Release](https://img.shields.io/github/v/release/ChrisChen667788/Your-First-LLM-Studio?label=release)
![License](https://img.shields.io/github/license/ChrisChen667788/Your-First-LLM-Studio)
![Apple Silicon](https://img.shields.io/badge/platform-Apple%20Silicon-0f172a)
![MLX](https://img.shields.io/badge/local%20runtime-MLX-06b6d4)

![First LLM Studio hero](./docs/assets/github-hero.svg)

---

# English

First LLM Studio is a local-first LLM workbench for Apple Silicon. It brings local MLX runtimes, remote API targets, Agent sessions, Compare, Fine-tune, Benchmark, model discovery, runtime recovery, release evidence, and admin monitoring into one operating surface.

It is not another chat shell. It is built for people who need to compare behavior, debug runtimes, run evals, prepare adapters, and keep local and remote model work inside one product loop.

## Product Surfaces

| Route | Core workflow |
| --- | --- |
| `/agent` | Tool-enabled Agent sessions, target selection, runtime state, replay, trace review, and embedded Compare entry. |
| `/compare` | Route-owned Compare Studio for prompt composition, lane preview, recipe persistence, review drawer, and benchmark handoff. |
| `/fine-tune` | Foreground Fine-tune Studio for datasets, recipes, training, evaluation, chat adapter proof loops, export, reports, and artifacts. |
| `/models` | Model discovery and install verification for local/community models plus hardware-fit and risk signals. |
| `/benchmarks` | Benchmark run controls, progress, reports, release evidence, baselines, and regression review. |
| `/retrieval` | Foreground knowledge management, path import, chunk inspection, and grounded retrieval validation. |
| `/experiments` | Unified run/session timeline with artifact lineage, cross-feature navigation, filters, and retention controls. |
| `/admin` | Monitoring/configuration mirror for runtime, queues, benchmark history, provider health, guardrails, and audit timelines. |

## Major Version Story

| Version | Core capabilities |
| --- | --- |
| `v0.1` Foundation | Established the local-first web studio, Apple Silicon/MLX gateway workflow, local + remote target catalog, runtime telemetry, and the first Agent/Admin operating split. |
| `v0.2` Agent + Benchmark Ops | Added richer Agent workbench flows, Compare-style target review, replay/trace inspection, runtime recovery controls, formal benchmark operations, baselines, and regression evidence. |
| `v0.3` Fine-tune + Release Evidence | Added fine-tune operation loops for evaluation, adapter chat, adapter export, and distillation starters; expanded operation history, partitioned typechecks, screenshot smoke, route smoke, and public launch assets. |
| `v0.4` Product IA release | Moves `/fine-tune`, `/compare`, `/models`, `/benchmarks`, `/retrieval`, and `/experiments` into foreground product routes with feature-owned state/actions, artifact lineage and retention, dark-glass studio/workbench styling, canonical APIs, and admin narrowed toward monitoring/configuration. |
| `v0.4.1` Stability baseline | Repairs dataless workspace failure modes, keeps route smoke and typecheck green, updates the OpenAI-compatible `/v1` surface, refreshes provider status reporting, captures current real UI evidence, and archives a real Qwen3 4B LoRA run with checkpoint/report/chart evidence. |
| `v0.5` Starter track | Enterprise RAG, deployment registry, OpenAI-compatible API, telemetry, release-readiness gates, production attestation, and control-plane rehearsal work continue behind explicit preview gates until promoted. |

Current release: [`VERSION`](./VERSION).

## Who It Helps

### Local AI builders on Apple Silicon

- Compare MLX local models against hosted APIs under aligned context budgets.
- Inspect runtime cost, prewarm, release, recovery, and hardware pressure without leaving the app.
- Decide which local model is actually usable for daily coding and analysis workflows.

### Agent and tooling teams

- Validate tool-calling, repo-grounded behavior, replay, and patch flows in one workbench.
- Turn Compare runs into benchmark handoff without switching products.
- Separate model-quality failures from provider quirks and local runtime instability.

### Evaluation and platform engineers

- Run formal and focused benchmark suites with repeatable profiles.
- Review baselines, deltas, run notes, failure classifications, and release evidence.
- Keep local and remote targets inside one comparable target catalog.

## Core Value

- Unified local + remote target catalog.
- Compare Lab for model-vs-model output review.
- Fine-tune workflows for datasets, recipes, training, evaluation, adapter proof loops, export, best-checkpoint selection, and LoRA release evidence.
- Benchmark operations with history, progress, baselines, reports, and release evidence.
- Foreground Retrieval for document import, chunk inspection, and grounded evidence probes.
- Experiments timeline for session/run lineage, artifact navigation, and retention policy.
- Replay, trace review, patch inspection, and exportable review notes.
- Runtime operations for prewarm, release, restart, log inspection, telemetry, and recovery.
- Dynamic local/community model discovery plus remote provider health scanning.

## Current Targets

### Local

- `Local Qwen3 0.6B`
- `Local Qwen3 4B 4-bit`
- `Local Qwen3.5 4B 4-bit`
- `Local Gemma 3 4B It Qat 4-bit`

### Remote

- `OpenAI Codex`
- `OpenAI GPT-5.5`
- `Claude API`
- `DeepSeek API`
- `Kimi API`
- `GLM API`
- `Qwen API`

## Screenshots

Captured from the running local app after `npm run typecheck` and `npm run smoke:routes`. README screenshots are generated with `npm run screenshots:readme` at 2x DPR so text stays sharp on GitHub and ModelScope; the LoRA evidence chart is exported from SVG at 2x DPR.

Agent workbench with target catalog, runtime rail, and tool-enabled composer:

![Agent workbench](./docs/assets/screenshots/agent-workbench.png)

Fine-tune Studio with workflow tabs, training controls, and report/evidence panels:

![Fine-tune Studio](./docs/assets/screenshots/fine-tune-studio.png)

Fine-tune completed run with live loss curves, train/validation traces, and handoff actions:

![Fine-tune training curve](./docs/assets/screenshots/fine-tune-training-curve.png)

Real Qwen3 4B LoRA release evidence with save/eval markers and selected best checkpoint:

![Qwen3 4B LoRA release evidence](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

Vector version: [`fine-tune-qwen4b-lora-chart.svg`](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg). Full run archive and manifest: [`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](./docs/release-evidence/finetune-qwen4b-lora-2026-07-01).

Benchmark Studio with run controls and historical evidence cards:

![Benchmark Studio](./docs/assets/screenshots/benchmarks-studio.png)

Benchmark run evidence from a real local smoke run:

![Benchmark run evidence](./docs/assets/screenshots/benchmark-run-evidence.png)

Models Studio with hardware-fit chips and one-click community discovery:

![Models Studio](./docs/assets/screenshots/models-studio.png)

Compare, Retrieval, and Admin surfaces:

![Compare Studio](./docs/assets/screenshots/compare-studio.png)
![Retrieval Studio](./docs/assets/screenshots/retrieval-studio.png)
![Admin dashboard](./docs/assets/screenshots/admin-dashboard.png)
![Admin benchmark heatmap](./docs/assets/screenshots/admin-benchmark-heatmap.png)

## Quick Start

### Requirements

- macOS on Apple Silicon
- Node `22.x`
- Python `3.12`
- MLX-compatible local environment

### Install

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env.local
```

### Start the web app

```bash
npm run dev
```

Default routes:

- [http://localhost:3011/agent](http://localhost:3011/agent)
- [http://localhost:3011/compare](http://localhost:3011/compare)
- [http://localhost:3011/fine-tune](http://localhost:3011/fine-tune)
- [http://localhost:3011/models](http://localhost:3011/models)
- [http://localhost:3011/benchmarks](http://localhost:3011/benchmarks)
- [http://localhost:3011/retrieval](http://localhost:3011/retrieval)
- [http://localhost:3011/experiments](http://localhost:3011/experiments)
- [http://localhost:3011/admin](http://localhost:3011/admin)

### Start the local model gateway

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install mlx mlx-lm
python scripts/local_model_gateway_supervisor.py
```

If your preferred Python is outside `PATH`, set `LOCAL_AGENT_PYTHON_BIN` before starting the app or gateway.

Gateway health:

- [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)

## Verification

```bash
npm run typecheck:changed
npm run smoke:routes
npm run smoke:screenshots
```

## Configuration

Copy `.env.example` to `.env.local` and fill only the providers you want to use.

Important notes:

- `.env.local` is ignored by git.
- Remote providers are optional.
- Several targets use OpenAI-compatible or Claude-compatible endpoints.
- Public defaults in this repository are sanitized placeholders.

## Repository Structure

```text
app/                      Next.js app routes and thin API transports
components/               Shared UI and compatibility shells
features/                 Feature-owned routes, contracts, state, actions, and application ports
lib/agent/                Agent runtime, providers, benchmark, gateway helpers
lib/finetune/             Fine-tune store facade and split operation services
scripts/                  Local gateway, runtime, verification, and release scripts
docs/                     Architecture, release notes, launch notes, roadmap, and assets
modelscope/               ModelScope profile/readme metadata
public/                   Public assets and social cover art
```

## Distribution

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- Default ModelScope repo id: `haozi667788/first-llm-studio`

The ModelScope package script exports the committed Git tree so GitHub and ModelScope can stay file-identical for each synced version.

## Security and Privacy

- Sensitive local actions require confirmation.
- Secrets belong in `.env.local`.
- Public repository defaults are sanitized.
- New public commits should use a GitHub noreply address where possible.
- See [SECURITY.md](./SECURITY.md).

## Contributing

Issues and PRs are welcome.

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/open-source-backlog.md](./docs/open-source-backlog.md)

## Release Notes

- Current version: [`VERSION`](./VERSION)
- Release notes: [`docs/releases`](./docs/releases)
- Release process: [`docs/release-process.md`](./docs/release-process.md)
- Latest release note: [v0.4.1](./docs/releases/v0.4.1_2026-07-01.md)

---

# 简体中文

First LLM Studio 是一个面向 Apple Silicon 的本地优先 LLM 工作台。它把本地 MLX 运行时、远端 API 目标、Agent 会话、Compare 对比、Fine-tune 微调、Benchmark 评测、模型发现、runtime 恢复、发布证据和后台监控统一到一个产品界面里。

它不是另一个聊天壳，而是给真正需要比较模型行为、调试 runtime、跑评测、准备 adapter，并把本地/远端模型工作流收在同一个产品循环里的开发者使用。

## 产品入口

| 路由 | 核心工作流 |
| --- | --- |
| `/agent` | 带工具循环的 Agent 会话、target 选择、runtime 状态、replay、trace review，以及内嵌 Compare 入口。 |
| `/compare` | 前台 Compare Studio，负责 prompt 编排、lane preview、recipe 持久化、review drawer 和 benchmark handoff。 |
| `/fine-tune` | 前台 Fine-tune Studio，覆盖数据集、配方、训练、评估、adapter proof loop、导出、报告和 artifacts。 |
| `/models` | 本地/社区模型发现、安装验证、硬件适配和风险提示。 |
| `/benchmarks` | Benchmark run controls、进度、报告、发布证据、baseline 和回归审阅。 |
| `/retrieval` | 前台知识管理、路径导入、chunk 检查和 grounded retrieval 验证。 |
| `/experiments` | 统一 Session/Run 时间线、artifact lineage、跨功能导航、筛选和保留策略。 |
| `/admin` | Runtime、队列、benchmark 历史、provider health、guardrails 和 audit timeline 的监控/配置镜像。 |

## 大版本核心功能

| 版本 | 核心功能 |
| --- | --- |
| `v0.1` 基础版 | 建立本地优先 Web Studio、Apple Silicon/MLX 网关工作流、本地 + 远端 target catalog、runtime telemetry，以及 Agent/Admin 的第一版操作分层。 |
| `v0.2` Agent + Benchmark 运维 | 增强 Agent 工作台、Compare 式 target review、replay/trace 检查、runtime recovery controls、正式 benchmark 运维、baseline 和回归证据。 |
| `v0.3` Fine-tune + 发布证据 | 加入 evaluation、adapter chat、adapter export、distillation starter 等 fine-tune 操作循环；扩展 operation history、分区 typecheck、截图 smoke、route smoke 和公开发布素材。 |
| `v0.4` 产品结构发布版 | 把 `/fine-tune`、`/compare`、`/models`、`/benchmarks`、`/retrieval`、`/experiments` 推进为前台产品路由；迁移 feature-owned state/actions；接通 artifact lineage、导航和 retention；统一 dark-glass studio/workbench 视觉；使用 canonical API；Admin 收口为监控/配置。 |
| `v0.4.1` 稳定基线 | 修复 dataless 工作区导致的启动/编译卡死，保持 route smoke 和 typecheck 通过，刷新 OpenAI-compatible `/v1` 接口、provider 状态回报和当前实机 UI 证据，并归档真实 Qwen3 4B LoRA 训练的 checkpoint/report/chart evidence。 |
| `v0.5` Starter 轨道 | 企业 RAG、部署 registry、OpenAI-compatible API、telemetry、release-readiness gates、生产签收和 control-plane rehearsal 持续放在显式 preview gate 后推进，满足证据门槛后再 promotion。 |

当前发布版本见 [`VERSION`](./VERSION)。

## 对哪些用户有价值

### Apple Silicon 本地 AI 开发者

- 在统一上下文预算下，对比 MLX 本地模型和托管 API。
- 不离开应用就能查看 runtime 成本、prewarm、release、恢复动作和硬件压力。
- 判断哪个本地模型真的适合日常 coding / analysis 工作流。

### Agent / 工具链团队

- 在一个工作台里验证 tool calling、repo-grounded behavior、replay 和 patch 流程。
- 直接把 Compare 结果送入 Benchmark，不必切换产品。
- 区分失败来源：模型质量、provider 行为，还是本地 runtime 不稳。

### 评测 / 平台工程团队

- 用可复现 profile 跑 formal 和 focused benchmark suites。
- 查看 baseline、delta、run note、失败分类和发布证据。
- 让本地与远端 target 落在同一个可比较的 target catalog 里。

## 核心价值

- 本地 + 远端统一 target catalog。
- Compare Lab 支持模型对模型审阅。
- Fine-tune 工作流覆盖 dataset、recipe、training、evaluation、adapter proof loop、export、best-checkpoint 选择和 LoRA 发布证据。
- Benchmark 运维覆盖 history、progress、baseline、report 和 release evidence。
- Retrieval 前台覆盖文档导入、chunk 检查和 grounded evidence probe。
- Experiments 时间线覆盖 Session/Run lineage、artifact 导航和 retention policy。
- Replay、trace review、patch inspection 与可导出的审阅记录。
- Runtime 运维覆盖 prewarm、release、restart、日志检查、telemetry 和 recovery。
- 支持本地/社区模型发现和远端 provider health 扫描。

## 当前支持的 Target

### 本地

- `Local Qwen3 0.6B`
- `Local Qwen3 4B 4-bit`
- `Local Qwen3.5 4B 4-bit`
- `Local Gemma 3 4B It Qat 4-bit`

### 远端

- `OpenAI Codex`
- `OpenAI GPT-5.5`
- `Claude API`
- `DeepSeek API`
- `Kimi API`
- `GLM API`
- `Qwen API`

## 截图

以下截图来自本地运行版本，并已通过 `npm run typecheck` 与 `npm run smoke:routes`。README 截图使用 `npm run screenshots:readme` 以 2x DPR 生成，LoRA 证据图从 SVG 以 2x DPR 导出，确保在 GitHub 和 ModelScope 缩放后文字仍然清晰。

Agent 工作台：target catalog、runtime rail 与工具化输入区：

![Agent 工作台](./docs/assets/screenshots/agent-workbench.png)

Fine-tune Studio：工作流 tab、训练控制与 report/evidence 面板：

![Fine-tune Studio](./docs/assets/screenshots/fine-tune-studio.png)

Fine-tune 完成作业：真实 loss 曲线、训练/验证轨迹与 handoff 操作：

![Fine-tune 训练曲线](./docs/assets/screenshots/fine-tune-training-curve.png)

真实 Qwen3 4B LoRA 发布证据：包含 save/eval 事件标记和自动选择的最佳 checkpoint：

![Qwen3 4B LoRA 发布证据](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.png)

矢量版本：[`fine-tune-qwen4b-lora-chart.svg`](./docs/assets/screenshots/fine-tune-qwen4b-lora-chart.svg)。完整 run archive 与 manifest：[`docs/release-evidence/finetune-qwen4b-lora-2026-07-01`](./docs/release-evidence/finetune-qwen4b-lora-2026-07-01)。

Benchmark Studio：运行控制与历史证据卡片：

![Benchmark Studio](./docs/assets/screenshots/benchmarks-studio.png)

Benchmark：本地 smoke run 生成的真实评测证据：

![Benchmark 运行证据](./docs/assets/screenshots/benchmark-run-evidence.png)

Models Studio：硬件适配 chips 与社区模型扫描：

![Models Studio](./docs/assets/screenshots/models-studio.png)

Compare、Retrieval 与 Admin：

![Compare Studio](./docs/assets/screenshots/compare-studio.png)
![Retrieval Studio](./docs/assets/screenshots/retrieval-studio.png)
![Admin dashboard](./docs/assets/screenshots/admin-dashboard.png)
![Admin benchmark 热力图](./docs/assets/screenshots/admin-benchmark-heatmap.png)

## 快速开始

### 环境要求

- Apple Silicon macOS
- Node `22.x`
- Python `3.12`
- 可运行 MLX 的本地环境

### 安装

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env.local
```

### 启动 Web 应用

```bash
npm run dev
```

默认入口：

- [http://localhost:3011/agent](http://localhost:3011/agent)
- [http://localhost:3011/compare](http://localhost:3011/compare)
- [http://localhost:3011/fine-tune](http://localhost:3011/fine-tune)
- [http://localhost:3011/models](http://localhost:3011/models)
- [http://localhost:3011/benchmarks](http://localhost:3011/benchmarks)
- [http://localhost:3011/retrieval](http://localhost:3011/retrieval)
- [http://localhost:3011/experiments](http://localhost:3011/experiments)
- [http://localhost:3011/admin](http://localhost:3011/admin)

### 启动本地模型网关

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install mlx mlx-lm
python scripts/local_model_gateway_supervisor.py
```

如果 Python 不在 `PATH` 中，可以在启动前设置 `LOCAL_AGENT_PYTHON_BIN` 指向实际解释器。

网关健康检查：

- [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)

## 验证

```bash
npm run typecheck:changed
npm run smoke:routes
npm run smoke:screenshots
```

## 配置说明

把 `.env.example` 复制成 `.env.local`，只填写你要启用的 provider 即可。

需要注意：

- `.env.local` 已被 git 忽略。
- 远端 provider 是可选的。
- 部分 target 走 OpenAI-compatible / Claude-compatible endpoint。
- 本仓库公开版本已经做过脱敏，占位值需要替换成你自己的 endpoint。

## 仓库结构

```text
app/                      Next.js app routes 与 thin API transports
components/               共享 UI 与兼容 shell
features/                 feature-owned routes、contracts、state、actions、application ports
lib/agent/                Agent runtime、providers、benchmark、gateway helpers
lib/finetune/             Fine-tune store facade 与拆分后的 operation services
scripts/                  本地网关、runtime、验证和发布脚本
docs/                     架构、release notes、launch notes、roadmap 和 assets
modelscope/               ModelScope 主页/readme 元数据
public/                   对外资源和社媒封面图
```

## 发布与同步

- GitHub: [https://github.com/ChrisChen667788/Your-First-LLM-Studio](https://github.com/ChrisChen667788/Your-First-LLM-Studio)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- 默认 ModelScope repo id: `haozi667788/first-llm-studio`

ModelScope 打包脚本会导出已提交的 Git tree，因此每次同步都可以让 GitHub 和 ModelScope 保持同一份文件快照。

## 安全和隐私

- 敏感本地操作默认需要确认。
- Secret 应保存在 `.env.local`。
- 公开仓库默认配置已经做过脱敏。
- 新增公开提交应尽量使用 GitHub noreply 地址。
- 见 [SECURITY.md](./SECURITY.md)。

## 贡献

欢迎 issue 和 PR。

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [docs/open-source-backlog.md](./docs/open-source-backlog.md)

## 发布说明

- 当前版本：[`VERSION`](./VERSION)
- Release notes：[`docs/releases`](./docs/releases)
- 发布流程：[`docs/release-process.md`](./docs/release-process.md)
- 最新版本说明：[v0.4.1](./docs/releases/v0.4.1_2026-07-01.md)
