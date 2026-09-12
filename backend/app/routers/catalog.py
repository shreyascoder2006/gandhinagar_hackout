from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import models as db
from ..deps import get_db

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/interventions", response_model=list[schemas.InterventionOut])
def list_interventions(session: Session = Depends(get_db)):
    return session.scalars(select(db.Intervention)).all()


@router.get("/emission-factors", response_model=list[schemas.EmissionFactorOut])
def list_emission_factors(session: Session = Depends(get_db)):
    return session.scalars(select(db.EmissionFactor)).all()


@router.get("/symbiosis/network", response_model=list[dict])
def symbiosis_network(session: Session = Depends(get_db)):
    """Phase 3 (MiniLM + FAISS symbiosis matcher) is not built yet — see
    backend/app/db/models.py SymbiosisMatch docstring. Empty on purpose."""
    return []


@router.get("/scale-projection", response_model=schemas.ScaleProjectionOut)
def scale_projection(factory_count: int = 5000, session: Session = Depends(get_db)):
    """'What if this scaled to N factories' projection.

    Method (printed verbatim in the response, not summarised): take the mean
    total CO2e/yr and mean recommended-avoidable CO2e/yr across the 120 seeded
    factories actually in the database, and scale linearly by factory_count.
    This is a linear extrapolation from the calibrated synthetic sample, not a
    forecast grounded in a real Gujarat-wide industrial census (that data does
    not exist — see data-pipeline/LIMITATIONS.md #1) — every number the
    frontend shows for this endpoint must carry that caveat, not hide it.
    """
    factories = session.scalars(select(db.Factory)).all()
    n = len(factories) or 1

    total_co2e = 0.0
    total_avoidable = 0.0
    for f in factories:
        equipment_ids = [e.id for e in f.equipment]
        total_co2e += sum(e.co2e_tpy or 0.0 for e in f.equipment)
        if equipment_ids:
            avoidable = session.scalar(
                select(func.coalesce(func.sum(db.Recommendation.co2_reduction_tpy), 0.0))
                .where(db.Recommendation.equipment_id.in_(equipment_ids))
            ) or 0.0
            total_avoidable += avoidable

    avg_co2e = total_co2e / n
    avg_avoidable = total_avoidable / n
    scale = factory_count / n

    methodology = (
        f"projected_total = mean(factory total_co2e_tpy across {n} seeded factories) x "
        f"factory_count; projected_avoidable = mean(sum of that factory's recommended "
        f"co2_reduction_tpy across {n} seeded factories) x factory_count. Linear "
        f"extrapolation from a calibrated synthetic sample, not a Gujarat-wide census "
        f"(none exists — see data-pipeline/LIMITATIONS.md #1). "
        f"sample_avg_co2e_tpy={avg_co2e:.1f}, sample_avg_avoidable_co2e_tpy={avg_avoidable:.1f}, "
        f"scale_factor={scale:.2f}."
    )

    return schemas.ScaleProjectionOut(
        factory_count=factory_count,
        projected_total_co2e_tpy=round(avg_co2e * factory_count, 1),
        projected_avoidable_co2e_tpy=round(avg_avoidable * factory_count, 1),
        sample_factory_count=n,
        sample_avg_co2e_tpy=round(avg_co2e, 1),
        sample_avg_avoidable_co2e_tpy=round(avg_avoidable, 1),
        methodology=methodology,
    )
