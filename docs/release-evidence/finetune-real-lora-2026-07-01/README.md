# Real LoRA Release Evidence · ft-job-real-lora-20260701-165151

Generated: 2026-07-01T08:57:56.725307Z

## Result

- Status: completed
- Base model: `hf://Qwen/Qwen3-0.6B-MLX-6bit@3818e758c8ed9ec596a5e0c4c426fb81f7c0be18`
- Dataset: First LLM Studio starter 384 · 384 samples · train/valid/test 327/38/19
- Adapter: `release-real-lora-qwen06-384`
- Trainable params: 1.442M / 596.050M, captured in `worker.log`
- Duration: 2026-07-01T08:53:29.151408Z -> 2026-07-01T08:54:29.096190Z
- Peak memory: 0.846 GB
- Latest tokens/s: 790.2

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
| Train | 3.953 | 0.083 | 0.043 | -3.870 | -97.9% |
| Validation | 5.607 | 0.060 | 0.060 | -5.547 | -98.9% |

## Checkpoints

| Step | Path |
| ---: | --- |
| 100 | `runtime-artifacts/ft-job-real-lora-20260701-165151/artifacts/checkpoint-0000100` |
| 200 | `runtime-artifacts/ft-job-real-lora-20260701-165151/artifacts/checkpoint-0000200` |
| 300 | `runtime-artifacts/ft-job-real-lora-20260701-165151/artifacts/checkpoint-0000300` |


Selected best checkpoint: step 327 · eval_loss=0.06 · `runtime-artifacts/ft-job-real-lora-20260701-165151/artifacts`

## Public Evidence Files

- `run-manifest.json`, `metrics.csv`, and `training-report.md`
- `ft-job-real-lora-20260701-165151-chart-evidence.json`
- `ft-job-real-lora-20260701-165151-chart-evidence.svg`
- `ft-job-real-lora-20260701-165151-chart-evidence.png`

The public bundle does not include the job bundle, worker log, adapter weights, checkpoint directories, or full runtime archive. Their paths are portable `runtime-artifacts/...` references only. This run proves the real MLX training workflow and loss/checkpoint instrumentation; task-level quality promotion remains `HOLD` until a frozen baseline, external blind evaluation, and multi-seed comparison are archived.

## Reproduce

```bash
FIRST_LLM_JOB_BUNDLE=/path/to/ft-job-real-lora-20260701-165151/job-bundle.json \
  .venv/bin/python scripts/finetune_worker.py --job-bundle "$FIRST_LLM_JOB_BUNDLE"
```
