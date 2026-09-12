"""API response schemas (pydantic v2, from_attributes=True — built straight off
the SQLAlchemy ORM rows in app/db/models.py, no separate hand-maintained copy
of the same fields drifting out of sync)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class ClusterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    district: str
    lat: float
    lon: float
    dominant_sectors: str
    source: str
    confidence: str
    factory_count: int = 0
    open_anomaly_count: int = 0


class FactorySummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    cluster_id: str
    sector: str
    district: str
    lat: float
    lon: float
    data_source: str
    consent_to_share: bool = True
    output_tonnes_per_year: Optional[float] = None


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    process_id: str
    label: str
    kind: str
    share_of_energy: float
    benchmark_kgco2e_per_t: float
    benchmark_source: str
    benchmark_confidence: str
    co2e_tpy: Optional[float]
    share_of_total: Optional[float]
    actual_intensity: Optional[float]
    severity: Optional[str]
    root_cause_text: Optional[str]


class FactoryDetailOut(FactorySummaryOut):
    total_co2e_tpy: float
    equipment: list[EquipmentOut]


class EquipmentFullOut(EquipmentOut):
    recommendations: list["RecommendationOut"] = []


class FactoryFullOut(FactorySummaryOut):
    """Everything a client needs to render the dashboard/twin/simulator/rollup
    for one factory in a single request — equipment with nested recommendations.
    Used by the bulk GET /api/factories listing so the frontend can load the
    whole (small, ~120-factory) dataset once, the same way the pre-existing
    static-mock store held every factory in memory at once."""
    total_co2e_tpy: float
    total_energy_mwh_per_year: float
    total_waste_tpy: float
    circularity_ratio: float
    equipment: list[EquipmentFullOut]


class EmissionMonthOut(BaseModel):
    month: str
    fuel_key: str
    co2e_t: float
    emission_factor_kgco2e_per_unit: float
    emission_factor_source: str


class BenchmarkLevelOut(BaseModel):
    level: str  # global | india | gujarat_cluster | factory
    available: bool
    value_kgco2e_per_t: Optional[float] = None
    source: Optional[str] = None
    confidence: Optional[str] = None
    note: Optional[str] = None


class BenchmarkOut(BaseModel):
    equipment_id: str
    process_label: str
    actual_intensity_kgco2e_per_t: Optional[float]
    deviation_pct: Optional[float]
    severity: Optional[str]
    levels: list[BenchmarkLevelOut]


class AnomalyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    equipment_id: str
    month: str
    co2e_t: float
    z_score: float
    status: str


class DiagnosisOut(BaseModel):
    anomaly: AnomalyOut
    equipment_label: str
    root_cause_text: str
    root_cause_rules: list[dict]
    explanation_source: str  # "deterministic_fallback" until Phase 3's LLM explainer lands


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    equipment_id: str
    intervention_key: str
    title: str
    category: str
    capex_inr: float
    annual_saving_inr: float
    co2_reduction_tpy: float
    payback_months: int
    confidence: str
    description: str
    circularity_gain_pct: Optional[float]
    rank: int


class InterventionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    title: str
    category: str
    applies_to: list
    reduction_pct: float
    capex_base_inr: float
    saving_inr_per_tco2: float
    confidence: str
    description: str
    source: str


class EmissionFactorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    label: str
    canonical_unit: str
    kgco2e_per_unit: float
    gj_per_unit: float
    source: str
    confidence: str


class ScaleProjectionOut(BaseModel):
    factory_count: int
    projected_total_co2e_tpy: float
    projected_avoidable_co2e_tpy: float
    sample_factory_count: int
    sample_avg_co2e_tpy: float
    sample_avg_avoidable_co2e_tpy: float
    methodology: str


class OnboardActivityIn(BaseModel):
    fuel_key: str
    unit: str
    quantity: float
    month: str


class OnboardProcessIn(BaseModel):
    process_id: str
    label: str
    kind: str
    share_of_energy: float
    activities: list[OnboardActivityIn]


class OnboardFactoryIn(BaseModel):
    name: str
    cluster_id: str
    sector: str
    output_tonnes_total: float
    processes: list[OnboardProcessIn]


class OnboardFactoryOut(BaseModel):
    id: str
    name: str
    total_co2e_t: float
    anomaly_check_status: str  # "not_available" — honest, see data-pipeline/LIMITATIONS.md
    recommendations: list[RecommendationOut]
