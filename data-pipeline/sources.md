# Sources — Induscope data pipeline

Every figure the product shows traces to one of the rows below, or is explicitly tagged
`is_placeholder` in the data. This file is the audit trail: what was fetched, on what date,
what number was extracted, and where the extraction is imprecise or a secondary source had
to stand in for a primary one that could not be parsed. Nothing below is invented — where a
figure could not be verified, that is stated instead of guessed.

Retrieved 2026-09-12 (see per-row dates where a source has multiple versions).

---

## 1. CEA CO2 Baseline Database — grid emission factor

- **Primary source:** Central Electricity Authority, *CO2 Baseline Database for the Indian
  Power Sector, User Guide, Version 19.0* (published January 2024).
  https://cea.nic.in/wp-content/uploads/baseline/2024/01/User_Guide__Version_19.0.pdf
- **Extraction note:** the PDF is a scanned/compressed layout that automated text extraction
  could not reliably parse in this pipeline run. The figures below are corroborated via an
  independent secondary source that reproduces the same v19.0 report in plain text
  (reclimatize.in, "India's Grid Emission Factor: CEA Calculation, Current Values and CCTS
  Scope 2 Impact") and cross-checked against a second independent web summary. Both agree to
  3 significant figures, so confidence is **high** despite the primary PDF not being directly
  machine-readable here.
- **Figures (FY2023-24, CEA v19.0, Jan 2024):**
  - Weighted average emission factor (WAEF): **0.727 tCO2/MWh = 0.727 kgCO2/kWh**
  - Combined margin: 0.757 tCO2/MWh
  - Build margin: 0.552 tCO2/MWh
- **Correction applied:** the pre-existing `backend/data/emission_factors.json` in this repo
  cited `0.71 kgco2ePerUnit` with the label "CEA CO2 Baseline Database v19 ... 2023-24". That
  number is actually the *v21.0* (published December 2025) FY2024-25 figure, not the v19.0
  FY2023-24 figure — the two got conflated. This pipeline uses the correctly version-matched
  **0.727 kgCO2/kWh** for v19.0/FY2023-24. If the product is updated to cite CEA v21.0 instead,
  the figure should become 0.710 kgCO2/kWh and every place citing "v19.0" must be relabeled
  "v21.0" — do not mix the version label from one release with the value from another.
- **Confidence tier:** `real` / high.

## 2. IPCC 2006 Guidelines — default fuel emission factors

- **Primary source:** IPCC, *2006 IPCC Guidelines for National Greenhouse Gas Inventories*,
  Volume 2 (Energy), Chapter 1 (Introduction) Table 1.4 and Chapter 2 (Stationary Combustion)
  Table 2.2 (same default factors, restated for combustion accounting).
  https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf
  https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf
- **Extraction note:** both PDFs are also compressed/non-machine-readable in this pipeline
  run. The values below are the well-established, widely-republished IPCC 2006 default
  factors (used verbatim in national GHG inventories worldwide, including India's BUR/NC
  submissions), cross-checked against the pre-existing repo values which already carried
  correct citations — no discrepancy found, all values below match what was already in
  `backend/data/emission_factors.json`.
- **Figures (kg CO2 per GJ, net calorific value basis):**
  | Fuel | kg CO2 / GJ | Typical NCV used for canonical-unit conversion |
  |---|---|---|
  | Natural gas | 56.1 | 36.4 MJ/SCM |
  | Diesel / HSD (gas/diesel oil) | 74.1 | 36.3 MJ/L |
  | Residual fuel oil / furnace oil | 77.4 | 40.2 MJ/L |
  | LPG | 63.1 | 47.3 MJ/kg |
  | Other bituminous coal (proxy for Indian non-coking coal) | 94.6 | ~18 GJ/t (India-specific NCV, MoEFCC BUR-3, not an IPCC default) |
  | Petroleum coke | 97.5 | 32.5 GJ/t |
- **Confidence tier:** `real` / high, except the coal NCV (18 GJ/t) which is India-specific
  (MoEFCC) rather than an IPCC default — tagged `real` but from a second primary source.

## 3. CPCB National Inventory on Hazardous and Other Wastes, 2019-20

- **Primary source:** Central Pollution Control Board, *National Inventory on Generation and
  Management of Hazardous and Other Wastes (2019-20)*.
  https://cpcb.gov.in/uploads/hwmd/Annual_Inventory2019-20.pdf
- **Extraction note:** the primary PDF's data tables could not be parsed automatically in
  this pipeline run (compressed image-table layout). The figures below are corroborated by
  two independent secondary sources that both cite the same CPCB 2019-20 inventory and agree
  exactly on the headline numbers:
  https://factly.in/data-gujarat-accounts-for-about-28-of-the-hazardous-waste-generated-in-india/
  (a second independent web summary of the same report, consulted via search, agreed to the
  same figures).
- **Figures (2019-20, all-India and Gujarat):**
  - India total hazardous waste generated: **87.82 lakh tonnes/year** (8,782,000 t/yr)
  - Gujarat total hazardous waste generated: **24.85 lakh tonnes/year** (2,485,000 t/yr) —
    **~28.3% of the national total**, the single largest state
  - Next largest: Maharashtra 9.99 lakh t/yr, Tamil Nadu 9.64 lakh t/yr
- **What this pipeline does NOT have:** a Gujarat-specific breakdown by district/GIDC
  cluster, or by landfillable/incinerable/recyclable category, or a documented count of
  hazardous-waste-generating units in Gujarat specifically. The primary PDF likely contains
  this breakdown but it could not be extracted here. **This is used only as a state-level
  calibration anchor** (average hazardous-waste-generation intensity per unit of industrial
  output for Gujarat as a whole) — the per-factory, per-cluster waste tonnages in the
  synthetic dataset are calibrated to be consistent with this state total in aggregate, not
  derived from a real per-cluster breakdown. See `LIMITATIONS.md`.
- **Confidence tier:** `real` (state total) / `calibrated` (per-factory allocation).

## 4. BEE PAT Scheme — sector energy-intensity benchmarks

- **Primary source:** Bureau of Energy Efficiency, Perform-Achieve-Trade (PAT) scheme
  documentation. https://beeindia.gov.in/en/programmes/perform-achieve-and-trade-pat
- **Important correction vs. the pre-existing repo:** `backend/data/interventions.json`
  cited "BEE UDIT" and "BEE PAT" as the source for ceramics and foundry/engineering
  intervention benchmarks. Verified via search: **PAT Cycle-1 (2012-15) covered only 8
  sectors — Aluminium, Cement, Chlor-Alkali, Fertilizer, Iron & Steel, Paper & Pulp, Thermal
  Power, and Textiles.** Ceramics and Chemicals were *not* in PAT Cycle-1; they were only
  under consideration for a *future* PAT expansion at the time these sources were written.
  So a "BEE PAT Cycle-1" citation is only accurate for **Textiles** in this dataset —
  citing it for Ceramics, Chemicals, or Engineering/foundry benchmarks would be a real
  sourcing error and has been corrected in `clean/sector_benchmarks.csv`.
- **Ceramics substitute source:** TERI, *"Widening the coverage of PAT Scheme — Sectoral
  Manual: Ceramic Industry"* (2021), a study specifically commissioned to assess ceramics
  for future PAT inclusion. https://www.teriin.org/sites/default/files/2021-08/Ceramic_Report%20.pdf
  — the PDF's internal SEC tables could not be machine-extracted in this pipeline run,
  so its benchmark *values* are not used; it is cited here only to correctly label the
  ceramics benchmark figures already in the repo's `sector_templates.json` as
  **"documented cleaner-production/audit-literature estimate," confidence `medium`**,
  not "BEE PAT," until the TERI report's own SEC tables can be manually transcribed.
- **Chemicals / Engineering:** no BEE PAT or TERI-equivalent primary source was found for
  these sectors in this session. Their existing benchmark values are retained but
  relabeled `documented estimate (cleaner-production audit norms), confidence: medium` —
  not tied to a specific named government publication, matching the honesty discipline the
  Induscope vision doc requires (never assert a source that isn't real).
- **Confidence tier:** `real` (Textiles, PAT Cycle-1) / `documented estimate, medium`
  (Ceramics, Chemicals, Engineering).

## 5. Gujarat industrial clusters — geography

- **Source:** publicly known GIDC (Gujarat Industrial Development Corporation) industrial
  estate locations and their dominant sectors, as reported in Gujarat government/GIDC
  materials and general industry press (Morbi ceramics cluster, Vapi/Ankleshwar/Dahej
  chemical clusters, Surat/Vatva textile-and-dyeing, Rajkot engineering/foundry, Jamnagar
  brass parts + petrochemicals, Alang ship-recycling yard near Bhavnagar). Coordinates are
  approximate cluster/town centroids (2-decimal-degree precision), not surveyed GIS
  boundaries.
- **Confidence tier:** `real` (cluster existence, dominant sector, district) / `calibrated`
  (approximate centroid coordinates, ±a few km).

---

## What is NOT sourced (and must never be presented as if it were)

- Individual factory identities, names, exact locations, and time series — 100%
  `synthetic`, generated by `synth/generate_synthetic.py`, seeded and reproducible.
- Per-tonne SEC (specific energy consumption) *baselines* used to size individual process
  benchmarks beyond what's listed above — `documented estimate` or `is_placeholder` per
  `LIMITATIONS.md`.
- Symbiosis embodied-carbon and material-value figures — no sourced dataset exists yet;
  100% `is_placeholder`.
- Any factory-level ASI (Annual Survey of Industries) Gujarat SME micro-data — never
  obtained; see `LIMITATIONS.md`.
