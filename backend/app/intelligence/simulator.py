"""What-if simulator + combination optimizer — ports src/lib/simulator.ts to
Python so the backend (and the Phase 3d explainer) can answer "what if I
applied these interventions" and "which combination is best" using the same
math the frontend simulator already uses, over real recommendation data from
the database — not a separate, potentially-diverging reimplementation.

Sequential-residual rule (unchanged from the frontend): interventions on the
same equipment apply to what's LEFT after the previous one, so two 20%
measures give 36% combined, not 40%. See src/lib/simulator.ts for the
original.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field


@dataclass
class RecommendationData:
    id: str
    equipment_id: str
    title: str
    capex_inr: float
    annual_saving_inr: float
    co2_reduction_tpy: float
    payback_months: int
    confidence: str  # high | medium | low


@dataclass
class EquipmentData:
    id: str
    label: str
    co2e_tpy: float
    recommendations: list[RecommendationData] = field(default_factory=list)


_CONF_RANK = {"high": 3, "medium": 2, "low": 1}


@dataclass
class SimulationResult:
    selected_ids: list[str]
    total_co2e_before: float
    total_co2e_after: float
    co2_reduction_tpy: float
    capex_inr: float
    annual_saving_inr: float
    blended_payback_months: float | None
    confidence: str  # weakest confidence among selected interventions
    per_equipment: list[dict]


def simulate(equipment_list: list[EquipmentData], selected_ids: set[str]) -> SimulationResult:
    total_before = sum(e.co2e_tpy for e in equipment_list)
    if not selected_ids:
        return SimulationResult(
            selected_ids=[], total_co2e_before=total_before, total_co2e_after=total_before,
            co2_reduction_tpy=0.0, capex_inr=0.0, annual_saving_inr=0.0,
            blended_payback_months=None, confidence="high", per_equipment=[],
        )

    capex = 0.0
    saving = 0.0
    worst_confidence = "high"
    per_equipment = []
    total_after = 0.0

    for equipment in equipment_list:
        chosen = [r for r in equipment.recommendations if r.id in selected_ids]
        if not chosen:
            total_after += equipment.co2e_tpy
            continue

        residual = 1.0
        for r in chosen:
            capex += r.capex_inr
            saving += r.annual_saving_inr * residual
            frac = min(0.95, r.co2_reduction_tpy / equipment.co2e_tpy) if equipment.co2e_tpy > 0 else 0.0
            residual *= (1 - frac)
            if _CONF_RANK[r.confidence] < _CONF_RANK[worst_confidence]:
                worst_confidence = r.confidence

        new_co2e = equipment.co2e_tpy * residual
        total_after += new_co2e
        per_equipment.append({
            "equipment_id": equipment.id, "label": equipment.label,
            "co2e_before": round(equipment.co2e_tpy, 1), "co2e_after": round(new_co2e, 1),
            "applied": [r.id for r in chosen],
        })

    return SimulationResult(
        selected_ids=sorted(selected_ids),
        total_co2e_before=round(total_before, 1),
        total_co2e_after=round(total_after, 1),
        co2_reduction_tpy=round(total_before - total_after, 1),
        capex_inr=round(capex, 0),
        annual_saving_inr=round(saving, 0),
        blended_payback_months=round(capex / saving * 12, 1) if saving > 0 else None,
        confidence=worst_confidence,
        per_equipment=per_equipment,
    )


def optimize(
    equipment_list: list[EquipmentData],
    objective: str = "max_co2_reduction",
    budget_inr: float | None = None,
    max_payback_months: float | None = None,
    max_recommendations: int = 20,
) -> dict:
    """Brute-force the best combination of recommendations under the given
    constraints. Exhaustive, not a heuristic: with at most ~20 recommendations
    per factory (5 equipment x up to ~4 each), 2^20 subsets is a few seconds
    of Python at worst — small enough to guarantee a truly optimal answer
    rather than a greedy approximation, which matters when the explainer
    tells a user "this is the best strategy."

    objective: "max_co2_reduction" | "max_roi" (co2 reduction per rupee of CAPEX)
    """
    all_recs = [r for e in equipment_list for r in e.recommendations]
    if len(all_recs) > max_recommendations:
        raise ValueError(
            f"{len(all_recs)} recommendations exceeds max_recommendations={max_recommendations}; "
            "brute force would be too slow — use a heuristic for factories this large."
        )

    best_result: SimulationResult | None = None
    best_score = float("-inf")

    for r in range(0, len(all_recs) + 1):
        for combo in itertools.combinations(all_recs, r):
            ids = {rec.id for rec in combo}
            result = simulate(equipment_list, ids)

            if budget_inr is not None and result.capex_inr > budget_inr:
                continue
            if max_payback_months is not None and result.blended_payback_months is not None \
                    and result.blended_payback_months > max_payback_months:
                continue

            if objective == "max_roi":
                score = result.co2_reduction_tpy / max(result.capex_inr, 1.0)
            else:
                score = result.co2_reduction_tpy

            if score > best_score:
                best_score = score
                best_result = result

    if best_result is None:
        # nothing satisfied the constraints — the empty selection is the honest answer
        best_result = simulate(equipment_list, set())

    return {
        "objective": objective,
        "constraints": {"budget_inr": budget_inr, "max_payback_months": max_payback_months},
        "best_selection": best_result,
        "n_combinations_evaluated": 2 ** len(all_recs),
    }
