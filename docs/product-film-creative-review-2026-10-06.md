# Data in Motion / 产品短片设计复查

Reviewed / 复查日期: **2026-10-06**. This revision replaces the screenshot montage, not the dated UI gallery or product release state. 本次替换截图蒙太奇短片，不改写实机图集、历史指标或产品发布状态。

## References / 参考复查

These are reference observations, not a ranking or a claim that every linked video was watched in full. 外部资料用于比较叙事与制作方式，不构成排名，也不声称完整观看了全部链接中的视频。

| Source / 来源 | Verified material / 已核对内容 | Decision / 设计取舍 |
| --- | --- | --- |
| [Jan on GitHub](https://github.com/janhq/jan), [Jan release post on Reddit](https://www.reddit.com/r/LocalLLaMA/comments/1lf5yog/) | First-party positioning and community release text emphasize local control and a concise set of changes. 已核对官方定位与发布帖。 | Keep a short value-led opening; do not enumerate the whole feature catalog. 开篇突出本地控制，每镜只讲一个重点。 |
| [Jan-nano creator demo on Reddit](https://www.reddit.com/r/LocalLLaMA/comments/1lbrnod/jannano_a_4b_model_that_can_outperform_671b_on_mcp/) | Creator foregrounds a small model and explicitly qualifies the comparison by task/tool setup. 阅读原作者演示说明及比较限定。 | Borrow the single-number hook, not its benchmark claim or competitor comparison. 借鉴单一数据钩子，不借用其分数或竞品胜出主张。 |
| [SWIFT ModelScope studio](https://modelscope.cn/studios/iic/Scalable-lightWeight-Infrastructure-for-Fine-Tuning/summary), [ModelScope official introduction video](https://www.bilibili.com/video/BV1tz4y1L77G/) | ModelScope studio shell was reachable; the official account's 9:15 introduction and training/inference subject were verified from its video page. The full tutorial was not reviewed. 魔搭空间为动态页面；核对了官方工具介绍视频页，未完整观看教程。 | Keep train-to-evaluate continuity; reject tutorial-length pacing and dense console screenshots. 保留训练到评测的逻辑，不采用长教程节奏。 |
| [Cursor 3 official launch](https://cursor.com/blog/cursor-3), [official X post](https://x.com/cursor_ai/status/2039768512894505086) | Official site video frames at 2, 25 and 65 seconds show a founder-led explanation. X returned 403 in this review. 官网视频抽查三帧，属于创始人讲解；X 原帖访问受限。 | Useful for focused product positioning, not a kinetic-typography visual reference. 用于定位参考，不把它描述成动态图形示范。 |
| [Raycast Notes official launch](https://www.raycast.com/blog/raycast-notes), [creator launch post on Reddit](https://www.reddit.com/r/raycastapp/comments/1gkxvho/raycast_notes_floating_notes_20_finally_released/) | Official feature post and creator's linked short promo were verified. 阅读官方发布说明与作者宣传帖，未声称通看视频。 | Separate a short feature moment from a long walkthrough. 区分短片的记忆点与教程的操作细节。 |
| [Atomik launch-film source](https://github.com/Tejashmakwana/astra-atomik-launch-video), [creator's X post](https://x.com/makwanatejas170/status/2096555742597988400) | Author publishes frame-addressable source, local assets and verification; X returned 403. 官方源码页可读，X 受限。 | Reproduce from source, verify keyframes and codec, freeze asset receipts. 不复制成片、商标、图片或参考音轨。 |
| [Product Launch Video Skill](https://github.com/memex-lab/product-launch-video-skill) | Public skill describes concept, storyboard, deliberate motion and final render review. 阅读其公开制作方法。 | Apply art direction and review discipline through the existing renderer; avoid adding another app framework. 借鉴分镜与审片方法，继续使用既有渲染链。 |

The X access limit and dynamic ModelScope page mean those surfaces were checked for available first-party references, not treated as fully watched film evidence. X 与部分魔搭动态内容存在访问边界，没有用二手摘要冒充完整视频观看。 Third-party film assets and music were not imported. 未导入第三方宣传片素材或音乐。

## Direction / 视觉方向

**Data in Motion:** graphite, frost white and acid green, with coral/cool-gray data accents. Manrope display typography contrasts with IBM Plex Mono data labels. A lit, layered Three.js model sculpture replaces the UI collage. Large numbers lead; curves, sample fields and measured scope support them. 原创立体模型结构代替缩小截图，以大字号数字建立记忆点，再用曲线、阵列和限定范围表达含义。

Six five-second beats give the viewer time to read. Entrances vary between vertical reveal, scale and lateral motion; a short wipe resolves each beat. The MP4 carries an original procedural electronic score and transition sounds. No voice impersonation, licensed commercial track, vendor soundtrack or third-party audio samples are used. 六个五秒镜头，配原创程序化电子配乐及转场声，不仿冒人物声音、不挪用商业曲目。

Rejected / 未采纳: screenshot mosaics, fake UI, competitor logos, arbitrary ROI multipliers, universal hardware-speed claims, vendor leaderboard comparisons, and treating scorer agreement as model accuracy. 未采用截图拼贴、伪造界面、竞品 Logo、无依据收益倍数或混淆评分指标。

## Numeric Scope / 数据口径

| On screen / 画面数据 | Source / 来源 | Scope / 范围 |
| --- | --- | --- |
| 4B / 3.316 GB / 816 steps | [MLX LoRA run manifest](./release-evidence/finetune-qwen4b-lora-2026-07-01/run-manifest.json) | Qwen3 4B 4-bit, starter 960 dataset, one local run on 2026-07-01. Peak training memory is this run's observation, not a general device memory requirement. 单次本地训练记录，不是普遍内存需求。 |
| 0.066 / step 800 | Same manifest, `bestCheckpoint` and checkpoint values | Best validation loss for the starter dataset. Curve uses the recorded checkpoints from steps 100-800, not an invented smooth trend; the initial step-1 loss is outside the displayed interval. Loss does not prove downstream task quality. 曲线显示已记录的 100-800 步，不代表下游质量提升。 |
| 500 scored / 100% scorer replay agreement | [MATH-500 reproducibility](./release-evidence/v1.6.5-benchmark-reproducibility-latest.json) | Stored 500-item local result, replayed on the same host with a fresh isolated scorer. Model accuracy is **32%**, displayed separately. Not independent-host reproduction. 同机评分回放，不是模型准确率或独立主机复现。 |
| 3 local runtimes | [Runtime Fabric receipt](./release-evidence/v1.2.1-runtime-fabric-acceptance-2026-08-30.json) | MLX, Ollama and llama.cpp local acceptance on 2026-08-30, not all catalog runtimes. 仅三种已记录的本机后端。 |
| 234.02 tokens/s | [Local smoke report](./release-evidence/v1.6.3-benchmark-qualification-latest.json), `runtimeSmoke.report` | Local Qwen3 0.6B, one prompt repeated three times, speed profile, no matching baseline. Not a universal sustained throughput, other-model promise or leaderboard result. 单提示三次小样本，无匹配基线。 |

The sculpture, dot filling and animated runtime traces are **artistic representations**. Trace amplitudes are not measured per-backend performance; dots show scoring coverage, not correct answers. Numeric highlights use the archived values above; no fictional performance or customer outcome is introduced. 立体结构、阵列填充和波形属于艺术表达；波幅不是后端实测值，点阵代表评分覆盖而非答对数量。未新增虚构性能或客户成效。

## Delivery / 交付与验证

- [30-second 1080p MP4 with original score](./assets/product-tour/first-llm-studio-promo.mp4), [silent README GIF](./assets/product-tour/first-llm-studio-promo.gif), [poster](./assets/product-tour/first-llm-studio-promo.jpg), [source and evidence hashes](./assets/product-tour/promo-manifest.json).
- Render: Node 22, `npm ci --prefix videos/first-llm-studio-promo`, `npm run video:promo`; preview first with `node scripts/render-product-promo.mjs --preview`.
- Validation: `npm run validate:product-promo`; full MP4 decode and audio checks; 12 desktop/mobile layout checks, nonblank canvas pixels, changed 3D frames and deterministic non-linear seeking. 检查素材摘要、编解码、全部解码、音轨及桌面/手机画面。
- Current UI screenshots remain in the separate [dated gallery](./product-tour-and-positioning-2026-10-06.md#current-product-media--当前产品素材). Production/distribution gates and uncommitted application development are unaffected. 实机图集、生产门禁和待提交开发内容保持独立。

Cross-host pixel/MP4 byte identity is not promised: fonts, Chromium, GPU and FFmpeg versions can affect output. Local deterministic seeking is checked for this render; it does not imply production or external acceptance. 不承诺跨主机逐像素或 MP4 字节一致；本次本地渲染通过也不等于外部验收。
