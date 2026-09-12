# Implementation Plan — Circular Carbon Intelligence Platform (HackOut'26)

Source of truth: `Circular_Carbon_Ecosystem_Solution_1.pdf` (Jeevesh Bodhani, DJSCE). This plan maps every feature in that document to concrete work, in build order, with a demo-first priority.

**Assumption:** ~36–48 h hackathon, 3–4 people. Hour estimates are per-person-effort. If the window is shorter, ship P0 only — it is a complete end-to-end story.

---

## 0. Where we are (updated 2026-09-12)

| Done (frontend, engine logic in TypeScript) | Not done |
|---|---|
| Dashboard, KPI bar, process list, hotspot panel with confidence labels | FastAPI backend (Tracks A/B) — all engines below are pure TS modules under `frontend/src/lib/` and port 1:1 |
| Procedural 3D process twin (kiln, dryer, compressor, glaze line, ETP, boiler) with fly-to inspection | Proper reactor / distillation-column geometry for the chemicals twin (P2) |
| **F1/F2** hotspot ranking + benchmark banding · **F3** root cause (template rules + anomaly link) · **F4** intervention library lookup (17 entries, 5 circular categories) | Root-cause rule tree R1–R6 over time-series variables (currently template + anomaly only) |
| **F5** what-if simulator (sequential residual, live twin re-render) · **F7** 30/90/365 action plan (Markdown/print) | Public-data ETL (L1b), Monitor loop (M1), Redis, Docker, deploy |
| **F6** symbiosis matching (tag compat + haversine + consent gating) + factory panel · **F8** regulator map with anonymised rollup and < 3-unit suppression | Methodology page rendering the sourced tables (I2 surface) |
| **L1** intake form + CSV upload → deterministic engine (8 sourced emission factors, unit normalisation, annualisation) · **I1** z-score anomaly flags + sparklines · **X1** consultant portfolio + factory switching | |

## 1. Feature → work map

PDF §02 lists 8 key features. Architecture §03 adds the layers underneath them. Priority: **P0 = must demo**, **P1 = should**, **P2 = stretch**.

| # | Feature (PDF) | Priority | Layer | Depends on |
|---|---|---|---|---|
| F1 | Hotspot Detection | P0 | Calc + Intelligence | Calc engine |
| F2 | Sub-sector Benchmarking | P0 | Calc | Benchmark seed data |
| F3 | Root-Cause Diagnosis (rule tree) | P0 | Intelligence | F1, F2 |
| F4 | Circular Recommender (library lookup) | P0 | Intelligence | Intervention library seed, F3 |
| F5 | What-If Simulator | P0 | Intelligence + UI | F4 |
| F6 | Industrial Symbiosis Matching | P1 | Intelligence + GIS | Multi-factory seed, waste-stream tags |
| F7 | Costed Action Plan (30/90/365) | P1 | Intelligence | F4, F5 |
| F8 | Regulator Rollup View (cluster/state map) | P1 | Presentation + aggregation | Multi-factory seed, F1, F6 |
| L1 | Ingestion: intake form + CSV/ERP upload | P1 | Ingestion | Calc engine |
| L1b | Public-data ETL (CPCB/BEE/ASI) | P2 | Ingestion | — (seed static extracts instead for demo) |
| I1 | Anomaly detection (z-score rolling window) | P1 | Intelligence | Time-series seed |
| I2 | Confidence scoring on every output | P0 | Cross-cutting | Data-tier tags in schema |
| M1 | Monitor stage (closed loop: uptake tracking, re-score) | P2 | Intelligence | F7 |
| X1 | Consultant portfolio view | P2 | Presentation | Multi-factory seed |
| X2 | Privacy/anonymisation for rollup | P1 | Aggregation | F8 |
| X3 | Multi-language intake | P2 (skip) | — | L1 |

---

## 2. Target repo layout

