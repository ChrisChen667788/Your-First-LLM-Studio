# Product Tour and Positioning / 产品展示与定位

Reviewed 2026-10-06 against the local `v1.5.1` standalone build, the current source tree, [release state](../release-state.json), and the media manifests below. This is the current product-facing copy source; older launch-post packs are historical templates, not current release announcements.

2026-10-06 复查了本地 `v1.5.1` 独立构建、当前源码、[发布状态](../release-state.json)和下方素材清单。本文是当前对外产品文案基准；早期发布帖包仅作历史模板，不应当成今日发布公告。

## Positioning / 一句话定位

**EN:** First LLM Studio is a local-first model workbench for Apple Silicon that connects Agent sessions, model comparison, fine-tuning, benchmarks, retrieval, runtime operations, and reviewable evidence.

**中文：** First LLM Studio 是面向 Apple Silicon 的本地优先模型工作台，把 Agent、模型对比、微调、评测、检索、运行时操作和可复查证据连成一条工作流。

## Product Highlights / 产品亮点

| Highlight | What the product currently offers | Evidence boundary |
| --- | --- | --- |
| One model operating surface / 一个模型操作面 | Local MLX and configured remote targets can be selected in Agent and Compare; Models, Benchmark, and Admin expose adjacent diagnostics. | A catalog entry or unconfigured remote endpoint is not an accepted live provider run. |
| Compare to evaluation / 从对比走向评测 | Compare owns prompt/lane configuration, review, saved recipes, and benchmark handoff. | The fresh screenshot shows configuration, not a completed paired model result. |
| Training with artifact lineage / 训练有产物来路 | Fine-tune foreground UI connects dataset, recipe, job, evaluation, adapter and export surfaces. | The isolated current capture contains a starter dataset and no new completed training job; the separate Qwen3 4B LoRA chart is a real **archived 2026-07-01** local run. |
| Scoring with protocol context / 评分有协议上下文 | Benchmark UI exposes standards, runs, scorer replay, baselines, and release evidence. | The MATH-500 500-item result is an **archived local** run, not a new run, external leaderboard result, or production qualification. |
| Visible gates / 门槛可见 | Experiments and operations surfaces distinguish source, local, external, distribution, and production states. | Current source implementation does not change distribution `HOLD` or production `BLOCKED`. |

## Use Cases and Business Value / 场景与商业价值

| For / 面向 | Job to finish / 要完成的工作 | Potential value / 潜在价值 | Pilot measure / 试点度量 |
| --- | --- | --- | --- |
| Apple Silicon local-AI builder / 本地模型开发者 | Choose a feasible model, inspect runtime pressure, and compare it with a configured API target. | Less switching between model manager, shell, and comparison notes. | Time to a justified model choice; number of manual handoffs. |
| Agent and tooling team / Agent 工具链团队 | Revisit a session, inspect tool/target state, compare behavior, and hand a question into evaluation. | Faster separation of model, provider, tool, and runtime causes. | Time to isolate a failure; share of cases with replayable context. |
| Fine-tune practitioner / 微调实践者 | Track dataset/recipe/job/checkpoint/report/adapter relationships. | Less manual artifact reconciliation before an adapter decision. | Share of runs with complete lineage; time to locate the selected checkpoint. |
| Evaluation or platform engineer / 评测与平台工程师 | Run a pinned protocol, inspect scorer and failure breakdown, and review release gates. | More reviewable model decisions and fewer untraceable score claims. | Share of decisions linked to dataset, evaluator, run, and baseline. |

These are workflow value hypotheses, **not measured customer ROI, saved hours, revenue, or production outcomes**. 以上是工作流价值假设，**不是已测得的客户 ROI、节省工时、收入或生产成果**。

## Current Product Media / 当前产品素材

The [capture manifest](./assets/product-tour/2026-10-06/manifest.json) records route, dimensions, hashes, source HEAD and dirty-worktree status for eight `1920 x 1200` screenshots. They come from a local standalone build with fresh temporary data. The capture script replaced absolute machine paths in UI text before export; it did not edit model outputs or metrics. A screenshot proves the UI state pictured, not a completed workflow or external acceptance.

The capture includes local uncommitted development. Publishing these media and document updates does not publish that pending source work; the manifest records the base commit and dirty state.

[抓图清单](./assets/product-tour/2026-10-06/manifest.json)记录了八张 `1920 x 1200` 图片的路由、尺寸、摘要、源码 HEAD 和脏工作区状态。画面来自使用全新临时数据目录的本地独立构建。抓图脚本在导出前替换了 UI 文本中的本机绝对路径，未改模型输出或指标。截图只证明所见界面状态，不证明端到端任务或外部验收。

抓图包含本地未提交的开发内容。本次素材与文档发布不等于发布这些待提交源码；清单记录了基底提交和脏工作区状态。

