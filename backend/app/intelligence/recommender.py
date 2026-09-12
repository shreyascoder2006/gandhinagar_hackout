"""Circular recommender: a lookup against the curated library, ranked by tCO₂e per ₹ lakh."""
from __future__ import annotations

from ..models import Intervention, ProcessNode
from ..seed import intervention_library


def interventions_for(node: ProcessNode, sector: str) -> list[Intervention]:
    size = max(0.35, min(2.5, node.co2eTpy / 2000.0))
    out: list[Intervention] = []
    for e in intervention_library():
        if node.kind not in e["appliesTo"]:
            continue
        if e.get("sectors") and sector not in e["sectors"]:
            continue
        co2 = round(node.co2eTpy * e["reductionPct"])
        capex = round(e["capexBaseInr"] * size)
        saving = round(co2 * e["savingInrPerTco2"])
        out.append(Intervention(
            id=f'{node.id}:{e["key"]}', title=e["title"], category=e["category"], capexInr=capex,
            annualSavingInr=saving, co2ReductionTpy=co2,
            paybackMonths=max(1, round(capex / saving * 12)) if saving > 0 else 999,
            confidence=e["confidence"], description=e["description"], circularityGainPct=e.get("circularityGainPct"),
        ))
    # rank: tCO₂e per ₹ lakh CAPEX, tie-break payback
    out.sort(key=lambda iv: (-(iv.co2ReductionTpy / max(iv.capexInr / 100000, 0.1)), iv.paybackMonths))
    return out