```
Hack_Out/
├── frontend/                     # exists
│   └── src/
│       ├── api/                  # typed fetch client (NEW)
│       ├── pages/                # Factory, Simulator, ActionPlan, Regulator, Intake, Portfolio
│       ├── components/twin/      # exists
│       ├── components/dashboard/ # exists
│       ├── components/map/       # Leaflet cluster map (NEW)
│       └── store/
├── backend/                      # NEW — Python 3.11, FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── models/               # pydantic schemas (Factory, Process, Activity, Result…)
│   │   ├── engine/               # Layer 3 — deterministic, pure functions, unit-tested
│   │   │   ├── units.py          # normalisation to kWh / t / m³ / GJ
│   │   │   ├── emissions.py      # activity × EF → CO₂e
│   │   │   ├── intensity.py      # per-tonne metrics, circularity ratio
│   │   │   └── benchmark.py      # deviation vs sub-sector
│   │   ├── intelligence/         # Layer 4 — explainable
│   │   │   ├── hotspots.py       # percentile ranking, severity bands
│   │   │   ├── anomaly.py        # z-score control limits
│   │   │   ├── rootcause.py      # decision tree rules
│   │   │   ├── recommender.py    # library lookup + ranking
│   │   │   ├── simulator.py      # combined-impact math
│   │   │   ├── actionplan.py     # 30/90/365 phasing
│   │   │   ├── symbiosis.py      # waste→input matching + distance
│   │   │   └── confidence.py     # tier → score, propagation rules
│   │   ├── aggregation/          # Layer 5 rollup + anonymisation
│   │   ├── ingestion/            # CSV parser, intake validation
│   │   ├── db/                   # SQLAlchemy models, session, seed loader
│   │   └── routers/              # /factories /diagnose /simulate /plan /symbiosis /rollup /intake
│   ├── data/                     # Tier-1 seed extracts (CSV/JSON, sourced)
│   │   ├── emission_factors.csv  # MoEFCC/IPCC/BEE — fuel, grid, materials (with source column)
│   │   ├── benchmarks.csv        # ASI/BEE PAT sub-sector intensities
│   │   ├── interventions.csv     # BEE-UDIT-style library, tagged by process kind + sector
│   │   ├── clusters.geojson      # Gujarat cluster polygons/centroids
│   │   └── factories_synthetic/  # 8–12 calibrated demo factories across 4 clusters
│   ├── tests/
│   └── Dockerfile
├── docker-compose.yml            # postgres+postgis, redis, backend, frontend
└── IMPLEMENTATION_PLAN.md
```

**Storage decision for the hackathon:** PostgreSQL + PostGIS via docker-compose as the PDF specifies, **but** every engine function takes plain pydantic objects, so if Docker fights us, the same code runs on SQLite + Python haversine with zero engine changes. Redis is P2 (cache simulate results) — skip unless idle.

---

## 3. Data seeds (do first — everything downstream is a lookup against these)

| File | Rows | Columns | Source to cite |
|---|---|---|---|
| `emission_factors.csv` | ~40 | `key, name, unit, kgco2e_per_unit, source, year, confidence_tier` | MoEFCC/IPCC fuel factors, CEA grid factor (Gujarat ~0.71 kgCO₂/kWh), material factors |
| `benchmarks.csv` | ~25 | `sector, sub_sector, process_kind, metric, benchmark_value, unit, p25, p75, source` | ASI + BEE PAT (ceramics, textiles, chemicals, engineering, petrochem) |
| `interventions.csv` | ~40 | `id, title, category, applies_to_process_kind, applies_to_sector, capex_inr_per_unit_scale, saving_pct_energy, saving_pct_material, co2_reduction_basis, payback_hint, confidence_tier, source, description` | BEE UDIT case studies + published cleaner-production audits |
| `clusters.geojson` | 6–9 | Morbi, Vapi, Ankleshwar, Dahej, Surat, Rajkot, Jamnagar, Vatva | OSM industrial-area centroids |
| `factories_synthetic/*.json` | 8–12 | Full factory profile incl. **monthly time series (12 mo)** of energy/material/waste per process, **waste stream tags**, lat/lon | Calibrated to benchmarks; every file has `"data_source": "synthetic"` |

