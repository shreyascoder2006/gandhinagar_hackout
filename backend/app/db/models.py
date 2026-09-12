"""SQLAlchemy ORM models — the 12-table schema.

Tables: Cluster, Factory, Equipment, EnergyRecord, WasteRecord, EmissionRecord,
Anomaly, Recommendation, SymbiosisMatch, Intervention, EmissionFactor, Explanation.

EmissionRecord/Anomaly/Recommendation rows are never hand-inserted — they are
written only by db/seed_loader.py calling the real functions in app/engine and
app/intelligence, so every row traces to a function call on real-or-calibrated
input (see data-pipeline/LIMITATIONS.md #5 for why this matters).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Cluster(Base):
    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str] = mapped_column(String, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    dominant_sectors: Mapped[str] = mapped_column(String)  # ";"-joined
    source: Mapped[str] = mapped_column(Text)
    confidence: Mapped[str] = mapped_column(String)

    factories: Mapped[list["Factory"]] = relationship(back_populates="cluster")


class Factory(Base):
    __tablename__ = "factories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    cluster_id: Mapped[str] = mapped_column(ForeignKey("clusters.id"), nullable=False)
    sector: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str] = mapped_column(String)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    data_source: Mapped[str] = mapped_column(String, default="synthetic")  # synthetic | self_reported
    consent_to_share: Mapped[bool] = mapped_column(Boolean, default=True)
    output_tonnes_per_year: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    cluster: Mapped["Cluster"] = relationship(back_populates="factories")
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="factory", cascade="all, delete-orphan")
    waste_records: Mapped[list["WasteRecord"]] = relationship(back_populates="factory", cascade="all, delete-orphan")


class Equipment(Base):
    """A process node (kiln, boiler, compressor, ...) within a factory."""
    __tablename__ = "equipment"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # f"{factory_id}:{process_id}"
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.id"), nullable=False)
    process_id: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    share_of_energy: Mapped[float] = mapped_column(Float, nullable=False)
    benchmark_kgco2e_per_t: Mapped[float] = mapped_column(Float, nullable=False)
    benchmark_source: Mapped[str] = mapped_column(Text)
    benchmark_confidence: Mapped[str] = mapped_column(String)

    # computed by db/seed_loader.py via app/engine + app/intelligence, not asserted
    co2e_tpy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    share_of_total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_intensity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    severity: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # ok | warn | crit
    root_cause_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    root_cause_rules: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    factory: Mapped["Factory"] = relationship(back_populates="equipment")
    energy_records: Mapped[list["EnergyRecord"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")
    emission_records: Mapped[list["EmissionRecord"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")
    anomalies: Mapped[list["Anomaly"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="equipment", cascade="all, delete-orphan")


class EnergyRecord(Base):
    """One fuel/electricity activity reading for one equipment-month. Raw input,
    straight from data-pipeline/synth/factories_synthetic.json — never mutated."""
    __tablename__ = "energy_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[str] = mapped_column(ForeignKey("equipment.id"), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)  # "YYYY-MM"
    fuel_key: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    canonical_unit: Mapped[str] = mapped_column(String, nullable=False)

    equipment: Mapped["Equipment"] = relationship(back_populates="energy_records")


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    factory_id: Mapped[str] = mapped_column(ForeignKey("factories.id"), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)
    hazardous_waste_t: Mapped[float] = mapped_column(Float, nullable=False)
    general_process_waste_t: Mapped[float] = mapped_column(Float, nullable=False)

    factory: Mapped["Factory"] = relationship(back_populates="waste_records")


class EmissionRecord(Base):
    """CO2e for one equipment-month-fuel, computed by app/engine/emissions.co2e_for.
    Formula: tCO2e = canonical_qty * kgco2e_per_unit / 1000. Never hand-entered."""
    __tablename__ = "emission_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[str] = mapped_column(ForeignKey("equipment.id"), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)
    fuel_key: Mapped[str] = mapped_column(String, nullable=False)
    co2e_t: Mapped[float] = mapped_column(Float, nullable=False)
    emission_factor_kgco2e_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    emission_factor_source: Mapped[str] = mapped_column(Text, nullable=False)

    equipment: Mapped["Equipment"] = relationship(back_populates="emission_records")


class Anomaly(Base):
    """A flagged process-month, computed by app/intelligence/anomaly.detect_anomalies
    (leave-one-out z-score against that equipment's own monthly series, +8% relative
    guard) — never a flat threshold. See CLAUDE.md non-negotiable constraint."""
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipment_id: Mapped[str] = mapped_column(ForeignKey("equipment.id"), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)
    co2e_t: Mapped[float] = mapped_column(Float, nullable=False)
    z_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open")  # open | resolved | dismissed

    equipment: Mapped["Equipment"] = relationship(back_populates="anomalies")


class Recommendation(Base):
    """A sized intervention for one equipment, computed by
    app/intelligence/recommender.interventions_for — CAPEX/saving/payback are
    derived from that equipment's own co2e_tpy, not looked up as a flat number."""
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # f"{equipment_id}:{intervention_key}"
    equipment_id: Mapped[str] = mapped_column(ForeignKey("equipment.id"), nullable=False)
    intervention_key: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    capex_inr: Mapped[float] = mapped_column(Float, nullable=False)
    annual_saving_inr: Mapped[float] = mapped_column(Float, nullable=False)
    co2_reduction_tpy: Mapped[float] = mapped_column(Float, nullable=False)
    payback_months: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    circularity_gain_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    equipment: Mapped["Equipment"] = relationship(back_populates="recommendations")


