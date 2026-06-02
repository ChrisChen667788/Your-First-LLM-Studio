# First LLM Studio

> English | [简体中文](#简体中文)

A local-first LLM studio for Apple Silicon that brings MLX local runtimes, remote API comparison, Agent sessions, Compare Lab, Fine-tune, Benchmark, model discovery, replay, trace review, runtime recovery, and telemetry into one workspace.

![First LLM Studio cover](./assets/oss-cover.png)

## What it is

First LLM Studio is designed for developers who need to run local and remote LLM workflows side by side and inspect how those systems actually behave in production-like conditions.

It is a working surface for:

- local model experimentation on Apple Silicon
- remote API comparison under aligned context budgets
- route-owned Compare and Fine-tune workflows
- benchmark operations and regression review
- runtime recovery, telemetry, and observability
- replay, trace review, and tool-call inspection

## Product surfaces

| Surface | Core workflow |
| --- | --- |
| Agent | Tool-enabled sessions, runtime state, replay, trace review, and embedded Compare. |
| Compare | Prompt composer, lane preview, recipe persistence, review drawer, and benchmark handoff. |
| Fine-tune | Datasets, recipes, training, evaluation, adapter proof loops, export, reports, and artifacts. |
| Models | Community/local model discovery, install verification, hardware fit, and risk signals. |
| Benchmarks | Run controls, progress, baselines, reports, release evidence, and regression review. |
| Admin | Monitoring/configuration mirror for runtime, queues, provider health, guardrails, and audit timelines. |

## Major versions

| Version | Core capabilities |
| --- | --- |
| `v0.1` | Local-first studio foundation, MLX gateway workflow, target catalog, telemetry, and Agent/Admin split. |
| `v0.2` | Agent workbench expansion, Compare-style review, replay/trace inspection, runtime recovery, benchmark ops, baselines, and regression evidence. |
| `v0.3` | Fine-tune operation loops, adapter chat/export, distillation starters, operation history, partitioned typechecks, route/screenshot smoke, and launch assets. |
| `v0.4` source checkpoint | Foreground `/fine-tune`, `/compare`, `/models`, and `/benchmarks`; feature-owned state/actions; dark-glass studio/workbench style; thin API wrappers; GitHub/ModelScope sync packaging. |

## Who it helps

### Local AI builders

- evaluate which local MLX models are really usable for daily coding and analysis
- compare local and remote outputs under fair constraints
- keep hardware cost and runtime state visible while iterating

### Agent and tooling teams

- validate tool loops, repo-grounded behavior, and output contracts
- turn Compare runs into repeatable benchmark review
- debug quality versus provider versus runtime regressions

### Evaluation and platform engineers

- launch formal and focused benchmark suites
- inspect failure causes, run notes, release evidence, and baseline drift
- operate local runtime prewarm, release, restart, and health checks from the same product

## Visual overview

### Landing page

![Landing page](./assets/landing-page.png)

### Agent workbench

![Agent workbench](./assets/agent-workbench.png)

### Admin dashboard

![Admin dashboard](./assets/admin-dashboard.png)

## Benchmark and telemetry proof

### Benchmark percentile board

![Benchmark percentile board](./assets/benchmark-percentiles.png)

### Formal regression summary

![Formal regression summary](./assets/formal-regression-summary.png)

### Local runtime telemetry

![Local runtime telemetry](./assets/runtime-telemetry-cards.png)

## Repository

- GitHub: [https://github.com/ChrisChen667788/local-agent-lab](https://github.com/ChrisChen667788/local-agent-lab)
- ModelScope profile: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- Current tagged release note: [v0.3.2](https://github.com/ChrisChen667788/local-agent-lab/blob/main/docs/releases/v0.3.2_2026-05-18.md)

---

# 简体中文

First LLM Studio 是一个面向 Apple Silicon 的本地优先 LLM 工作台，把 MLX 本地运行时、远端 API 对比、Agent 会话、Compare Lab、Fine-tune、Benchmark、模型发现、replay、trace review、runtime recovery 和模型遥测统一到同一个界面里。

![First LLM Studio 封面](./assets/oss-cover.png)

## 这是什么项目

它不是单纯的聊天壳，而是面向真实工作流的操作台，适合：

- 本地模型实验
- 本地 / 远端公平对比
- 前台 Compare 和 Fine-tune 工作流
- benchmark 回归审阅
- runtime 排障与恢复
- tool call、replay、trace 检查

## 产品入口

| 模块 | 核心工作流 |
| --- | --- |
| Agent | 工具会话、runtime 状态、replay、trace review 和内嵌 Compare。 |
| Compare | Prompt 编排、lane preview、recipe 持久化、review drawer 和 benchmark handoff。 |
| Fine-tune | 数据集、配方、训练、评估、adapter proof loop、导出、报告和 artifacts。 |
| Models | 社区/本地模型发现、安装验证、硬件适配和风险提示。 |
| Benchmarks | Run controls、进度、baseline、报告、发布证据和回归审阅。 |
| Admin | Runtime、队列、provider health、guardrails 和 audit timeline 的监控/配置镜像。 |

## 大版本核心功能

| 版本 | 核心能力 |
| --- | --- |
| `v0.1` | 本地优先 Studio 基础、MLX 网关工作流、target catalog、telemetry 和 Agent/Admin 分层。 |
| `v0.2` | Agent 工作台扩展、Compare 式审阅、replay/trace 检查、runtime recovery、benchmark 运维、baseline 和回归证据。 |
| `v0.3` | Fine-tune 操作循环、adapter chat/export、distillation starter、operation history、分区 typecheck、route/screenshot smoke 和发布素材。 |
| `v0.4` 源码 checkpoint | 前台 `/fine-tune`、`/compare`、`/models`、`/benchmarks`；feature-owned state/actions；dark-glass studio/workbench 风格；thin API wrappers；GitHub/ModelScope 同步包。 |

## 对哪些用户有价值

### 本地 AI 开发者

- 判断哪些 MLX 本地模型真的适合日常 coding / analysis
- 在统一约束下对比本地与远端模型
- 一边调模型，一边看硬件开销和 runtime 状态

### Agent / 工具链团队

- 验证工具循环、repo grounding 和输出契约
- 把 Compare 结果转成可复现 benchmark
- 区分问题到底来自模型质量、provider 行为还是 runtime 不稳

### 评测 / 平台工程团队

- 启动 formal 和 focused benchmark 套件
- 查看失败原因、run note、发布证据和 baseline 漂移
- 在一个产品里完成 prewarm、release、restart 和健康检查

## 页面预览

### 首页

![首页截图](./assets/landing-page.png)

### Agent 工作台

![Agent 工作台截图](./assets/agent-workbench.png)

### Admin 后台

![Admin 后台截图](./assets/admin-dashboard.png)

## Benchmark 与监控证明

### Benchmark 百分位看板

![Benchmark 百分位看板](./assets/benchmark-percentiles.png)

### 正式回归汇总

![正式回归汇总](./assets/formal-regression-summary.png)

### 本地 runtime 实时监控

![本地 runtime 实时监控](./assets/runtime-telemetry-cards.png)

## 仓库地址

- GitHub: [https://github.com/ChrisChen667788/local-agent-lab](https://github.com/ChrisChen667788/local-agent-lab)
- ModelScope 主页: [https://www.modelscope.cn/profile/haozi667788](https://www.modelscope.cn/profile/haozi667788)
- 当前已打标签版本说明: [v0.3.2](https://github.com/ChrisChen667788/local-agent-lab/blob/main/docs/releases/v0.3.2_2026-05-18.md)
