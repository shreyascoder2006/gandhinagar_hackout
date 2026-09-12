"""Hotspot ranking: share of site CO₂e + benchmark severity band."""
from __future__ import annotations

from ..models import Factory, ProcessNode


def rank_hotspots(f: Factory) -> list[dict]:
    order = sorted(f.nodes, key=lambda n: n.co2eTpy, reverse=True)
    out = []
    for i, n in enumerate(order, 1):
        dev = (n.actualIntensity - n.benchmarkIntensity) / n.benchmarkIntensity * 100 if n.benchmarkIntensity else 0
        out.append({
            "rank": i,
            "processId": n.id,
            "label": n.label,
            "co2eTpy": n.co2eTpy,
            "shareOfTotal": round(n.shareOfTotal, 3),
            "deviationPct": round(dev),
            "severity": n.severity,
            "why": f"{round(n.shareOfTotal * 100)}% of site CO₂e, {dev:+.0f}% vs sub-sector benchmark",
        })
    return out
