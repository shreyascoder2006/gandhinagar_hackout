"""
Induscope data pipeline — synthetic factory generator (Phase 1).

Produces RAW monthly activity data (fuel/electricity quantities, output tonnage,
waste tonnage) for 120 factories across the 9 real Gujarat clusters in
data-pipeline/clean/clusters.csv, using the process mix and benchmark
intensities in data-pipeline/clean/sector_benchmarks.csv and the emission
factors in data-pipeline/clean/emission_factors.csv.

Deliberately does NOT compute CO2e totals, benchmark-deviation severities,
root-cause text, or recommended interventions here — see LIMITATIONS.md #5.
Those must be computed by backend/app/engine + backend/app/intelligence
reading this file's output, so every number in the product traces to a real
function call on real-or-calibrated input, not a hand-authored figure.

Deterministic: fixed RANDOM_SEED, single sequential random stream, so re-running
this script produces byte-identical output. Change RANDOM_SEED only if you
intend to regenerate a new dataset version (bump SCHEMA_VERSION too).

Injected anomaly months are written ONLY to synth/anomaly_ground_truth.json,
never into the model-facing factories_synthetic.json — see LIMITATIONS.md #6.
"""

import csv
import json
import random
from pathlib import Path

RANDOM_SEED = 42
SCHEMA_VERSION = "1.0.0"

ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "clean"
SYNTH = ROOT / "synth"

MONTHS = [
    "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
    "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
]

# Illustrative output-scale ranges per sector (annual tonnes of product/throughput).
# NOT independently sourced — order-of-magnitude judgement calls consistent with
# publicly known GIDC SME scale. Tagged is_placeholder. See LIMITATIONS.md #7.
SECTOR_OUTPUT_RANGE_T_PER_YEAR = {
    "Ceramics": (20000, 60000),
    "Chemicals": (3000, 15000),
    "Textiles": (5000, 20000),
    "Engineering": (2000, 10000),
}

# Which factory count to generate per cluster (sums to 120), and which sector
# each cluster's factories draw from (a cluster with two dominant sectors
# splits its count across both).
CLUSTER_PLAN = {
    "morbi":      [("Ceramics", 18)],
    "vapi":       [("Chemicals", 14)],
    "ankleshwar": [("Chemicals", 12)],
    "surat":      [("Textiles", 16)],
    "rajkot":     [("Engineering", 14)],
    "jamnagar":   [("Engineering", 5), ("Chemicals", 5)],
    "vatva":      [("Chemicals", 8), ("Textiles", 8)],
    "dahej":      [("Chemicals", 10)],
    # Alang (ship recycling) has no dedicated process template; it is mapped
    # onto the Engineering template (furnace/cutting, compressor, heat-treat)
    # as a documented simplification, not a fabricated new sector — see
    # SYNTHETIC_DATA_DISCLOSURE.md.
    "alang":      [("Engineering", 10)],
}

# Primary fuel assignment per process kind — a defensible typical mix, not a
# cited figure. Documented as `calibrated` in SYNTHETIC_DATA_DISCLOSURE.md.
PROCESS_FUEL_MIX = {
    "kiln":       [("natural_gas", 0.85), ("pet_coke", 0.15)],
    "boiler":     [("coal", 0.55), ("biomass", 0.25), ("natural_gas", 0.20)],
    "furnace":    [("grid_electricity", 0.90), ("natural_gas", 0.10)],
    "dryer":      [("natural_gas", 0.75), ("grid_electricity", 0.25)],
    "compressor": [("grid_electricity", 1.0)],
    "effluent":   [("grid_electricity", 1.0)],
    "generic":    [("grid_electricity", 0.6), ("natural_gas", 0.4)],
}

# Seasonal output multiplier by month-of-year (index 0 = April), mild swing —
# a documented modelling choice (monsoon slowdown, year-end ramp), not sourced.
SEASONAL_MULTIPLIER = [1.00, 1.02, 1.01, 0.92, 0.90, 0.95, 1.00, 1.03, 1.05, 1.06, 1.04, 0.98]

ANOMALY_FRACTION = 0.17  # ~17% of factories get 1-2 injected anomalous months
ANOMALY_MULTIPLIER_RANGE = (1.4, 2.1)


