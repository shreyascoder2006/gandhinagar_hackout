"""Reference-data loaders consumed by app/engine and app/intelligence.

Canonical source of truth is data-pipeline/clean/*.csv (Phase 1 output — sourced,
corrected, audited — see data-pipeline/sources.md). The pre-existing
backend/data/*.json is kept only for the intervention library, which Phase 1 did
not need to touch, and is NOT used for emission factors, clusters, or sector
benchmarks any more, since those had real sourcing corrections applied upstream.
Loading straight from data-pipeline/clean means there is exactly one place these
numbers can be edited — no risk of the backend silently drifting from the
audited pipeline output.
"""
from __future__ import annotations

import csv
import json
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PIPELINE_CLEAN = REPO_ROOT / "data-pipeline" / "clean"
BACKEND_DATA = REPO_ROOT / "backend" / "data"

# Per-fuel accepted-unit multipliers (unit -> multiplier into the canonical unit).
# This is unit-conversion metadata, not a sourced figure, so it is hardcoded here
# rather than carried through the CSV pipeline.
_UNIT_ALIASES: dict[str, dict[str, float]] = {
    "grid_electricity": {"kWh": 1, "MWh": 1000, "units": 1},
    "natural_gas": {"SCM": 1, "m3": 1, "MMBTU": 28.3, "kSCM": 1000},
    "coal": {"t": 1, "tonne": 1, "kg": 0.001},
    "pet_coke": {"t": 1, "tonne": 1, "kg": 0.001},
    "furnace_oil": {"L": 1, "kL": 1000, "litre": 1},
    "diesel": {"L": 1, "kL": 1000, "litre": 1},
    "lpg": {"kg": 1, "t": 1000, "cylinder19kg": 19},
    "biomass": {"t": 1, "tonne": 1, "kg": 0.001},
}


@lru_cache
def emission_factors() -> dict[str, dict]:
    out: dict[str, dict] = {}
    with open(DATA_PIPELINE_CLEAN / "emission_factors.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["key"]] = {
                "label": row["label"],
                "canonicalUnit": row["canonical_unit"],
                "kgco2ePerUnit": float(row["kgco2e_per_unit"]),
                "gjPerUnit": float(row["gj_per_unit"]),
                "source": row["source"],
                "confidence": row["confidence"],
                "units": _UNIT_ALIASES.get(row["key"], {row["canonical_unit"]: 1}),
            }
    return out


@lru_cache
def sector_templates() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    with open(DATA_PIPELINE_CLEAN / "sector_benchmarks.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out.setdefault(row["sector"], []).append({
                "id": row["process_id"],
                "label": row["process_label"],
                "kind": row["process_kind"],
                "share": float(row["share_of_energy"]),
                "benchmark": float(row["benchmark_intensity_kgco2e_per_t"]),
                "source": row["source"],
                "confidence": row["confidence"],
            })
    return out


@lru_cache
def clusters() -> list[dict]:
    out = []
    with open(DATA_PIPELINE_CLEAN / "clusters.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out.append({
                "id": row["id"],
                "name": row["name"],
                "district": row["district"],
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "dominantSectors": row["dominant_sectors"].split(";"),
                "source": row["source"],
                "confidence": row["confidence"],
            })
    return out


@lru_cache
def waste_ratios() -> dict[str, dict]:
    out = {}
    with open(DATA_PIPELINE_CLEAN / "waste_ratios.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["sector"]] = row
    return out


@lru_cache
def intervention_library() -> list[dict]:
    with open(BACKEND_DATA / "interventions.json", encoding="utf-8") as f:
        return json.load(f)
