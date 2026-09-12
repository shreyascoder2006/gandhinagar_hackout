from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas
from .. import seed as seed_data
from ..db import models as db
from ..deps import get_db
from ..engine import emissions, intensity, units
from ..intelligence import recommender

router = APIRouter(prefix="/api/factories", tags=["onboarding"])


@router.post("", response_model=schemas.OnboardFactoryOut, status_code=201)
def onboard_factory(payload: schemas.OnboardFactoryIn, session: Session = Depends(get_db)):
    """Real onboarding: a real factory's own submitted activity data runs
    through the exact same engine (units.normalise -> emissions.co2e_for) and
    recommender used for the 120 seeded factories. There is no separate
    "demo path" vs "real path" — same functions, same code.

    Anomaly detection is honestly reported as not_available: it needs a
    multi-month time series to establish a baseline, which a freshly-onboarded
    factory does not have yet (and even with one, app/intelligence/anomaly.py
    currently only ever runs against the precomputed seed table, not a live
    feature pipeline — see data-pipeline roadmap / Induscope vision doc §04).
    Returning a fabricated "no anomalies detected" would look like a clean
    bill of health that was never actually checked — the opposite of what
    this project is for.
    """
    cluster = session.get(db.Cluster, payload.cluster_id)
    if cluster is None:
        raise HTTPException(400, f"unknown cluster_id '{payload.cluster_id}'")

    factory_id = f"onboarded-{uuid.uuid4().hex[:10]}"
    factory = db.Factory(
        id=factory_id, name=payload.name, cluster_id=payload.cluster_id, sector=payload.sector,
        district=cluster.district, lat=cluster.lat, lon=cluster.lon, data_source="self_reported",
        consent_to_share=False, output_tonnes_per_year=payload.output_tonnes_total,
    )
    session.add(factory)

    all_recommendations: list[schemas.RecommendationOut] = []
    total_co2e = 0.0
    ef_table = seed_data.emission_factors()

    for proc in payload.processes:
        equip_id = f"{factory_id}:{proc.process_id}"
        equip = db.Equipment(
            id=equip_id, factory_id=factory_id, process_id=proc.process_id, label=proc.label,
            kind=proc.kind, share_of_energy=proc.share_of_energy, benchmark_kgco2e_per_t=0.0,
            benchmark_source="not applicable — onboarded factory has no assigned sub-sector template yet",
            benchmark_confidence="n/a",
        )
        session.add(equip)

        equip_co2e = 0.0
        for act in proc.activities:
            if act.fuel_key not in ef_table:
                raise HTTPException(422, f"unknown fuel_key '{act.fuel_key}'. Accepted: {list(ef_table)}")
            activity = m.Activity(fuel=act.fuel_key, unit=act.unit, quantity=act.quantity)
            normalised, issue = units.normalise(activity)
            if issue is not None:
                raise HTTPException(422, issue.message)
            co2e_t = emissions.co2e_for(normalised)
            session.add(db.EnergyRecord(
                equipment_id=equip_id, month=act.month, fuel_key=act.fuel_key,
                quantity=act.quantity, canonical_unit=normalised.canonical_unit,
            ))
            session.add(db.EmissionRecord(
                equipment_id=equip_id, month=act.month, fuel_key=act.fuel_key, co2e_t=co2e_t,
                emission_factor_kgco2e_per_unit=normalised.kgco2e_per_unit, emission_factor_source=normalised.source,
            ))
            equip_co2e += co2e_t

        equip.co2e_tpy = round(equip_co2e, 2)
        equipment_output_tpy = payload.output_tonnes_total * proc.share_of_energy
        equip.actual_intensity = intensity.intensity_kg_per_t(equip_co2e, equipment_output_tpy)
        total_co2e += equip_co2e

        node = m.ProcessNode(
            id=equip_id, label=equip.label, kind=equip.kind, co2eTpy=equip_co2e, shareOfTotal=0.0,
            actualIntensity=equip.actual_intensity, benchmarkIntensity=equip.actual_intensity or 1.0,
            severity="ok",
        )
        for iv in recommender.interventions_for(node, payload.sector):
            # see app/db/seed_loader.py for why this can't be a plain split(":", 1)
            key = iv.id[len(equip_id) + 1:]
            rec = db.Recommendation(
                id=f"{equip_id}:{key}", equipment_id=equip_id, intervention_key=key, title=iv.title,
                category=iv.category, capex_inr=iv.capexInr, annual_saving_inr=iv.annualSavingInr,
                co2_reduction_tpy=iv.co2ReductionTpy, payback_months=iv.paybackMonths,
                confidence=iv.confidence, description=iv.description,
                circularity_gain_pct=iv.circularityGainPct, rank=len(all_recommendations),
            )
            session.add(rec)
            all_recommendations.append(schemas.RecommendationOut.model_validate(rec))

    session.commit()

    return schemas.OnboardFactoryOut(
        id=factory_id, name=payload.name, total_co2e_t=round(total_co2e, 2),
        anomaly_check_status="not_available", recommendations=all_recommendations,
    )
