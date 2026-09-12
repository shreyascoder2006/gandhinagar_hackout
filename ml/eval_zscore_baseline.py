"""Standalone evaluation of the PRODUCTION z-score anomaly rule
(backend/app/intelligence/anomaly.py) against the real ground-truth labels.

This is the harness `data-pipeline/LIMITATIONS.md` #7 and `ml/anomaly_model.py`
both describe using ad-hoc, one-off — extracted here as a real, reusable,
re-runnable check so `scripts/validate_all.py` can call it and refuse to ship
a change that regresses the ONE anomaly detector actually in production.

Deliberately evaluates backend/app/intelligence/anomaly.py directly (the real
production code), not a reimplementation — a regression in the real function
is what this is meant to catch.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.intelligence.anomaly import detect_anomalies  # noqa: E402
from .data import load_monthly_series_frame, load_anomaly_ground_truth  # noqa: E402


def evaluate() -> dict:
    df = load_monthly_series_frame()
    ground_truth = load_anomaly_ground_truth()

    tp = fp = fn = 0
    for _, row in df.iterrows():
        series = list(zip(row["months"], row["series"]))
        points = detect_anomalies(series)  # uses anomaly.py's own current defaults — that's the point
        for p in points:
            key = (row["equipment_id"], p.month)
            is_true = key in ground_truth
            if p.anomaly and is_true:
                tp += 1
            elif p.anomaly and not is_true:
                fp += 1
            elif not p.anomaly and is_true:
                fn += 1

    precision = round(tp / (tp + fp), 3) if (tp + fp) else 0.0
    recall = round(tp / (tp + fn), 3) if (tp + fn) else 0.0
    return {
        "tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall,
        "n_ground_truth_labels": len(ground_truth),
    }


if __name__ == "__main__":
    result = evaluate()
    print(json.dumps(result, indent=2))