Categories for interventions must be exactly the PDF's circular set: `material-substitution`, `waste-to-input`, `recycling-loop`, `process-change`, `heat-recovery`.

---

## 4. Engine specs (Layer 3 — deterministic, unit-tested)

```
normalise(activity)           → canonical unit (kWh, t, m³, GJ); reject unknown units with a validation error
co2e(activity)                → qty × EF[key].kgco2e_per_unit / 1000  (tCO₂e); attaches ef source + tier
process_totals(factory)       → Σ co2e per process; share_of_total
intensity(process, output_t)  → kgCO₂e/t, kWh/t, kg waste/t, m³ water/t
circularity_ratio(factory)    → recovered_material / total_material_in
deviation(actual, benchmark)  → (actual − bm) / bm  ; band: ok < 0.10 ≤ warn < 0.30 ≤ crit
```

All functions pure, all outputs carry `{value, unit, source, confidence}`. Tests: one golden-file test per synthetic factory (input JSON → expected totals), plus unit tests for every EF and unit conversion.

---

## 5. Intelligence specs (Layer 4 — explainable, no black boxes)

### F1 Hotspots — `hotspots.py`
Rank processes by `share_of_total` (emissions) and by cost share; severity from benchmark deviation band. Output the top-N with `why: "52.8% of site CO₂e, +45% vs sub-sector benchmark"`.

### I1 Anomaly — `anomaly.py`
Per process per metric, rolling 6-month mean/σ; flag months with |z| > 2. Output `{month, metric, z, direction}`. Feeds root cause ("spike in Mar-26 coincides with fuel switch").

### F3 Root cause — `rootcause.py`
Fixed decision tree over known variables — implement as an ordered rule list, each rule = predicate + explanation template + confidence. Starter rules:

| Rule | Predicate | Diagnosis |
|---|---|---|
| R1 Low utilisation | output_t below p25 of own history AND energy flat | "Fixed energy overhead spread over low output" |
| R2 Fuel mix | share of high-EF fuel > benchmark fuel mix | "Fuel mix skewed to [fuel] (EF x vs y)" |
| R3 Process intensity | kWh/t or fuel/t > benchmark by >15% with normal output | "Specific consumption elevated — combustion/thermal efficiency" |
| R4 Waste leakage | waste/t > benchmark AND recovery rate < benchmark | "Material lost to waste stream, not recovered" |
| R5 Trend drift | 12-mo slope of intensity > +5%/yr | "Deteriorating — maintenance/fouling signature" |
| R6 Anomaly-linked | I1 flag in last 3 months | "Step change on [date]" |

First matching rules (up to 2) are returned with their evidence values. Always tagged `inference` in the confidence field.

### F4 Recommender — `recommender.py`
Filter library by `process_kind` + `sector` + matched rule tags → for each: scale CAPEX by process size, compute `annual_saving_inr`, `co2_reduction_tpy` from the process's actual activity × saving_pct × EF, `payback_months`. Rank by **tCO₂e per ₹ lakh CAPEX**, tie-break on payback. Confidence = min(library tier, input data tier).

### F5 Simulator — `simulator.py`
Input: factory id + set of intervention ids. Apply savings **sequentially on the residual** (so two 20 % fixes on the same process give 36 %, not 40 %). Return new factory profile (per-process CO₂e, totals, intensity, circularity), delta vs baseline, Σ CAPEX, Σ saving, blended payback. Pure function → the twin re-renders with updated severities (smoke, glow, rings calm down live).

