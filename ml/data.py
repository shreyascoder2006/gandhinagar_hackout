"""Loads training data for the ML layer straight from the backend's database —
the same real-computed rows the API serves, not a separate export. Requires
the backend to already be seeded (python -m app.db.seed_loader).
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import SessionLocal  # noqa: E402
from app.db import models as db  # noqa: E402


def load_equipment_frame():
    """One row per equipment (600 rows on the seeded dataset): sector, cluster,
    process kind, output scale, fuel-mix shares, and the target — actual
    intensity (kgCO2e/t), computed by app/engine from real activity data.
    """
    import pandas as pd

    session = SessionLocal()
    try:
        rows = []
        equipment_list = session.query(db.Equipment).all()
        for e in equipment_list:
            factory = session.get(db.Factory, e.factory_id)
            energy_records = session.query(db.EnergyRecord).filter_by(equipment_id=e.id).all()
            fuel_totals: dict[str, float] = {}
            for r in energy_records:
                fuel_totals[r.fuel_key] = fuel_totals.get(r.fuel_key, 0.0) + r.quantity
            # normalise to shares of this equipment's own emission-record CO2e
            # (not raw quantity, since units differ per fuel) so the model sees
            # a comparable fuel-mix signal across kilns/boilers/compressors/etc.
            emission_records = session.query(db.EmissionRecord).filter_by(equipment_id=e.id).all()
            co2e_by_fuel: dict[str, float] = {}
            for r in emission_records:
                co2e_by_fuel[r.fuel_key] = co2e_by_fuel.get(r.fuel_key, 0.0) + r.co2e_t
            total_co2e = sum(co2e_by_fuel.values()) or 1.0

            row = {
                "equipment_id": e.id,
                "factory_id": e.factory_id,
                "cluster_id": factory.cluster_id,
                "sector": factory.sector,
                "process_kind": e.kind,
                "share_of_energy": e.share_of_energy,
                "output_tonnes_per_year": factory.output_tonnes_per_year or 0.0,
                "benchmark_kgco2e_per_t": e.benchmark_kgco2e_per_t,
                "actual_intensity": e.actual_intensity,
                "share_grid_electricity": co2e_by_fuel.get("grid_electricity", 0.0) / total_co2e,
                "share_natural_gas": co2e_by_fuel.get("natural_gas", 0.0) / total_co2e,
                "share_coal": co2e_by_fuel.get("coal", 0.0) / total_co2e,
                "share_pet_coke": co2e_by_fuel.get("pet_coke", 0.0) / total_co2e,
                "share_biomass": co2e_by_fuel.get("biomass", 0.0) / total_co2e,
                "share_other_fuel": max(
                    0.0,
                    1.0 - sum(
                        co2e_by_fuel.get(k, 0.0) / total_co2e
                        for k in ("grid_electricity", "natural_gas", "coal", "pet_coke", "biomass")
                    ),
                ),
            }
            rows.append(row)
        return pd.DataFrame(rows)
    finally:
        session.close()


def load_monthly_series_frame():
    """One row per equipment with its 12-month CO2e series (summed across
    fuels per month) plus sector/process_kind for conditioning. Used by the
    Phase 3b anomaly autoencoder — same real EmissionRecord rows the z-score
    rule in app/intelligence/anomaly.py already reads, just reshaped."""
    import pandas as pd

    session = SessionLocal()
    try:
        rows = []
        equipment_list = session.query(db.Equipment).all()
        for e in equipment_list:
            factory = session.get(db.Factory, e.factory_id)
            emission_records = session.query(db.EmissionRecord).filter_by(equipment_id=e.id).all()
            by_month: dict[str, float] = {}
            for r in emission_records:
                by_month[r.month] = by_month.get(r.month, 0.0) + r.co2e_t
            months = sorted(by_month.keys())
            if len(months) != 12:
                continue  # skip anything without a full 12-month series (e.g. onboarded factories)
            rows.append({
                "equipment_id": e.id,
                "factory_id": e.factory_id,
                "sector": factory.sector,
                "process_kind": e.kind,
                "months": months,
                "series": [by_month[m] for m in months],
            })
        return pd.DataFrame(rows)
    finally:
        session.close()


def load_anomaly_ground_truth() -> set[tuple[str, str]]:
    """(equipment_id, month) pairs the Phase 1 generator injected as anomalies
    — held out of the model-facing dataset, used only for evaluation."""
    import json

    path = REPO_ROOT / "data-pipeline" / "synth" / "anomaly_ground_truth.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    out = set()
    for label in data["labels"]:
        equipment_id = f"{label['factory_id']}:{label['process_id']}"
        out.add((equipment_id, label["month"]))
    return out


if __name__ == "__main__":
    df = load_equipment_frame()
    print(df.shape)
    print(df.head())