def load_csv(name):
    with open(CLEAN / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_clusters():
    rows = load_csv("clusters.csv")
    out = {}
    for r in rows:
        out[r["id"]] = {
            "id": r["id"],
            "name": r["name"],
            "district": r["district"],
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
        }
    return out


def load_benchmarks():
    rows = load_csv("sector_benchmarks.csv")
    by_sector = {}
    for r in rows:
        by_sector.setdefault(r["sector"], []).append({
            "process_id": r["process_id"],
            "label": r["process_label"],
            "kind": r["process_kind"],
            "share": float(r["share_of_energy"]),
            "benchmark_kgco2e_per_t": float(r["benchmark_intensity_kgco2e_per_t"]),
            "source": r["source"],
            "confidence": r["confidence"],
        })
    return by_sector


def load_emission_factors():
    rows = load_csv("emission_factors.csv")
    out = {}
    for r in rows:
        out[r["key"]] = {
            "kgco2e_per_unit": float(r["kgco2e_per_unit"]),
            "canonical_unit": r["canonical_unit"],
        }
    return out


def jitter_latlon(rng, lat, lon, max_km=12.0):
    # ~0.009 deg latitude per km; longitude scaled by cos(lat) roughly ignored
    # at this small radius for a demo-grade dataset (documented simplification).
    dlat = (rng.uniform(-1, 1)) * (max_km / 111.0)
    dlon = (rng.uniform(-1, 1)) * (max_km / 111.0)
    return round(lat + dlat, 4), round(lon + dlon, 4)


def build_factory(rng, cluster, sector, seq, processes, ef, waste_ratio_row):
    output_lo, output_hi = SECTOR_OUTPUT_RANGE_T_PER_YEAR[sector]
    annual_output_t = rng.uniform(output_lo, output_hi)
    monthly_base_output = annual_output_t / 12.0

    lat, lon = jitter_latlon(rng, cluster["lat"], cluster["lon"])
    factory_id = f"{cluster['id']}-{sector.lower()}-{seq:02d}"
    name = f"{cluster['name']} {sector} Unit {seq:02d} (Synthetic)"

    # Per-factory performance ratio: how this factory's real specific-energy
    # compares to the sector benchmark (0.8 = runs 20% better than benchmark,
    # 1.4 = runs 40% worse). This is what later lets benchmark-deviation and
    # hotspot ranking actually differentiate factories.
    factory_performance_ratio = rng.uniform(0.80, 1.45)

    # Dampen and individualise the seasonal curve per factory. Applying the
    # exact same seasonal shape to all 120 factories turned out to be a real
    # bug once run through the actual anomaly detector (app/intelligence/
    # anomaly.py's leave-one-out z-score, n=12): a uniform cross-factory
    # signal reads as a strong, systematic deviation and got ~10% of all
    # equipment-months false-flagged as anomalies, concentrated exactly in
    # the seasonal trough/peak months (verified: see
    # data-pipeline/LIMITATIONS.md #8). Real factories don't all share one
    # calendar-perfect seasonal curve, so each factory now gets its own
    # damping factor on top of the shared shape.
    seasonal_damping = rng.uniform(0.25, 0.6)
    monthly_output = []
    for m_idx in range(12):
        noise = rng.uniform(0.95, 1.05)
        seasonal = 1.0 + (SEASONAL_MULTIPLIER[m_idx] - 1.0) * seasonal_damping
        monthly_output.append(round(monthly_base_output * seasonal * noise, 1))

    process_records = []
    for proc in processes:
        proc_performance = factory_performance_ratio * rng.uniform(0.92, 1.08)
        fuel_mix = PROCESS_FUEL_MIX[proc["kind"]]
        monthly_activity = []
        for m_idx in range(12):
            target_kgco2e = (
                proc["benchmark_kgco2e_per_t"]
                * monthly_output[m_idx]
                * proc["share"]
                * proc_performance
                * rng.uniform(0.93, 1.07)
            )
            fuels = {}
            for fuel_key, fuel_share in fuel_mix:
                fuel_kgco2e = target_kgco2e * fuel_share
                ef_row = ef[fuel_key]
                qty = fuel_kgco2e / ef_row["kgco2e_per_unit"]
                fuels[fuel_key] = round(qty, 3)
            monthly_activity.append({
                "month": MONTHS[m_idx],
                "fuel_quantities": fuels,
            })
        process_records.append({
            "process_id": proc["process_id"],
            "label": proc["label"],
            "kind": proc["kind"],
            "share_of_energy": proc["share"],
            "benchmark_source": proc["source"],
            "benchmark_confidence": proc["confidence"],
            "monthly_activity": monthly_activity,
        })

    hazardous_pct = float(waste_ratio_row["hazardous_waste_ratio_pct_of_output"]) / 100.0
    general_pct = float(waste_ratio_row["general_process_waste_ratio_pct_of_output"]) / 100.0
    monthly_waste = []
    for m_idx in range(12):
        out_t = monthly_output[m_idx]
        monthly_waste.append({
            "month": MONTHS[m_idx],
            "hazardous_waste_t": round(out_t * hazardous_pct * rng.uniform(0.85, 1.15), 2),
            "general_process_waste_t": round(out_t * general_pct * rng.uniform(0.85, 1.15), 2),
        })

    return {
        "id": factory_id,
        "name": name,
        "cluster_id": cluster["id"],
        "sector": sector,
        "district": cluster["district"],
        "lat": lat,
        "lon": lon,
        "data_source": "synthetic",
        "schema_version": SCHEMA_VERSION,
        "monthly_output_tonnes": monthly_output,
        "processes": process_records,
        "monthly_waste": monthly_waste,
        "consent_to_share": True,
    }


def inject_anomalies(rng, factories):
    """Mutate a subset of factories in place, inflating one process's activity
    for 1-2 months. Returns the ground-truth label list (kept out of the
    model-facing file)."""
    ground_truth = []
    n_anomalous = max(1, round(len(factories) * ANOMALY_FRACTION))
    chosen = rng.sample(range(len(factories)), n_anomalous)
    for idx in chosen:
        factory = factories[idx]
        n_months = rng.choice([1, 1, 2])
        proc = rng.choice(factory["processes"])
        month_indices = rng.sample(range(12), n_months)
        multiplier = rng.uniform(*ANOMALY_MULTIPLIER_RANGE)
        for m_idx in month_indices:
            activity = proc["monthly_activity"][m_idx]
            for fuel_key in activity["fuel_quantities"]:
                activity["fuel_quantities"][fuel_key] = round(
                    activity["fuel_quantities"][fuel_key] * multiplier, 3
                )
            ground_truth.append({
                "factory_id": factory["id"],
                "process_id": proc["process_id"],
                "month": activity["month"],
                "injected_multiplier": round(multiplier, 3),
            })
    return ground_truth


def main():
    rng = random.Random(RANDOM_SEED)
    clusters = load_clusters()
    benchmarks = load_benchmarks()
    ef = load_emission_factors()
    waste_ratios = {r["sector"]: r for r in load_csv("waste_ratios.csv")}

    factories = []
    for cluster_id, sector_counts in CLUSTER_PLAN.items():
        cluster = clusters[cluster_id]
        for sector, count in sector_counts:
            processes = benchmarks[sector]
            for seq in range(1, count + 1):
                factories.append(
                    build_factory(rng, cluster, sector, seq, processes, ef, waste_ratios[sector])
                )

    assert len(factories) == 120, f"expected 120 factories, got {len(factories)}"

    ground_truth = inject_anomalies(rng, factories)

    SYNTH.mkdir(exist_ok=True)
    with open(SYNTH / "factories_synthetic.json", "w", encoding="utf-8") as f:
        json.dump(factories, f, indent=2)

    with open(SYNTH / "anomaly_ground_truth.json", "w", encoding="utf-8") as f:
        json.dump({
            "note": "Held-out labels for injected anomalous process-months. "
                    "NOT present in factories_synthetic.json. For evaluating "
                    "the Phase-3 anomaly detector's precision/recall against "
                    "real labels instead of asserted numbers.",
            "schema_version": SCHEMA_VERSION,
            "random_seed": RANDOM_SEED,
            "labels": ground_truth,
        }, f, indent=2)

    by_cluster = {}
    by_sector = {}
    for fac in factories:
        by_cluster[fac["cluster_id"]] = by_cluster.get(fac["cluster_id"], 0) + 1
        by_sector[fac["sector"]] = by_sector.get(fac["sector"], 0) + 1

    with open(SYNTH / "provenance_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "schema_version": SCHEMA_VERSION,
            "random_seed": RANDOM_SEED,
            "total_factories": len(factories),
            "factories_by_cluster": by_cluster,
            "factories_by_sector": by_sector,
            "injected_anomaly_count": len(ground_truth),
            "injected_anomaly_factory_count": len({g["factory_id"] for g in ground_truth}),
            "field_provenance": {
                "cluster_geography": "real (see clean/clusters.csv, sources.md #5)",
                "emission_factors": "real (see clean/emission_factors.csv, sources.md #1-2)",
                "process_benchmark_intensities": "documented estimate, medium confidence, except Textiles which is real BEE PAT Cycle-1 (see clean/sector_benchmarks.csv, sources.md #4)",
                "waste_ratios": "calibrated to CPCB 2019-20 Gujarat state total order-of-magnitude (see clean/waste_ratios.csv, sources.md #3)",
                "factory_identity_and_time_series": "100% synthetic, seeded+reproducible (this script)",
                "output_scale_ranges": "is_placeholder, illustrative only (see LIMITATIONS.md #7)",
            },
        }, f, indent=2)

    print(f"Generated {len(factories)} factories across {len(by_cluster)} clusters.")
    print(f"Injected {len(ground_truth)} anomalous process-months across "
          f"{len({g['factory_id'] for g in ground_truth})} factories.")
    print(f"Output: {SYNTH / 'factories_synthetic.json'}")


if __name__ == "__main__":
    main()
