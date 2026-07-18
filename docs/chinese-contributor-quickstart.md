# 中文贡献者快速上手

这份指南覆盖从拉取代码到提交一个可验证 PR 的最短路径。英文规则仍以根目录的 `CONTRIBUTING.md` 为准。

## 1. 准备环境

- macOS 或 Linux
- Node.js 22
- npm 10+
- 可选：Apple Silicon + Python 3.12，用于 MLX 本地模型运行
- 可选：Ollama，用于统一 runtime bridge 验证

```bash
nvm install 22
nvm use 22
npm install
cp .env.example .env.local
```

不要把 `.env.local`、API key、私有 endpoint 或个人模型路径提交进仓库。

## 2. 启动前端

```bash
npm run dev
```

默认地址是 `http://localhost:3011`。常用产品路由：

| 路由 | 主要职责 |
| --- | --- |
| `/agent` | 聊天、工具调用、本地/远端 runtime 与 session evidence |
| `/compare` | 多模型 lane 对比、recipe 与复现 |
| `/fine-tune` | 数据、LoRA recipe、训练、checkpoint、报告与导出 |
| `/models` | Model Hub、安装、校验、存储与 runtime handoff |
| `/benchmarks` | 评测运行、历史、baseline 与 issue summary |
| `/retrieval` | 文档、知识库、权限过滤、citation evidence |
| `/experiments` | 跨功能 artifact timeline 与 release evidence |
| `/workflows` | 工作流编辑、断点与执行状态 |
| `/release` | release train、promotion gate 与外部阻塞项 |
| `/admin` | 运维 read model、兼容层证据与诊断入口 |

## 3. 可选本地模型网关

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -U pip mlx mlx-lm
python scripts/local_model_gateway_supervisor.py
```

本地 runtime 没有启动时，页面必须显示 unavailable 或 recovery evidence，不能伪造健康状态。

## 4. 开发与验证

提交前至少运行：

```bash
npm run typecheck:changed
npm run smoke:routes
```

修改 UI 时再运行：

```bash
npm run screenshots:release
npm run validate:screenshots
```

修改 Agent 演示流程时运行：

```bash
npm run video:release -- --flow agent-workbench
```

Benchmark 行为变化需要附一条真实 run 说明。远端 provider、云 KMS、签名或生产 HA 没有真实凭据时，证据必须保留为 blocked 或 evidence-needed。

## 5. 提交 PR

1. 从最新 `main` 创建功能分支。
2. 只修改与 issue 直接相关的边界。
3. 在 PR 中写清行为变化、验证命令和仍未覆盖的外部门槛。
4. UI 变化附高清截图；动态交互变化附 MP4 回执。
5. Benchmark 回归使用 `/benchmarks` 每条历史记录的 **Issue summary** 导出。

Bug issue 建议包含：预期行为、实际行为、本地或远端 lane、模型与上下文、日志或截图，以及可复现步骤。
