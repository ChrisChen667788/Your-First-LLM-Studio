# Demo Video Workflow / 演示视频流程

Reviewed 2026-10-06. The release-route recording below and the [README product film](./product-tour-and-positioning-2026-10-06.md#short-film--宣传短片) serve different purposes. The product film is a motion-graphics montage of isolated current UI and labeled historical local evidence; it is not a continuous live run.

2026-10-06 复查：下方版本路由录屏与 [README 产品短片](./product-tour-and-positioning-2026-10-06.md#short-film--宣传短片)用途不同。宣传片是隔离环境当前界面与明确标注的历史本地证据组成的动态蒙太奇，不是连续实机任务录像。

The release video workflow records a deterministic product route with Playwright, keeps the raw WebM under ignored `output/`, and publishes a compact H.264 MP4 with a SHA-256 metadata receipt.

演示视频流程使用 Playwright 录制确定性的产品路由，将原始 WebM 留在已忽略的 `output/`，再用 ffmpeg 输出附带 SHA-256 元数据回执的 H.264 MP4。

## Requirements

- The app is running at `http://localhost:3011`.
- Playwright Chromium is installed.
- `ffmpeg` and `ffprobe` are available. Override paths with `FFMPEG_PATH` and `FFPROBE_PATH` when needed.

## Commands

```bash
npm run dev
npm run video:release -- --flow agent-workbench
npm run video:release -- --flow agent-workbench --gif
```

The MP4 is written to `docs/assets/demo/agent-workbench.mp4`. The optional GIF stays under `output/demo-video/` by default because GIF files are substantially larger. Recording dimensions, route, duration, codec, file size, and digest are defined or recorded through `docs/demo-video-manifest.json` and the adjacent `.metadata.json` receipt.

MP4 输出到 `docs/assets/demo/agent-workbench.mp4`。可选 GIF 默认放在 `output/demo-video/`，避免把体积明显更大的文件直接提交到仓库。录制尺寸、路由、时长、编码、文件大小和摘要由 manifest 与相邻 metadata 回执共同记录。

Current evidence: [`agent-workbench.mp4`](./assets/demo/agent-workbench.mp4) · [`agent-workbench.mp4.metadata.json`](./assets/demo/agent-workbench.mp4.metadata.json)

## Release Check

1. Run route smoke before recording.
2. Record from a clean viewport without private API keys or user data.
3. Inspect the MP4 from beginning to end.
4. Confirm the metadata dimensions, duration, and SHA-256.
5. Keep the published MP4 below the repository large-file threshold.

## README Product Film / README 产品短片

Use a fresh, isolated data/workspace directory for the app before refreshing the dated UI captures. Never point the capture script at a personal or production profile. The capture script redacts absolute machine paths in UI text and fails on visible private-path/credential patterns, but the resulting images still require manual review.

先用全新的隔离数据和工作区目录运行应用，再更新带日期的界面截图。不要对个人或生产配置运行抓图脚本。脚本会替换界面文字中的本机绝对路径，并在发现可见的私有路径/密钥模式时失败；导出的图片仍需人工复查。

```bash
LOCAL_AGENT_DATA_DIR=/tmp/first-llm-studio-promo/data \
FIRST_LLM_WORKSPACE_ROOT=/tmp/first-llm-studio-promo/workspace \
./scripts/run-next.sh start 3013

PRODUCT_TOUR_BASE_URL=http://127.0.0.1:3013 npm run screenshots:product-tour
npm run video:promo
npm run validate:product-promo
```

The dated screenshot [manifest](./assets/product-tour/2026-10-06/manifest.json) and film [manifest](./assets/product-tour/promo-manifest.json) record hashes, dimensions, capture/build context, and media limits. The raw WebM remains ignored under `output/product-tour/`; the published MP4, GIF, and poster are under `docs/assets/product-tour/`. A later build should use a new dated capture directory and update the film source and manifest, rather than silently overwrite the 2026-10-06 evidence.

带日期的[抓图清单](./assets/product-tour/2026-10-06/manifest.json)和[短片清单](./assets/product-tour/promo-manifest.json)记录摘要、尺寸、抓取/构建背景和素材体积门限。原始 WebM 留在忽略目录 `output/product-tour/`；公开 MP4、GIF 和封面位于 `docs/assets/product-tour/`。后续构建应新建日期目录，并同步更新短片源和清单，不应静默覆盖本次证据。
