# data-pipeline

Phase 1 of the Induscope build plan: real sourced data in, a calibrated synthetic dataset out,
nothing asserted without a path back to where it came from.

```
data-pipeline/
├── raw/                          # (reserved) primary-source PDFs/extracts if re-fetched
│                                  #  with working PDF text extraction — see LIMITATIONS.md #2
├── clean/                        # real + calibrated tabular data, every row sourced
│   ├── emission_factors.csv      # CEA + IPCC 2006, corrected vs. the pre-existing repo data
│   ├── clusters.csv              # 9 real Gujarat GIDC clusters (was 6)
│   ├── sector_benchmarks.csv     # per-process benchmark intensities, re-labelled by real source
│   └── waste_ratios.csv          # hazardous/general waste ratios calibrated to CPCB 2019-20
├── scripts/
│   ├── generate_synthetic.py     # deterministic 120-factory raw-activity-data generator
│   └── validate.py               # round-trips output through the real engine formula + schema checks
├── synth/                        # generated — do not hand-edit, re-run the script instead
│   ├── factories_synthetic.json  # 120 factories, monthly raw activity data only
│   ├── anomaly_ground_truth.json # held-out labels for injected anomalies (Phase 3 eval set)
│   └── provenance_report.json    # counts + field-level provenance summary
├── sources.md                    # full citation audit trail, with corrections found this run
├── LIMITATIONS.md                # every known gap, stated once
├── SYNTHETIC_DATA_DISCLOSURE.md  # field-by-field real/calibrated/placeholder breakdown
└── README.md                     # this file
```

## Quickstart

```bash
cd data-pipeline
python scripts/generate_synthetic.py   # writes synth/*.json
python scripts/validate.py             # must print "All checks passed."
```

## What changed vs. the pre-existing `backend/data/*.json`

This phase re-derived the data foundation from scratch rather than assuming the pre-existing
seed files were correct. Three real errors were found and fixed — see `sources.md` for full
detail:

1. **Grid emission factor was version-mismatched.** The old `emission_factors.json` cited
   "CEA v19, 2023-24" but used the value from a *different* CEA release (v21.0, FY2024-25:
   0.710). The correct v19.0/FY2023-24 figure is **0.727 kgCO2/kWh** — now used in
   `clean/emission_factors.csv`.
2. **BEE PAT Cycle-1 was mis-cited for Ceramics/Chemicals/Engineering.** PAT Cycle-1
   (2012-15) covered only 8 sectors, and Textiles is the only one of this project's sectors
   among them. Ceramics/Chemicals/Engineering benchmarks are now labelled "documented
   estimate, medium confidence" instead of a named government scheme they were never part of.
3. **Only 6 of the claimed 9 Gujarat clusters existed.** Added Vatva (Ahmedabad), Dahej, and
   Alang — all real, named GIDC/industrial clusters — bringing the total to 9.

IPCC 2006 fuel factors in the old file were checked and found correct — no change needed
there.

## What Phase 1 deliberately does NOT do

Compute CO2e totals, benchmark deviations, severities, root-cause text, or recommended
interventions. That is Phase 2's job (`backend/app/engine/` + `backend/app/intelligence/`,
which already exist as pure functions and are ready to consume this file). Baking computed
answers into the seed data would defeat the entire point of building a real engine behind
the frontend — see `LIMITATIONS.md` #5.

## Next (Phase 2)

Load `clean/*.csv` and `synth/factories_synthetic.json` into the 12-table Postgres schema,
then run every factory through `backend/app/engine` + `backend/app/intelligence` to produce
the actual hotspots/benchmarks/root-causes the frontend will eventually read via the API —
see `[[induscope_build_plan]]` for the full phase sequence.
