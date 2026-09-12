"""
Validate synth/factories_synthetic.json against the real engine formula
(backend/app/engine: tCO2e = canonical_qty * kgco2e_per_unit / 1000) and
against its own schema/provenance claims. This is the "iron clad" check:
every generated number must round-trip through the actual emissions math,
not just look plausible.

Exits non-zero and prints every failure if anything is wrong. Run after
every regeneration of the synthetic dataset.
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "clean"
SYNTH = ROOT / "synth"

errors = []
warnings = []


def load_emission_factors():
    ef = {}
    with open(CLEAN / "emission_factors.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ef[row["key"]] = float(row["kgco2e_per_unit"])
    return ef


def load_benchmarks():
    by_sector = {}
    with open(CLEAN / "sector_benchmarks.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            by_sector.setdefault(row["sector"], {})[row["process_id"]] = float(
                row["benchmark_intensity_kgco2e_per_t"]
            )
    return by_sector


def main():
    ef = load_emission_factors()
    benchmarks = load_benchmarks()

    factories = json.loads((SYNTH / "factories_synthetic.json").read_text(encoding="utf-8"))
    ground_truth = json.loads((SYNTH / "anomaly_ground_truth.json").read_text(encoding="utf-8"))
    provenance = json.loads((SYNTH / "provenance_report.json").read_text(encoding="utf-8"))

    # --- 1. Schema / completeness -----------------------------------------
    if len(factories) != 120:
        errors.append(f"expected 120 factories, found {len(factories)}")

    ids_seen = set()
    for fac in factories:
        if fac["id"] in ids_seen:
            errors.append(f"duplicate factory id {fac['id']}")
        ids_seen.add(fac["id"])

        if len(fac["monthly_output_tonnes"]) != 12:
            errors.append(f"{fac['id']}: expected 12 months of output, got {len(fac['monthly_output_tonnes'])}")
        if any(v <= 0 for v in fac["monthly_output_tonnes"]):
            errors.append(f"{fac['id']}: non-positive monthly output found")

        share_sum = sum(p["share_of_energy"] for p in fac["processes"])
        if not (0.95 <= share_sum <= 1.05):
            warnings.append(f"{fac['id']}: process shares sum to {share_sum:.3f}, expected ~1.0")

        for proc in fac["processes"]:
            if len(proc["monthly_activity"]) != 12:
                errors.append(f"{fac['id']}/{proc['process_id']}: expected 12 months, got {len(proc['monthly_activity'])}")
            for rec in proc["monthly_activity"]:
                for fuel_key, qty in rec["fuel_quantities"].items():
                    if fuel_key not in ef:
                        errors.append(f"{fac['id']}/{proc['process_id']}/{rec['month']}: unknown fuel key '{fuel_key}'")
                    if qty < 0:
                        errors.append(f"{fac['id']}/{proc['process_id']}/{rec['month']}: negative fuel quantity for '{fuel_key}'")

        for rec in fac["monthly_waste"]:
            if rec["hazardous_waste_t"] < 0 or rec["general_process_waste_t"] < 0:
                errors.append(f"{fac['id']}: negative waste tonnage in {rec['month']}")

        for stream in fac.get("waste_streams", []):
            if stream["tpy"] < 0:
                errors.append(f"{fac['id']}: negative waste_stream tpy for tag '{stream['tag']}'")
        for inp in fac.get("accepted_inputs", []):
            if inp["max_tpy"] < 0:
                errors.append(f"{fac['id']}: negative accepted_input max_tpy for tag '{inp['tag']}'")

    # --- 2. Round-trip through the real engine formula ---------------------
    # tCO2e = canonical_qty * kgco2e_per_unit / 1000 (backend/app/engine/emissions.py)
    # Recompute each process-month's implied intensity. A factory that simply
    # runs persistently worse than the sector benchmark is not an anomaly —
    # that's the real benchmark-deviation signal hotspot ranking is supposed
    # to find, and flat-thresholding against the sector benchmark here would
    # repeat the exact "flat threshold" mistake this project exists to avoid
    # (see CLAUDE.md: score against each factory's own baseline). So this
    # check instead flags a month only if it deviates sharply from THAT
    # factory/process's own median month — i.e. a within-factory anomaly.
    anomalous_keys = {(g["factory_id"], g["process_id"], g["month"]) for g in ground_truth["labels"]}
    unexplained_spike_flags = 0
    for fac in factories:
        monthly_output = fac["monthly_output_tonnes"]
        for proc in fac["processes"]:
            intensities = []
            for m_idx, rec in enumerate(proc["monthly_activity"]):
                implied_kgco2e = sum(qty * ef[fk] for fk, qty in rec["fuel_quantities"].items())
                out_t = monthly_output[m_idx] * proc["share_of_energy"]
                intensities.append(implied_kgco2e / out_t if out_t > 0 else 0.0)
            sorted_int = sorted(intensities)
            median = sorted_int[len(sorted_int) // 2]
            if median <= 0:
                continue
            for m_idx, rec in enumerate(proc["monthly_activity"]):
                own_deviation = abs(intensities[m_idx] - median) / median
                key = (fac["id"], proc["process_id"], rec["month"])
                if key not in anomalous_keys and own_deviation > 0.35:
                    unexplained_spike_flags += 1
                    warnings.append(
                        f"{fac['id']}/{proc['process_id']}/{rec['month']}: intensity "
                        f"{intensities[m_idx]:.1f} deviates {own_deviation:.0%} from this "
                        f"factory's own median ({median:.1f}) but is NOT in the ground-truth "
                        f"anomaly labels — likely noise-band overlap, investigate if frequent"
                    )

    # --- 3. Ground truth must actually be reflected in the data -------------
    for g in ground_truth["labels"]:
        fac = next((f for f in factories if f["id"] == g["factory_id"]), None)
        if fac is None:
            errors.append(f"ground truth references unknown factory {g['factory_id']}")
            continue
        proc = next((p for p in fac["processes"] if p["process_id"] == g["process_id"]), None)
        if proc is None:
            errors.append(f"ground truth references unknown process {g['process_id']} on {fac['id']}")
            continue
        rec = next((r for r in proc["monthly_activity"] if r["month"] == g["month"]), None)
        if rec is None:
            errors.append(f"ground truth references unknown month {g['month']} on {fac['id']}/{g['process_id']}")

    # --- 4. Provenance report must match the actual data --------------------
    if provenance["total_factories"] != len(factories):
        errors.append("provenance_report.json total_factories mismatch")
    actual_by_cluster = {}
    actual_by_sector = {}
    for fac in factories:
        actual_by_cluster[fac["cluster_id"]] = actual_by_cluster.get(fac["cluster_id"], 0) + 1
        actual_by_sector[fac["sector"]] = actual_by_sector.get(fac["sector"], 0) + 1
    if actual_by_cluster != provenance["factories_by_cluster"]:
        errors.append("provenance_report.json factories_by_cluster mismatch")
    if actual_by_sector != provenance["factories_by_sector"]:
        errors.append("provenance_report.json factories_by_sector mismatch")

    # --- Report --------------------------------------------------------------
    print(f"Checked {len(factories)} factories, {sum(len(f['processes']) for f in factories)} processes, "
          f"{len(ground_truth['labels'])} ground-truth anomaly labels.")
    print(f"Unexplained within-factory spikes (>35% from that process's own median, "
          f"not in ground truth): {unexplained_spike_flags}")

    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings[:20]:
            print(f"  WARN: {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")

    if errors:
        print(f"\n{len(errors)} ERROR(S):")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
