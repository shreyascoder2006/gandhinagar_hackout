"""Unit normalisation: every activity → the emission factor's canonical unit."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..models import Activity, Issue
from ..seed import emission_factors


@dataclass
class Normalised:
    activity: Activity
    canonical_qty: float
    canonical_unit: str
    kgco2e_per_unit: float
    gj_per_unit: float
    source: str


def normalise(a: Activity, row: int = 0) -> tuple[Optional[Normalised], Optional[Issue]]:
    ef = emission_factors().get(a.fuel)
    if ef is None:
        return None, Issue(row=row, level="error", message=f'Unknown fuel/energy key "{a.fuel}". Accepted: {", ".join(emission_factors())}')
    mult = ef["units"].get(a.unit)
    if mult is None:
        return None, Issue(row=row, level="error", message=f'Unit "{a.unit}" not valid for {ef["label"]}. Accepted: {", ".join(ef["units"])}')
    if a.quantity is None or a.quantity < 0:
        return None, Issue(row=row, level="error", message=f'Quantity must be non-negative (got {a.quantity!r})')
    return Normalised(a, a.quantity * mult, ef["canonicalUnit"], ef["kgco2ePerUnit"], ef["gjPerUnit"], ef["source"]), None
