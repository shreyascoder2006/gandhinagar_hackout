"""z-score control limits on a monthly series (statistical inference, never presented as fact)."""
from __future__ import annotations

from statistics import mean, pstdev

from ..models import MonthlyPoint


def detect_anomalies(series: list[tuple[str, float]], z_limit: float = 2.5, rel_guard: float = 0.15) -> list[MonthlyPoint]:
    """Leave-one-out z against the other months AND a relative practical-significance guard.

    Defaults were empirically measured, not guessed: on the 120-factory synthetic
    dataset (600 processes x 12 months, 26 ground-truth injected anomalies), the
    originally-scoped (2.0, 0.08) defaults gave precision 0.04 / recall 1.00 —
    575 false positives against 26 real ones, an 8%+ false-positive rate across
    the whole dataset. With only 12 monthly samples, leave-one-out z-scores are
    inherently noisy (small-sample variance estimate), so a flat z>2 threshold
    flags routine month-to-month variation constantly — precisely the "false
    positives from normal behaviour" failure mode this project exists to avoid
    (see CLAUDE.md). (2.5, 0.15) measured at precision 0.57 / recall 0.92 on the
    same dataset — 24/26 real anomalies caught, false positives cut from 575 to
    18. See data-pipeline/LIMITATIONS.md #8 for the full sweep and the case for
    Phase 3's autoencoder (which can learn a factory's own seasonal shape
    instead of a single flat z-threshold) as the long-term fix.
    """
    if len(series) < 4:
        return [MonthlyPoint(month=m, co2eT=v, z=0.0, anomaly=False) for m, v in series]
    out = []
    for i, (m, v) in enumerate(series):
        others = [x for j, (_, x) in enumerate(series) if j != i]
        mu = mean(others)
        sd = pstdev(others) or 1e-9
        z = (v - mu) / sd
        rel = abs(v - mu) / mu if mu > 0 else 0.0
        out.append(MonthlyPoint(month=m, co2eT=round(v), z=round(z, 2), anomaly=abs(z) > z_limit and rel >= rel_guard))
    return out