| Current UI / 当前界面 | Media | Read it as / 解读边界 |
| --- | --- | --- |
| Agent | [agent.png](./assets/product-tour/2026-10-06/agent.png) | Target selection and empty isolated session; no new model inference. |
| Compare | [compare.png](./assets/product-tour/2026-10-06/compare.png) | Prompt/lane controls; no new paired result. |
| Fine-tune | [fine-tune.png](./assets/product-tour/2026-10-06/fine-tune.png) | Starter recipe controls; zero completed jobs in the isolated profile. |
| Benchmarks | [benchmarks.png](./assets/product-tour/2026-10-06/benchmarks.png) | Benchmark controls/catalog in the isolated profile. |
| Models | [models.png](./assets/product-tour/2026-10-06/models.png) | Model and runtime evidence states, including visible HOLDs. |
| Retrieval | [retrieval.png](./assets/product-tour/2026-10-06/retrieval.png) | Retrieval UI and isolated data state. |
| Experiments | [experiments.png](./assets/product-tour/2026-10-06/experiments.png) | Evidence/lineage surfaces with visible external gates. |
| Admin | [admin.png](./assets/product-tour/2026-10-06/admin.png) | Monitoring/configuration surface, not a production deployment. |

Historical evidence remains linked, not silently replaced: [Qwen3 4B LoRA archive](./release-evidence/finetune-qwen4b-lora-2026-07-01/README.md), [MATH-500 local-run record](./release-evidence/v1.6.4-official-evaluators-2026-08-10.md), and [2026-08-30 high-resolution capture](./release-evidence/v3.1.4-high-resolution-live-machine-capture-2026-08-30.md). The existing [hero graphic](./assets/github-hero-data.png) contains explicitly illustrative sample telemetry, not benchmark evidence.

## Short Film / 宣传短片

The [MP4](./assets/product-tour/first-llm-studio-promo.mp4), [README GIF](./assets/product-tour/first-llm-studio-promo.gif), [poster](./assets/product-tour/first-llm-studio-promo.jpg), and [render manifest](./assets/product-tour/promo-manifest.json) form one silent bilingual product tour. The source composition is [`videos/first-llm-studio-promo/index.html`](../videos/first-llm-studio-promo/index.html). It follows the value-first, screenshot-and-provenance pattern used by [Wind Comic](https://github.com/ChrisChen667788/wind-comic) and [Anti-FOMO](https://github.com/ChrisChen667788/antifomo), rendered with this repository's existing Playwright/FFmpeg stack.

| Beat | On-screen idea | Source |
| --- | --- | --- |
| Open | Build locally. Decide with evidence. | Typography only. |
| Agent + Compare | One workbench, inspect model behavior. | Fresh isolated UI captures. |
| Fine-tune | Recipe controls plus labeled historical LoRA chart. | Fresh UI + archived 2026-07-01 local run. |
| Benchmark | Pinned scoring and replay. | Labeled archived MATH-500 local run. |
| Experiments + close | Keep the chain reviewable. | Fresh isolated UI and product name. |

The film is a **montage**, not a continuous recorded session. It does not demonstrate live provider entitlement, new training, new benchmark results, customer outcomes, external acceptance, distribution approval, or production readiness. The MP4 is silent so the GIF/README preview has no audio expectation.

本片是**镜头蒙太奇**，不是连续实机任务录像；不代表实时供应商账号权限、新训练或评测结果、客户成效、外部验收、分发批准或生产就绪。MP4 刻意无声，便于 README 动图预览。

To refresh on a clean local build: start the app with isolated `LOCAL_AGENT_DATA_DIR` and `FIRST_LLM_WORKSPACE_ROOT`, then run `npm run screenshots:product-tour` and `npm run video:promo`. Recheck every frame and every source receipt before publishing. The manifests describe the build used here; a future build needs a new dated capture, not a silent overwrite.

## Product Document Audit / 产品文档复查

| Entry point / 入口 | 2026-10-06 action / 处理 | Remaining boundary / 保留边界 |
| --- | --- | --- |
| [README](../README.md), [中文 README](../README.zh-CN.md) | Added bilingual film, refreshed current UI gallery, and rewrote audience/highlight/value copy. | Older dated training/benchmark evidence remains labeled historical; the hero uses illustrative telemetry. |
| [ModelScope README](../modelscope/README.md) | Matched film, gallery, scenario copy, and source/public/desktop release distinctions. | Mirror publication and external acceptance are not asserted by this edit. |
| [GitHub launch kit](./open-source-launch-kit.md), [ModelScope launch kit](./modelscope-launch-kit.md) | Updated reusable short pitch, About wording, highlights, and media order. | Historical `v0.2.3` post text is kept as an archive. |
| [Growth copy](./open-source-growth-copy.md), [launch posts](./launch-posts-final.md), [same-day sequence](./today-launch-sequence.md) | Marked earlier `v0.3.0` release templates archival and pointed new authors here. | Old campaign text/URLs are not silently rewritten as a new release. |
| [Repository checklist](./github-repository-setup-checklist.md) | Added bilingual About and product-media validation checks. | GitHub About/social preview settings need manual verification; source files cannot prove the remote setting changed. |
| [Video workflow](./demo-video-workflow.md) | Distinguished the release-route recording from the README product montage and documented isolated capture and validation commands. | New media still needs frame-by-frame and privacy review before publication. |

This audit covers the active README/ModelScope entry points and reusable launch materials, not every historical release note. No new customer ROI, public release, ModelScope publication, or production status is claimed.

本次覆盖当前 README、ModelScope 入口和可复用宣传素材，而非逐篇改写历史版本说明。没有新增客户 ROI、公开发布、ModelScope 已同步或生产就绪的主张。