class SymbiosisMatch(Base):
    """Reserved for Phase 3 (MiniLM + FAISS symbiosis matcher) — schema exists,
    no rows are written until that matcher is actually built. Do not seed fake
    matches here; an empty table is the honest state until Phase 3 lands."""
    __tablename__ = "symbiosis_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_factory_id: Mapped[str] = mapped_column(ForeignKey("factories.id"), nullable=False)
    recipient_factory_id: Mapped[str] = mapped_column(ForeignKey("factories.id"), nullable=False)
    waste_tag: Mapped[str] = mapped_column(String, nullable=False)
    quantity_tpy: Mapped[float] = mapped_column(Float, nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    semantic_score: Mapped[float] = mapped_column(Float, nullable=False)
    co2_avoided_tpy: Mapped[float] = mapped_column(Float, nullable=False)
    is_placeholder: Mapped[bool] = mapped_column(Boolean, default=True)


class Intervention(Base):
    """Static catalog — the 17-entry circular-intervention library, unchanged
    from backend/data/interventions.json (Phase 1 audit did not find sourcing
    issues here; see data-pipeline/sources.md)."""
    __tablename__ = "interventions"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    applies_to: Mapped[list] = mapped_column(JSON, nullable=False)
    reduction_pct: Mapped[float] = mapped_column(Float, nullable=False)
    capex_base_inr: Mapped[float] = mapped_column(Float, nullable=False)
    saving_inr_per_tco2: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)


class EmissionFactor(Base):
    """Static catalog — the sourced fuel/electricity emission factors, loaded
    straight from data-pipeline/clean/emission_factors.csv (Phase 1 output)."""
    __tablename__ = "emission_factors"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    canonical_unit: Mapped[str] = mapped_column(String, nullable=False)
    kgco2e_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    gj_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[str] = mapped_column(String, nullable=False)


class Explanation(Base):
    """Reserved for Phase 3 (Ollama LLM + deterministic-fallback explainer).
    Schema exists now so Phase 3 only needs to add write logic, not a migration.
    Empty until that phase — no placeholder text is inserted here."""
    __tablename__ = "explanations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_type: Mapped[str] = mapped_column(String, nullable=False)  # anomaly | recommendation | match
    subject_id: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by: Mapped[str] = mapped_column(String, nullable=False)  # "ollama:llama3.1:8b" | "deterministic_fallback"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
