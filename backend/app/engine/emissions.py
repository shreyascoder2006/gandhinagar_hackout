"""tCO₂e = canonical quantity × kgCO₂e/unit ÷ 1000. Nothing else."""
from __future__ import annotations

from .units import Normalised


def co2e_for(n: Normalised) -> float:
    return n.canonical_qty * n.kgco2e_per_unit / 1000.0


def gj_for(n: Normalised) -> float:
    return n.canonical_qty * n.gj_per_unit