### F7 Action plan — `actionplan.py`
Phase selected/recommended interventions: **30-day** = payback ≤ 6 mo or CAPEX < ₹5 L (operational fixes); **90-day** = payback ≤ 18 mo; **365-day** = the rest. Each item: priority, owner role, CAPEX, saving, CO₂, prerequisite. Export as JSON + printable PDF/Markdown.

### F6 Symbiosis — `symbiosis.py`
Each factory declares `waste_streams[{tag, tpy, form}]` and `accepted_inputs[{tag, max_tpy}]`. Match on tag (with a small compatibility table: `ceramic_sludge → brick_raw`, `fly_ash → cement`, `spent_solvent → recovery`, `textile_effluent_heat → dye_preheat`…) within radius (PostGIS `ST_DWithin` or haversine ≤ 25 km). Score = tonnage matched × distance factor; output CO₂ avoided (landfill EF + virgin-material EF) and ₹ saved for both parties. Consent flag gates whether factory identity is shown.

### I2 Confidence — `confidence.py`
Tier table straight from PDF §05. Propagation: derived = min(inputs) capped at deterministic-high; inference rules always `inference`. Every API response object has `confidence: {level, pct_range, basis}`.

### F8 Rollup — `aggregation/`
Group factories by cluster → sector: Σ CO₂e, avoidable CO₂e (Σ recommended reductions), avg deviation, intervention uptake %, symbiosis matches count. **Anonymise:** never return factory ids/names; suppress any cell with < 3 factories. Output GeoJSON for the map.

---

## 6. API surface

| Method | Path | Returns |
|---|---|---|
| GET | `/factories` | list (id, name, cluster, sector, data_source) |
| GET | `/factories/{id}` | profile + computed baseline |
| GET | `/factories/{id}/diagnose` | hotspots + anomalies + root causes + recommendations (all confidence-tagged) |
| POST | `/factories/{id}/simulate` `{intervention_ids[]}` | simulated profile + deltas + financials |
| POST | `/factories/{id}/plan` `{intervention_ids[]}` | 30/90/365 plan |
| GET | `/factories/{id}/symbiosis` | matches for this factory |
| GET | `/rollup?level=cluster\|state` | anonymised aggregates as GeoJSON + tables |
| POST | `/intake` | validated factory JSON → creates factory, runs diagnose |
| POST | `/intake/csv` | multipart CSV/XLSX → parsed activities + validation report |
| GET | `/meta/emission-factors`, `/meta/benchmarks`, `/meta/interventions` | the sourced tables (for the "methodology" page) |

---

## 7. Frontend work

| Page / component | Feature | Notes |
|---|---|---|
| `api/client.ts` | — | typed fetch; swap `useFactoryStore` from static mock → `/factories/{id}/diagnose`. Keep the mock as offline fallback. |
| Factory dashboard (exists) | F1 F2 F3 F4 I2 | Add anomaly sparkline per process, "why this ranking" tooltip, methodology link. Twin severities now come from the engine. |
| **Simulator page** | F5 | Left: intervention checklist grouped by process (cost/CO₂/payback chips). Centre: the twin, re-rendered from `/simulate` result — smoke thins, glow cools, rings turn amber/green. Right: before/after KPIs with count-up animation (Framer Motion), payback + CAPEX totals, Recharts waterfall of CO₂. |
| **Action plan page** | F7 | Three columns (30/90/365) of cards, drag-free, print/export button. |
| **Symbiosis panel** | F6 | On the factory page: "Your waste → their input" cards with distance, CO₂ avoided, both-party ₹; a mini Leaflet map with a line to the partner. |
| **Regulator page** | F8 X2 | Leaflet map of Gujarat: cluster bubbles sized by avoidable CO₂e, coloured by avg deviation; click → sector breakdown table, top intervention types, symbiosis match count. "Aggregated · min 3 factories per cell" badge. |
| **Intake page** | L1 | Guided multi-step form (profile → processes → energy → materials → waste) with unit dropdowns + inline validation; CSV upload tab with column mapper and a validation report; on submit → redirect to the new factory's dashboard. |
| **Portfolio page** | X1 | Table of factories with severity chips; consultant switches between them. |
| Methodology page | I2 | Renders `/meta/*` tables with sources — the "why should I trust this" page for judges. |

