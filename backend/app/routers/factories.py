from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..db import models as db
from ..deps import get_db

router = APIRouter(prefix="/api/factories", tags=["factories"])


def _get_factory_or_404(session: Session, factory_id: str) -> db.Factory:
    factory = session.get(db.Factory, factory_id)
    if factory is None:
        raise HTTPException(404, f"factory '{factory_id}' not found")
    return factory


def _to_full_out(session: Session, factory: db.Factory) -> schemas.FactoryFullOut:
    total = sum(e.co2e_tpy or 0.0 for e in factory.equipment)
    equipment = [
        schemas.EquipmentFullOut(
            id=e.id, process_id=e.process_id, label=e.label, kind=e.kind,
            share_of_energy=e.share_of_energy, benchmark_kgco2e_per_t=e.benchmark_kgco2e_per_t,
            benchmark_source=e.benchmark_source, benchmark_confidence=e.benchmark_confidence,
            co2e_tpy=e.co2e_tpy, share_of_total=e.share_of_total, actual_intensity=e.actual_intensity,
            severity=e.severity, root_cause_text=e.root_cause_text,
            recommendations=e.recommendations,
        )
        for e in factory.equipment
    ]

    equipment_ids = [e.id for e in factory.equipment]
    total_gj = 0.0
    if equipment_ids:
        rows = session.execute(
            select(db.EnergyRecord.quantity, db.EmissionFactor.gj_per_unit)
            .join(db.EmissionFactor, db.EnergyRecord.fuel_key == db.EmissionFactor.key)
            .where(db.EnergyRecord.equipment_id.in_(equipment_ids))
        ).all()
        total_gj = sum(qty * gj for qty, gj in rows)
    total_energy_mwh = total_gj / 3.6  # 1 MWh = 3.6 GJ

    total_waste = session.scalar(
        select(func.coalesce(func.sum(db.WasteRecord.hazardous_waste_t + db.WasteRecord.general_process_waste_t), 0.0))
        .where(db.WasteRecord.factory_id == factory.id)
    ) or 0.0

    # No recovered-material tracking exists in this dataset yet (Phase 1/2 built
    # emissions, not a symbiosis/recovery ledger) — 0.0 is the honest value for
    # every factory until Phase 3's symbiosis matcher and an "implemented
    # interventions" ledger exist, not a placeholder guess like the old mock data.
    circularity_ratio = 0.0

    return schemas.FactoryFullOut(
        id=factory.id, name=factory.name, cluster_id=factory.cluster_id, sector=factory.sector,
        district=factory.district, lat=factory.lat, lon=factory.lon, data_source=factory.data_source,
        consent_to_share=factory.consent_to_share, output_tonnes_per_year=factory.output_tonnes_per_year,
        total_co2e_tpy=round(total, 2), total_energy_mwh_per_year=round(total_energy_mwh, 1),
        total_waste_tpy=round(total_waste, 2), circularity_ratio=circularity_ratio,
        equipment=equipment,
    )


@router.get("", response_model=list[schemas.FactoryFullOut])
def list_factories(session: Session = Depends(get_db)):
    """Bulk listing — every factory with its full equipment + recommendations
    nested, in one request. Small dataset (~120 factories) by design; see
    docstring on schemas.FactoryFullOut for why this shape exists."""
    factories = session.scalars(select(db.Factory)).all()
    return [_to_full_out(session, f) for f in factories]


@router.get("/{factory_id}", response_model=schemas.FactoryFullOut)
def get_factory(factory_id: str, session: Session = Depends(get_db)):
    factory = _get_factory_or_404(session, factory_id)
    return _to_full_out(session, factory)


@router.get("/{factory_id}/equipment", response_model=list[schemas.EquipmentOut])
def get_equipment(factory_id: str, session: Session = Depends(get_db)):
    factory = _get_factory_or_404(session, factory_id)
    return factory.equipment


@router.get("/{factory_id}/emissions", response_model=list[schemas.EmissionMonthOut])
def get_emissions(factory_id: str, session: Session = Depends(get_db)):
    """Monthly CO2e with the formula, factor, and source shown per record —
    every row here was computed by app/engine/emissions.co2e_for, not looked up."""
    factory = _get_factory_or_404(session, factory_id)
    equipment_ids = [e.id for e in factory.equipment]
    if not equipment_ids:
        return []
    records = session.scalars(
        select(db.EmissionRecord).where(db.EmissionRecord.equipment_id.in_(equipment_ids)).order_by(db.EmissionRecord.month)
    ).all()
    return [
        schemas.EmissionMonthOut(
            month=r.month, fuel_key=r.fuel_key, co2e_t=r.co2e_t,
            emission_factor_kgco2e_per_unit=r.emission_factor_kgco2e_per_unit,
            emission_factor_source=r.emission_factor_source,
        )
        for r in records
    ]


