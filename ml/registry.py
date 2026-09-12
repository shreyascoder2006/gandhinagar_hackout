"""ModelRegistry — Phase 3, closing item.

A single, lazy-loading access point for the four ML/rule components built in
Phase 3, so the API (or anything else) never has to know how each one is
stored or reload an expensive model on every request. Deliberately thin:
it does not reimplement any scoring logic, it just loads artifacts once,
caches them, and exposes one calling convention per component —
`ml/benchmark_model.py`, `ml/anomaly_model.py`, `ml/symbiosis_model.py`, and
`ml/explainer.py` remain the actual implementations and stay independently
runnable/testable.

`status()` is the important method to read first: it reports what's ACTUALLY
active for each component, not what exists on disk — the anomaly autoencoder
is loadable here (for research/comparison) but is explicitly reported as
NOT the active detector, matching the real decision made in Phase 3b.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from threading import Lock

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from .benchmark_model import CATEGORICAL_COLUMNS, FEATURE_COLUMNS  # noqa: E402


class ModelRegistry:
    """Process-wide singleton — use `registry` at the bottom of this module,
    not this class directly, so every caller shares the same loaded models."""

    def __init__(self):
        self._lock = Lock()
        self._benchmark_booster = None
        self._benchmark_metrics: dict | None = None
        self._anomaly_metrics: dict | None = None
        self._symbiosis_report: dict | None = None
        self._symbiosis_embedder = None

    # --- Phase 3a: benchmark predictor ----------------------------------

    def _load_benchmark(self) -> None:
        import lightgbm as lgb
        with self._lock:
            if self._benchmark_booster is None:
                self._benchmark_booster = lgb.Booster(model_file=str(ARTIFACTS_DIR / "benchmark_model.txt"))
                self._benchmark_metrics = json.loads((ARTIFACTS_DIR / "benchmark_metrics.json").read_text(encoding="utf-8"))

    def predict_benchmark_ratio(
        self, sector: str, process_kind: str, share_of_energy: float, output_tonnes_per_year: float,
        fuel_shares: dict[str, float],
    ) -> dict:
        """Returns {"predicted_ratio": ..., "confidence_note": ...} — the
        ratio to multiply the process's own sourced benchmark_kgco2e_per_t
        by. See ml/benchmark_model.py and ml/LIMITATIONS.md #9 for what this
        model does and does not do well (strong for known clusters, weak for
        brand-new ones)."""
        self._load_benchmark()
        row = pd.DataFrame([{
            "sector": sector, "process_kind": process_kind, "share_of_energy": share_of_energy,
            "output_tonnes_per_year": output_tonnes_per_year,
            "share_grid_electricity": fuel_shares.get("grid_electricity", 0.0),
            "share_natural_gas": fuel_shares.get("natural_gas", 0.0),
            "share_coal": fuel_shares.get("coal", 0.0),
            "share_pet_coke": fuel_shares.get("pet_coke", 0.0),
            "share_biomass": fuel_shares.get("biomass", 0.0),
        }])[FEATURE_COLUMNS]
        for col in CATEGORICAL_COLUMNS:
            row[col] = row[col].astype("category")
        predicted_ratio = float(self._benchmark_booster.predict(row)[0])
        return {
            "predicted_ratio": round(predicted_ratio, 3),
            "model_version": "lightgbm_v1",
            "note": self._benchmark_metrics["recommended_use"],
        }

    # --- Phase 3b: anomaly autoencoder (built, NOT the active detector) --

    def anomaly_detector_status(self) -> dict:
        """The honest answer to 'which anomaly detector is live'. Always
        z-score — see ml/LIMITATIONS.md for why the ML alternative lost."""
        metrics_path = ARTIFACTS_DIR / "anomaly_metrics.json"
        if self._anomaly_metrics is None and metrics_path.exists():
            self._anomaly_metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        return {
            "active_detector": "zscore_rule",
            "active_detector_location": "backend/app/intelligence/anomaly.py",
            "ml_autoencoder_status": "built_and_evaluated_not_deployed",
            "ml_autoencoder_verdict": (self._anomaly_metrics or {}).get("verdict"),
            "reason": "ml/LIMITATIONS.md — autoencoder does not beat the z-score rule on this dataset",
        }

    def load_anomaly_autoencoder(self):
        """Loads the PyTorch autoencoder for research/comparison only — this
        is NOT called by any production code path. See anomaly_detector_status()."""
        import torch
        from .anomaly_model import ConditionalAutoencoder

        model = ConditionalAutoencoder()
        model.load_state_dict(torch.load(ARTIFACTS_DIR / "anomaly_autoencoder.pt"))
        model.eval()
        return model

    # --- Phase 3c: symbiosis matcher -------------------------------------

    def symbiosis_embedder(self):
        """Lazy-loaded MiniLM model, shared across calls — loading it is the
        expensive part (~100MB download+init on first use)."""
        with self._lock:
            if self._symbiosis_embedder is None:
                from sentence_transformers import SentenceTransformer
                self._symbiosis_embedder = SentenceTransformer("all-MiniLM-L6-v2")
        return self._symbiosis_embedder

    def recompute_symbiosis_matches(self) -> dict:
        """Re-runs the full matcher and rewrites the symbiosis_matches table.
        Expensive (loads MiniLM, embeds every stream/input) — call this from
        a seed/admin script, not per-request. See ml/symbiosis_model.py."""
        from . import symbiosis_model
        symbiosis_model.main()
        report_path = ARTIFACTS_DIR / "symbiosis_report.json"
        return json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}

    def symbiosis_status(self) -> dict:
        report_path = ARTIFACTS_DIR / "symbiosis_report.json"
        if self._symbiosis_report is None and report_path.exists():
            self._symbiosis_report = json.loads(report_path.read_text(encoding="utf-8"))
        report = self._symbiosis_report or {}
        return {
            "n_matches": report.get("n_matches"),
            "min_semantic_similarity": report.get("config", {}).get("min_semantic_similarity"),
            "co2_avoided_is_placeholder": True,
        }

    # --- Phase 3d: explainer ---------------------------------------------

    def ask(self, question: str, factory_id: str) -> dict:
        """Delegates to ml/explainer.py's tool-calling agent (or its
        deterministic fallback). See that module for the verified_data
        guardrail against LLM number-restatement errors."""
        from . import explainer
        return explainer.ask(question, factory_id)

    def explainer_status(self) -> dict:
        import requests
        from . import explainer

        try:
            resp = requests.get("http://localhost:11434/api/tags", timeout=2)
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            ollama_available = explainer.OLLAMA_MODEL in models
        except requests.RequestException:
            ollama_available = False
        return {
            "ollama_reachable": ollama_available,
            "model": explainer.OLLAMA_MODEL,
            "fallback": "deterministic_fallback (same real tool calls, templated phrasing)",
        }

    # --- Overall status ----------------------------------------------------

    def status(self) -> dict:
        """What's actually active, not just what's on disk. Read this before
        assuming any ML component is in the live request path."""
        try:
            self._load_benchmark()
            benchmark_status = {
                "loaded": True,
                "random_kfold_improvement_pct": self._benchmark_metrics["random_kfold"]["improvement_vs_flat_benchmark_pct"],
                "leave_one_cluster_out_improvement_pct": self._benchmark_metrics["leave_one_cluster_out"]["improvement_vs_flat_benchmark_pct"],
            }
        except FileNotFoundError:
            benchmark_status = {"loaded": False, "reason": "run: python -m ml.benchmark_model"}

        return {
            "benchmark_predictor": benchmark_status,
            "anomaly_detector": self.anomaly_detector_status(),
            "symbiosis_matcher": self.symbiosis_status(),
            "explainer": self.explainer_status(),
        }


registry = ModelRegistry()


if __name__ == "__main__":
    print(json.dumps(registry.status(), indent=2))
