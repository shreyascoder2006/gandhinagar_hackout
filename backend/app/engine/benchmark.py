"""Sub-sector benchmark lookup (ASI / BEE PAT calibrated templates)."""
from __future__ import annotations

from ..seed import sector_templates


def benchmark_for(sector: str, process_id: str) -> dict | None:
    for t in sector_templates().get(sector, []):
        if t["id"] == process_id:
            return t
    return None
