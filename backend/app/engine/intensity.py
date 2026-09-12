"""Per-tonne intensities, circularity ratio, severity banding."""
from __future__ import annotations

from ..models import Severity


def intensity_kg_per_t(co2e_tpy: float, output_tpy: float) -> float:
    return round(co2e_tpy * 1000.0 / output_tpy) if output_tpy > 0 else 0.0


def circularity_ratio(recovered_tpy: float, waste_tpy: float) -> float:
    return round(min(0.95, recovered_tpy / waste_tpy), 2) if waste_tpy > 0 else 0.0


def severity_from_ratio(ratio: float) -> Severity:
    d = ratio - 1.0
    if d < 0.10:
        return "ok"
    if d < 0.30:
        return "warn"
    return "crit"