@router.get("/{factory_id}/benchmark", response_model=list[schemas.BenchmarkOut])
def get_benchmark(factory_id: str, session: Session = Depends(get_db)):
    """Sub-sector (Gujarat cluster) benchmark comparison per process.

    Global and India-level benchmarks are honestly reported as unavailable —
    no sourced global/national per-process intensity dataset exists in this
    project (see data-pipeline/sources.md). Returning fabricated numbers for
    those levels to fill out a nicer-looking table would violate the one rule
    this whole product is built around: never assert a number without a real
    source behind it.
    """
    factory = _get_factory_or_404(session, factory_id)
    out = []
    for e in factory.equipment:
        deviation = None
        if e.actual_intensity is not None and e.benchmark_kgco2e_per_t:
            deviation = round((e.actual_intensity - e.benchmark_kgco2e_per_t) / e.benchmark_kgco2e_per_t * 100, 1)
        out.append(schemas.BenchmarkOut(
            equipment_id=e.id, process_label=e.label,
            actual_intensity_kgco2e_per_t=e.actual_intensity, deviation_pct=deviation, severity=e.severity,
            levels=[
                schemas.BenchmarkLevelOut(level="global", available=False,
                                          note="No sourced global per-process intensity dataset — not fabricated"),
                schemas.BenchmarkLevelOut(level="india", available=False,
                                          note="No sourced India-wide per-process intensity dataset — not fabricated"),
                schemas.BenchmarkLevelOut(level="gujarat_cluster", available=True,
                                          value_kgco2e_per_t=e.benchmark_kgco2e_per_t,
                                          source=e.benchmark_source, confidence=e.benchmark_confidence),
                schemas.BenchmarkLevelOut(level="factory", available=True,
                                          value_kgco2e_per_t=e.actual_intensity,
                                          source="computed: app/engine/intensity.intensity_kg_per_t", confidence="high"),
            ],
        ))
    return out


@router.get("/{factory_id}/anomalies", response_model=list[schemas.AnomalyOut])
def get_anomalies(factory_id: str, session: Session = Depends(get_db)):
    factory = _get_factory_or_404(session, factory_id)
    equipment_ids = [e.id for e in factory.equipment]
    if not equipment_ids:
        return []
    return session.scalars(
        select(db.Anomaly).where(db.Anomaly.equipment_id.in_(equipment_ids)).order_by(db.Anomaly.month)
    ).all()


@router.get("/{factory_id}/diagnosis/{anomaly_id}", response_model=schemas.DiagnosisOut)
def get_diagnosis(factory_id: str, anomaly_id: int, session: Session = Depends(get_db)):
    factory = _get_factory_or_404(session, factory_id)
    anomaly = session.get(db.Anomaly, anomaly_id)
    if anomaly is None or anomaly.equipment_id not in {e.id for e in factory.equipment}:
        raise HTTPException(404, f"anomaly {anomaly_id} not found on factory '{factory_id}'")
    equipment = session.get(db.Equipment, anomaly.equipment_id)
    return schemas.DiagnosisOut(
        anomaly=anomaly, equipment_label=equipment.label,
        root_cause_text=equipment.root_cause_text or "No rule fired.",
        root_cause_rules=equipment.root_cause_rules or [],
        explanation_source="deterministic_fallback",
    )


@router.get("/{factory_id}/recommendations", response_model=list[schemas.RecommendationOut])
def get_recommendations(factory_id: str, session: Session = Depends(get_db)):
    factory = _get_factory_or_404(session, factory_id)
    equipment_ids = [e.id for e in factory.equipment]
    if not equipment_ids:
        return []
    return session.scalars(
        select(db.Recommendation)
        .where(db.Recommendation.equipment_id.in_(equipment_ids))
        .order_by(db.Recommendation.rank)
    ).all()


@router.get("/{factory_id}/symbiosis-matches", response_model=list[dict])
def get_symbiosis_matches(factory_id: str, session: Session = Depends(get_db)):
    """Phase 3 (MiniLM + FAISS symbiosis matcher) is not built yet. Returns an
    empty list with an explicit status rather than fabricated matches — see
    data-pipeline roadmap / SymbiosisMatch table docstring."""
    _get_factory_or_404(session, factory_id)
    return []
