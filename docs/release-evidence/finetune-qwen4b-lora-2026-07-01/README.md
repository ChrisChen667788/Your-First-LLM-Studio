# Real Qwen3 4B LoRA Release Evidence · ft-job-qwen4b-lora-20260701-175225

Generated: 2026-07-01T10:09:40.872477Z

## Result

- Status: completed
- Base model: `hf://mlx-community/Qwen3-4B-Instruct-2507-4bit@50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`
- Dataset: First LLM Studio starter 960 · 960 samples · train/valid/test 816/96/48
- Adapter: `release-qwen4b-lora-starter960`
- Trainable params: 3.670M / 4022.468M, captured in `worker.log`
- Duration: 2026-07-01T09:52:38.604508Z -> 2026-07-01T10:06:43.402301Z
- Peak memory: 3.316 GB
- Latest tokens/s: 247.4

## Why This Run Is Better Evidence Than 0.6B

The 0.6B run proved the workflow closure but dropped near its minimum by the first major checkpoint. This 4B run keeps useful checkpoint-level variation after step 100: validation loss moves 0.250 -> 0.132 -> 0.079 -> 0.080 -> 0.071 -> 0.072 -> 0.070 -> 0.066 -> 0.066.

## LoRA Recipe Contract

- Target modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
- MLX backend keys: `self_attn.q_proj`, `self_attn.k_proj`, `self_attn.v_proj`, `self_attn.o_proj`, `mlp.gate_proj`, `mlp.up_proj`, `mlp.down_proj`
- Scheduler / warmup: cosine / 0.03
- Packing policy: disabled
- Eval / save cadence: 100 / 100
- Best checkpoint metric: eval_loss
- Load best checkpoint at end: True

## Loss Summary

| Split | First | Latest | Best | Delta | Relative delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train | 3.880 | 0.045 | 0.044 | -3.835 | -98.8% |
| Validation | 5.275 | 0.066 | 0.066 | -5.209 | -98.7% |

## Validation Checkpoints

| Step | Eval loss | Checkpoint |
| ---: | ---: | --- |
| 100 | 0.25 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000100` |
| 200 | 0.132 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000200` |
| 300 | 0.079 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000300` |
| 400 | 0.08 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000400` |
| 500 | 0.071 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000500` |
| 600 | 0.072 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000600` |
| 700 | 0.077 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000700` |
| 800 | 0.066 | `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000800` |


Selected best checkpoint: step 800 · eval_loss=0.066 · `runtime-artifacts/ft-job-qwen4b-lora-20260701-175225/artifacts/checkpoint-0000800`

## Public Evidence Files

- `run-manifest.json`, `metrics.csv`, and `training-report.md`
- `ft-job-qwen4b-lora-20260701-175225-chart-evidence.json`
- `ft-job-qwen4b-lora-20260701-175225-chart-evidence.svg`
- `ft-job-qwen4b-lora-20260701-175225-chart-evidence.png`

The public bundle does not include the job bundle, worker log, adapter weights, checkpoint directories, or full runtime archive. Their paths are portable `runtime-artifacts/...` references only. This run proves the real MLX training workflow and loss/checkpoint instrumentation; task-level quality promotion remains `HOLD` until a frozen baseline, external blind evaluation, and multi-seed comparison are archived.

## Reproduce

```bash
FIRST_LLM_JOB_BUNDLE=/path/to/ft-job-qwen4b-lora-20260701-175225/job-bundle.json \
  .venv/bin/python scripts/finetune_worker.py --job-bundle "$FIRST_LLM_JOB_BUNDLE"
```