---

## 8. Build order & team split

Three parallel tracks; the integration points are marked ⟂.

**Track A — Data & Engine (Python)**
1. Seed CSVs + 8 synthetic factories with 12-mo series (4 h)
2. `engine/` + tests (4 h) ⟂ A1
3. `hotspots` `benchmark` `confidence` (2 h)
4. `rootcause` rules + `recommender` (4 h) ⟂ A2
5. `simulator` + `actionplan` (3 h) ⟂ A3
6. `anomaly` (2 h)
7. `symbiosis` + `aggregation` (4 h) ⟂ A4

**Track B — API & Infra**
1. FastAPI skeleton, pydantic models, CORS, seed loader, SQLite first (3 h)
2. `/factories` `/diagnose` after ⟂ A2 (2 h)
3. `/simulate` `/plan` after ⟂ A3 (2 h)
4. `/intake` + CSV parser (4 h)
5. `/symbiosis` `/rollup` after ⟂ A4 (2 h)
6. docker-compose with Postgres/PostGIS, migrate from SQLite (3 h, P1)
7. Deploy (Render/Railway backend, Vercel frontend) (2 h)

**Track C — Frontend**
1. API client + wire dashboard to `/diagnose` (3 h) — needs B2
2. Simulator page + live twin re-render (6 h) — needs B3
3. Action plan page (3 h)
4. Regulator map (Leaflet + GeoJSON) (5 h) — needs B5
5. Intake form + CSV upload UI (5 h) — needs B4
6. Symbiosis panel + portfolio page + methodology page (4 h)
7. Demo polish: count-up animations, empty/loading states, second sector twin variant for a Vapi chemicals factory (reactor + distillation column + boiler) (4 h, P2)

**Milestones**
- **M1 (≈ hour 10):** dashboard shows engine-computed numbers for one factory; every value has a source + confidence. *(P0 half done)*
- **M2 (≈ hour 20):** simulator toggles interventions and the twin visibly calms; action plan generated. *(P0 complete — demoable)*
- **M3 (≈ hour 32):** regulator map with anonymised rollup; symbiosis matches; intake form creates a new factory end-to-end. *(P1 complete)*
- **M4 (≈ hour 40):** deployed, anomaly sparklines, portfolio view, methodology page, demo script rehearsed.

---

## 9. Demo script (what the judges see, in order)

1. **Regulator map** — Gujarat, cluster bubbles: "here's where avoidable CO₂ concentrates." Click Morbi.
2. **Factory dashboard** — twin loads; kiln pulsing red. Click it: "+45 % vs ASI benchmark; rule R3 fired — here's the evidence."
3. **Recommendations** — three costed circular fixes, ranked by tCO₂/₹ lakh, each with a confidence tag and source.
4. **Simulator** — tick heat-recovery + car-loading: smoke thins, ring goes amber, KPIs count down, payback 14 mo.
5. **Action plan** — 30/90/365 auto-generated.
6. **Symbiosis** — ETP sludge → brick unit 12 km away; both parties' ₹ and CO₂.
7. **Intake** — upload a CSV live, new factory appears with its own diagnosis in seconds.
8. **Methodology page** — "every number traces to MoEFCC/IPCC/BEE; synthetic data is labelled; cells < 3 factories are suppressed."

---

## 10. Explicit non-goals for the hackathon (say so on the slide)

- Live CPCB/BEE API pulls — we ship **sourced static extracts** with citation; the ETL scheduler is stubbed.
- IoT/SCADA, multi-language intake, Redis caching, real Postgres in prod — Phase 2.
- Any ML beyond z-score — by design (PDF §06).
