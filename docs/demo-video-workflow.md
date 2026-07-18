# Demo Video Workflow / 演示视频流程

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
