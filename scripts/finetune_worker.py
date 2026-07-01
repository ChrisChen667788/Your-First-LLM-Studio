#!/usr/bin/env python3

import argparse
import json
import os
import re
import signal
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional


TRAIN_RE = re.compile(
    r"Iter\s+(?P<step>\d+):\s+Train loss\s+(?P<loss>[0-9.]+),\s+Learning Rate\s+(?P<lr>[0-9.eE+-]+),\s+It/sec\s+(?P<it_sec>[0-9.]+),\s+Tokens/sec\s+(?P<tok_sec>[0-9.]+),\s+Trained Tokens\s+(?P<trained>\d+),\s+Peak mem\s+(?P<peak>[0-9.]+)\s+GB"
)
VAL_RE = re.compile(
    r"Iter\s+(?P<step>\d+):\s+Val loss\s+(?P<loss>[0-9.]+),\s+Val took\s+(?P<duration>[0-9.]+)s"
)
SAVE_RE = re.compile(
    r"Iter\s+(?P<step>\d+):\s+Saved adapter weights to(?:\s+(?P<path>.+?))?\.?$"
)

CHILD_PROCESS: Optional[subprocess.Popen[str]] = None
CANCEL_REQUESTED = False


def read_json(path: Path, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not path.exists():
        return fallback
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return fallback


def write_json(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def append_jsonl(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False))
        handle.write("\n")


def append_log(path: Path, line: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line.rstrip("\n"))
        handle.write("\n")


def update_state(state_file: Path, patch: Dict[str, Any]) -> Dict[str, Any]:
    current = read_json(state_file, {})
    current.update(patch)
    current["updatedAt"] = patch.get("updatedAt") or iso_now()
    write_json(state_file, current)
    return current


def append_curve_point(state_file: Path, point: Dict[str, Any]) -> None:
    current = read_json(state_file, {})
    curve = current.get("curve")
    if not isinstance(curve, list):
        curve = []
    curve.append(point)
    current["curve"] = curve[-120:]
    current["updatedAt"] = iso_now()
    write_json(state_file, current)


def update_checkpoint_state(
    state_file: Path,
    checkpoint_events: list[Dict[str, Any]],
    best_checkpoint: Optional[Dict[str, Any]],
) -> None:
    patch: Dict[str, Any] = {
        "checkpointEvents": checkpoint_events[-200:],
        "workerHeartbeatAt": iso_now(),
    }
    if best_checkpoint:
        patch["bestCheckpoint"] = best_checkpoint
    update_state(state_file, patch)


def iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def handle_signal(signum, frame):  # type: ignore[no-untyped-def]
    del signum, frame
    global CANCEL_REQUESTED, CHILD_PROCESS
    CANCEL_REQUESTED = True
    if CHILD_PROCESS and CHILD_PROCESS.poll() is None:
        try:
            CHILD_PROCESS.terminate()
        except Exception:
            pass


def build_command(bundle: Dict[str, Any]) -> list[str]:
    plan = bundle["plan"]
    command = [
        sys.executable,
        "-m",
        "mlx_lm.lora",
        "--config",
        str(plan["configFile"]),
        "--model",
        str(plan["modelRef"]),
        "--data",
        str(plan["datasetDir"]),
        "--train",
        "--fine-tune-type",
        str(plan.get("fineTuneMethod", "lora")),
        "--optimizer",
        str(plan.get("optimizer", "adam")),
        "--num-layers",
        str(plan.get("numLayers", 16)),
        "--batch-size",
        str(plan["batchSize"]),
        "--iters",
        str(plan["totalSteps"]),
        "--learning-rate",
        str(plan["learningRate"]),
        "--adapter-path",
        str(plan["adapterPath"]),
        "--save-every",
        str(plan["saveEvery"]),
        "--steps-per-report",
        str(plan["stepsPerReport"]),
        "--steps-per-eval",
        str(plan["stepsPerEval"]),
        "--grad-accumulation-steps",
        str(plan.get("gradAccumulationSteps", 1)),
        "--max-seq-length",
        str(plan["maxSeqLength"]),
        "--seed",
        str(plan.get("seed", 42)),
    ]
    if plan.get("gradCheckpoint"):
        command.append("--grad-checkpoint")
    return command


def split_saved_adapter_paths(raw_path: Optional[str]) -> list[Path]:
    if not raw_path:
        return []
    return [
        Path(part.strip().strip('"').strip("'")).expanduser()
        for part in raw_path.split(" and ")
        if part.strip().strip('"').strip("'")
    ]


def materialize_checkpoint_dir(
    raw_path: Optional[str],
    step: int,
    plan: Dict[str, Any],
) -> str:
    output_dir = Path(plan.get("adapterPath") or plan.get("outputDir") or "")
    candidates = split_saved_adapter_paths(raw_path)
    checkpoint_file = next(
        (
            candidate
            for candidate in reversed(candidates)
            if candidate.exists() and candidate.name != "adapters.safetensors"
        ),
        None,
    )
    if not checkpoint_file:
        checkpoint_file = next(
            (candidate for candidate in reversed(candidates) if candidate.exists()),
            None,
        )
    if not checkpoint_file:
        return str(output_dir)

    checkpoint_dir = output_dir / f"checkpoint-{step:07d}"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    adapter_config = output_dir / "adapter_config.json"
    if adapter_config.exists():
        shutil.copy2(adapter_config, checkpoint_dir / "adapter_config.json")
    shutil.copy2(checkpoint_file, checkpoint_dir / "adapters.safetensors")
    write_json(
        checkpoint_dir / "checkpoint-manifest.json",
        {
            "step": step,
            "sourceFile": str(checkpoint_file),
            "materializedAt": iso_now(),
            "adapterPath": str(checkpoint_dir),
        },
    )
    return str(checkpoint_dir)


def normalize_checkpoint_path(raw_path: Optional[str], plan: Dict[str, Any]) -> str:
    paths = split_saved_adapter_paths(raw_path)
    for candidate in reversed(paths):
        if candidate.exists():
            return str(candidate)
    return str(plan.get("adapterPath") or plan.get("outputDir") or "")


def attach_best_checkpoint_path(
    best_checkpoint: Optional[Dict[str, Any]],
    checkpoint_events: list[Dict[str, Any]],
    plan: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    if not best_checkpoint:
        return None
    if best_checkpoint.get("path"):
        return best_checkpoint
    best_step = int(best_checkpoint.get("step") or 0)
    total_steps = int(plan.get("totalSteps") or 0)
    if total_steps > 0 and best_step >= total_steps:
        return {
            **best_checkpoint,
            "path": str(plan.get("adapterPath") or plan.get("outputDir") or ""),
        }
    if checkpoint_events:
        nearest = min(
            checkpoint_events,
            key=lambda event: abs(int(event.get("step") or 0) - best_step),
        )
        best_checkpoint = {**best_checkpoint, "path": nearest.get("path")}
    if not best_checkpoint.get("path"):
        best_checkpoint = {
            **best_checkpoint,
            "path": str(plan.get("adapterPath") or plan.get("outputDir") or ""),
        }
    return best_checkpoint


def set_progress(
    state_file: Path,
    step: int,
    total_steps: int,
    *,
    train_loss: Optional[float] = None,
    val_loss: Optional[float] = None,
    learning_rate: Optional[float] = None,
    tokens_per_second: Optional[float] = None,
    peak_memory_gb: Optional[float] = None,
    trained_tokens: Optional[int] = None,
    latest_message: Optional[str] = None,
) -> None:
    current = read_json(state_file, {})
    progress = current.get("progress")
    if not isinstance(progress, dict):
        progress = {}
    progress.update(
        {
            "currentStep": step,
            "totalSteps": total_steps,
            "percent": round((step / max(total_steps, 1)) * 100, 1),
        }
    )
    if train_loss is not None:
        progress["latestTrainLoss"] = train_loss
    if val_loss is not None:
        progress["latestValLoss"] = val_loss
    if learning_rate is not None:
        progress["latestLearningRate"] = learning_rate
    if tokens_per_second is not None:
        progress["latestTokensPerSecond"] = tokens_per_second
    if peak_memory_gb is not None:
        progress["latestPeakMemoryGb"] = peak_memory_gb
    if trained_tokens is not None:
        progress["trainedTokens"] = trained_tokens
    patch = {
        "status": "running",
        "workerHeartbeatAt": iso_now(),
        "progress": progress,
    }
    if latest_message:
        patch["latestMessage"] = latest_message
    update_state(state_file, patch)


def run_bundle(job_bundle_path: Path) -> int:
    global CHILD_PROCESS

    with job_bundle_path.open("r", encoding="utf-8") as handle:
        bundle = json.load(handle)

    job_id = job_bundle_path.parent.name
    plan = bundle["plan"]
    state_file = Path(plan["stateFile"])
    log_file = Path(plan["logFile"])
    metrics_file = Path(plan["metricsFile"])
    total_steps = int(plan["totalSteps"])
    best_metric = str(plan.get("bestCheckpointMetric") or "eval_loss")
    load_best_at_end = bool(plan.get("loadBestCheckpointAtEnd", True))
    checkpoint_events: list[Dict[str, Any]] = []
    best_checkpoint: Optional[Dict[str, Any]] = None

    append_log(log_file, f"[{iso_now()}] Starting local fine-tune worker for {job_id}")
    update_state(
        state_file,
        {
            "status": "running",
            "startedAt": read_json(state_file, {}).get("startedAt") or iso_now(),
            "workerHeartbeatAt": iso_now(),
            "latestMessage": "Loading MLX LoRA trainer.",
            "errorMessage": None,
            "curve": read_json(state_file, {}).get("curve", []),
            "checkpointEvents": [],
            "bestCheckpoint": None,
        },
    )

    command = build_command(bundle)
    append_log(log_file, f"[{iso_now()}] Command: {' '.join(command)}")
    CHILD_PROCESS = subprocess.Popen(
        command,
        cwd=os.getcwd(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    update_state(
        state_file,
        {
            "launcherPid": os.getpid(),
            "workerHeartbeatAt": iso_now(),
            "latestMessage": "MLX trainer booted.",
        },
    )

    assert CHILD_PROCESS.stdout is not None
    for raw_line in CHILD_PROCESS.stdout:
        line = raw_line.rstrip("\n")
        append_log(log_file, line)
        update_state(state_file, {"workerHeartbeatAt": iso_now(), "latestMessage": line[-240:]})

        train_match = TRAIN_RE.search(line)
        if train_match:
            step = int(train_match.group("step"))
            point = {
                "step": step,
                "split": "train",
                "loss": float(train_match.group("loss")),
                "learningRate": float(train_match.group("lr")),
                "tokensPerSecond": float(train_match.group("tok_sec")),
                "peakMemoryGb": float(train_match.group("peak")),
                "trainedTokens": int(train_match.group("trained")),
                "durationSec": None,
                "at": iso_now(),
            }
            append_jsonl(metrics_file, point)
            append_curve_point(state_file, point)
            set_progress(
                state_file,
                step,
                total_steps,
                train_loss=point["loss"],
                learning_rate=point["learningRate"],
                tokens_per_second=point["tokensPerSecond"],
                peak_memory_gb=point["peakMemoryGb"],
                trained_tokens=point["trainedTokens"],
                latest_message=f"Step {step}/{total_steps}: train loss {point['loss']:.3f}",
            )
            continue

        val_match = VAL_RE.search(line)
        if val_match:
            step = int(val_match.group("step"))
            val_loss = float(val_match.group("loss"))
            point = {
                "step": step,
                "split": "valid",
                "loss": val_loss,
                "learningRate": None,
                "tokensPerSecond": None,
                "peakMemoryGb": None,
                "trainedTokens": None,
                "durationSec": float(val_match.group("duration")),
                "at": iso_now(),
            }
            append_jsonl(metrics_file, point)
            append_curve_point(state_file, point)
            set_progress(
                state_file,
                step,
                total_steps,
                val_loss=point["loss"],
                latest_message=f"Validation after step {step}: loss {point['loss']:.3f}",
            )
            if best_metric == "eval_loss" and (
                best_checkpoint is None
                or best_checkpoint.get("value") is None
                or val_loss < float(best_checkpoint["value"])
            ):
                best_checkpoint = {
                    "step": step,
                    "metric": "eval_loss",
                    "value": val_loss,
                    "path": None,
                    "source": "validation",
                    "loadBestCheckpointAtEnd": load_best_at_end,
                    "selectedAt": iso_now(),
                }
                best_checkpoint = attach_best_checkpoint_path(
                    best_checkpoint,
                    checkpoint_events,
                    plan,
                )
                update_checkpoint_state(state_file, checkpoint_events, best_checkpoint)
            continue

        save_match = SAVE_RE.search(line)
        if save_match:
            step = int(save_match.group("step"))
            checkpoint_path = materialize_checkpoint_dir(
                save_match.group("path"),
                step,
                plan,
            )
            event = {
                "step": step,
                "path": checkpoint_path,
                "metric": best_metric,
                "value": None,
                "at": iso_now(),
            }
            checkpoint_events.append(event)
            if best_checkpoint:
                if int(best_checkpoint.get("step") or 0) == step:
                    best_checkpoint = {**best_checkpoint, "path": checkpoint_path}
                best_checkpoint = attach_best_checkpoint_path(
                    best_checkpoint,
                    checkpoint_events,
                    plan,
                )
            update_checkpoint_state(state_file, checkpoint_events, best_checkpoint)
            set_progress(
                state_file,
                step,
                total_steps,
                latest_message=f"Saved adapter checkpoint at step {step}.",
            )
            continue

    exit_code = CHILD_PROCESS.wait()
    completed_at = iso_now()
    if CANCEL_REQUESTED:
        update_state(
            state_file,
            {
                "status": "cancelled",
                "completedAt": completed_at,
                "workerHeartbeatAt": completed_at,
                "latestMessage": "Fine-tune worker cancelled.",
            },
        )
        append_log(log_file, f"[{completed_at}] Worker cancelled")
        return 1

    if exit_code == 0:
        if best_checkpoint is None:
            latest_checkpoint = checkpoint_events[-1] if checkpoint_events else None
            best_checkpoint = {
                "step": int(latest_checkpoint.get("step")) if latest_checkpoint else total_steps,
                "metric": best_metric,
                "value": latest_checkpoint.get("value") if latest_checkpoint else None,
                "path": latest_checkpoint.get("path") if latest_checkpoint else str(plan.get("adapterPath") or plan.get("outputDir") or ""),
                "source": "final",
                "loadBestCheckpointAtEnd": load_best_at_end,
                "selectedAt": completed_at,
            }
        best_checkpoint = attach_best_checkpoint_path(
            best_checkpoint,
            checkpoint_events,
            plan,
        )
        update_state(
            state_file,
            {
                "status": "completed",
                "completedAt": completed_at,
                "workerHeartbeatAt": completed_at,
                "latestMessage": (
                    "Fine-tune worker completed successfully. "
                    f"Selected checkpoint step {best_checkpoint.get('step')} "
                    f"by {best_checkpoint.get('metric')}."
                ),
                "errorMessage": None,
                "checkpointEvents": checkpoint_events[-200:],
                "bestCheckpoint": best_checkpoint,
            },
        )
        append_log(log_file, f"[{completed_at}] Worker completed successfully")
        return 0

    update_state(
        state_file,
        {
            "status": "failed",
            "completedAt": completed_at,
            "workerHeartbeatAt": completed_at,
            "latestMessage": f"Fine-tune worker failed with exit code {exit_code}.",
            "errorMessage": f"Fine-tune worker failed with exit code {exit_code}.",
        },
    )
    append_log(log_file, f"[{completed_at}] Worker failed with exit code {exit_code}")
    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a local MLX fine-tune worker bundle.")
    parser.add_argument("--job-bundle", required=True, help="Path to the staged job-bundle.json file")
    args = parser.parse_args()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    return run_bundle(Path(args.job_bundle))


if __name__ == "__main__":
    raise SystemExit(main())
