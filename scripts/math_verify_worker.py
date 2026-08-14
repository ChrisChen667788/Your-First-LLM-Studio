#!/usr/bin/env python3
"""JSONL worker for the pinned Hugging Face Math-Verify MATH-500 metric."""

import json
import re
import sys
from importlib.metadata import version

from math_verify.metric import math_metric
from math_verify.parser import ExprExtractionConfig, LatexExtractionConfig


EVALUATOR_ID = "huggingface-math-verify"
EXPECTED_VERSION = "0.9.0"
CONFIG_ID = "math-500-v1"
INSTALLED_VERSION = version("math-verify")

VERIFY_METRIC = math_metric(
    gold_extraction_target=(LatexExtractionConfig(boxed_match_priority=0),),
    pred_extraction_target=(LatexExtractionConfig(), ExprExtractionConfig()),
)


def serialize_extracted(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value if item is not None]
    return [str(value)]


def evaluate(payload):
    request_id = str(payload.get("requestId", ""))
    if INSTALLED_VERSION != EXPECTED_VERSION:
        return {
            "requestId": request_id,
            "ok": False,
            "error": (
                f"Expected math-verify {EXPECTED_VERSION}, found {INSTALLED_VERSION}."
            ),
        }

    gold = str(payload.get("gold", ""))
    prediction = str(payload.get("prediction", ""))
    if not gold.strip():
        return {
            "requestId": request_id,
            "ok": False,
            "error": "Gold answer is empty.",
        }

    try:
        # MATH-500 stores a bare LaTeX answer. The pinned gold extractor expects
        # a LaTeX environment, so normalize it into the highest-priority boxed form.
        has_math_delimiter = re.search(r"(?<!\\)\$", gold) is not None
        normalized_gold = (
            gold
            if "\\boxed{" in gold or has_math_delimiter
            else "\\boxed{" + gold + "}"
        )
        grade, extracted = VERIFY_METRIC([normalized_gold], [prediction])
        extracted_gold = extracted[0] if extracted and len(extracted) > 0 else None
        extracted_prediction = (
            extracted[1] if extracted and len(extracted) > 1 else None
        )
        passed = grade == 1
        return {
            "requestId": request_id,
            "ok": True,
            "score": 100 if passed else 0,
            "passed": passed,
            "evaluatorId": EVALUATOR_ID,
            "evaluatorVersion": INSTALLED_VERSION,
            "configId": CONFIG_ID,
            "extractedGold": serialize_extracted(extracted_gold),
            "extractedPrediction": serialize_extracted(extracted_prediction),
        }
    except Exception as error:  # The worker must fail one sample, not the run.
        return {
            "requestId": request_id,
            "ok": False,
            "error": f"{type(error).__name__}: {error}",
        }


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def main():
    if "--health" in sys.argv:
        emit(
            {
                "ok": INSTALLED_VERSION == EXPECTED_VERSION,
                "evaluatorId": EVALUATOR_ID,
                "evaluatorVersion": INSTALLED_VERSION,
                "configId": CONFIG_ID,
            }
        )
        return

    for raw_line in sys.stdin:
        try:
            payload = json.loads(raw_line)
            emit(evaluate(payload))
        except Exception as error:
            emit(
                {
                    "requestId": "",
                    "ok": False,
                    "error": f"{type(error).__name__}: {error}",
                }
            )


if __name__ == "__main__":
    main()
