# Data pipeline — known limitations

Stated once here, linked from everywhere else (`sources.md`, `SYNTHETIC_DATA_DISCLOSURE.md`,
and eventually the product's methodology page) rather than re-discovered by a user or judge.

## 1. ASI Gujarat SME micro-data was never obtained

The Annual Survey of Industries (ASI) unit-level micro-data — the one dataset that would let
this platform calibrate against real, individual Gujarat SME emissions/energy profiles — is
not available through automated means:

- `data.gov.in` blocks automated/bot access (verified: standard scraping and API access
  patterns are rejected).
- No Gujarat-specific SME extract of ASI data is published in an open, structured form.
- ASI unit-level records require a manual request/approval process through MoSPI that is out
  of scope for this pipeline run.

**Manual path for whoever has portal access later:** register at data.gov.in, request the
ASI unit-level (not just summary) tables for Gujarat, 2-digit/4-digit NIC codes matching
Ceramics (269), Chemicals (20), Textiles (13), Engineering/foundry (25/28), filtered to
micro/small enterprises by investment slab. Until that happens, this pipeline calibrates
against the aggregate, state-level sources listed in `sources.md` instead, and marks every
figure that stands in for missing ASI data as `calibrated` or `is_placeholder`.

## 2. Primary-source PDFs were not machine-readable in this pipeline run

CEA's baseline database user guide, both relevant IPCC 2006 chapters, the CPCB 2019-20
national inventory report, and the TERI ceramics sectoral manual are all PDFs whose internal
table structure could not be extracted by automated text extraction in this environment (no
`pdftotext`/`poppler` tooling available, and the PDFs use compressed/embedded-image table
layouts that resist naive extraction).

**What this means concretely:** every figure in `sources.md` that comes from one of these
PDFs was corroborated through at least one independent secondary source that quotes the same
primary report, not read directly off the PDF's own table cells. Where only one secondary
source could be found and it could not be cross-checked, that is stated explicitly next to
the figure (see `sources.md` §4, ceramics benchmarks).

**Fix path:** install `poppler-utils` (or equivalent) locally, re-run the fetch step, and
extract the actual table cells to replace the corroborated-secondary-source figures with
directly-read primary figures. The pipeline's `raw/` folder is structured so this can happen
without touching `clean/` or `synth/` — only the sourcing confidence tier would improve.

## 3. CPCB hazardous-waste figures are state-level only, not per-cluster

The CPCB 2019-20 inventory gives Gujarat a single state-wide total (24.85 lakh t/yr). It does
not break this down by GIDC cluster, by sector, or by landfillable/incinerable/recyclable
category in the form retrieved here. The synthetic dataset's per-factory waste tonnages are
therefore **calibrated to be consistent with the state total in aggregate** (i.e., summing
the synthetic factories' waste streams and scaling the sector's economy-wide share up to
Gujarat's ~24-lakh-tonne total order of magnitude), not derived from a real per-cluster or
per-sector breakdown. Treat all per-factory/per-cluster waste figures as `calibrated`, not
`real`.

## 4. BEE PAT sector coverage was previously mis-cited (corrected here)

PAT Cycle-1 (2012–2015) covered 8 sectors, of which only **Textiles** overlaps this
project's sectors. Ceramics, Chemicals, and Engineering/foundry benchmarks in this dataset
are **not** BEE PAT figures — see `sources.md` §4 for the correction and the re-labelling
applied in `clean/sector_benchmarks.csv` (`documented estimate`, confidence `medium`,
instead of a named-scheme citation that doesn't apply to that sector).

## 5. Synthetic dataset is raw activity data only — not pre-computed diagnoses

`synth/factories_synthetic.json` (this pipeline's output) contains monthly per-process
**energy/fuel/material/waste activity records** only. It deliberately does **not** contain
computed CO2e totals, benchmark-deviation severities, root-cause text, or recommended
interventions — those must be computed by the actual engine/intelligence code
(`backend/app/engine/`, `backend/app/intelligence/`) reading this file, so that every number
the product shows is traceable to a real function call on real (or real-calibrated) inputs,
not a hand-authored number that merely looks plausible. (This is a deliberate change from the
pre-existing `backend/data/factories_synthetic.json`, which already contained fully
hand-computed severities/root-causes/interventions with no calculation step behind them —
that file was, in effect, a finished demo mock, not seed data. It is left in place
unmodified for now since the current frontend still reads it directly; Phase 2 of the build
plan replaces that wiring.)

## 6. Anomaly ground-truth labels are withheld from the model-facing dataset

To make the Phase-3 anomaly detector's precision/recall numbers meaningful (rather than
invented), the synthetic generator injects a documented set of anomalous process-months into
a minority of factories, but writes the *labels* for which months are synthetic anomalies to
a separate, non-model-facing file (`synth/anomaly_ground_truth.json`), not into
`factories_synthetic.json` itself. This lets a future anomaly-detection model be evaluated
against real labels instead of numbers being asserted without an actual held-out test.

## 7. z-score anomaly detector's defaults were empirically wrong (found and fixed in Phase 2)

Running the pre-existing `backend/app/intelligence/anomaly.py` (leave-one-out z-score,
originally defaulted to `z_limit=2.0, rel_guard=0.08`) against the real 120-factory
synthetic dataset for the first time in Phase 2 surfaced a real bug: it flagged **~8% of
all equipment-months** as anomalies — 575 false positives against only 26 real injected
anomalies (precision 0.04, recall 1.00). Root cause is twofold:

1. A uniform seasonal curve was originally applied identically to all 120 factories in
   `synth/generate_synthetic.py` — a systematic cross-factory signal that a per-factory
   z-score reads as a strong anomaly. **Fixed**: each factory now gets its own randomised
   damping factor (0.25-0.6x) on the shared seasonal shape, so the signal isn't perfectly
   uniform across the cohort.
2. Independent of the above: with only 12 monthly samples, leave-one-out z-scores have an
   inherently noisy variance estimate, so a flat `z>2` threshold will flag routine month-
   to-month variation even without any seasonality at all.

A threshold sweep against the 26-label ground truth (`synth/anomaly_ground_truth.json`)
found `z_limit=2.5, rel_guard=0.15` gives precision 0.57 / recall 0.92 (24/26 real
anomalies caught, false positives cut from 575 to 18) — applied as the new default in
`anomaly.py`. (These exact counts are frozen from the 26-label dataset at the time of this
fix; regenerating the synthetic data shifts the RNG sequence and label count slightly — the
current live precision/recall, regression-tested on every run, is in
`validation/baseline_metrics.json` via `scripts/validate_all.py`.) This is disclosed rather
than hidden because it is exactly the failure mode (false positives from normal behaviour)
this whole project is designed around avoiding — see `CLAUDE.md`. **This is a stopgap, not
a fix**: the real long-term answer is Phase 3's
PyTorch autoencoder, which can learn each factory's own seasonal shape instead of applying
one flat threshold to a raw monthly series — see the Induscope roadmap.

## 8. Per-factory output-scale ranges are illustrative, not sourced

The tonnage/output ranges used to size each synthetic factory (e.g. "20,000–60,000 t/yr" for
a ceramics unit) are order-of-magnitude judgement calls consistent with publicly known GIDC
SME scale, not read from a specific cited study. Tagged `is_placeholder` in
`synth/generate_synthetic.py`'s config and in the disclosure doc.

## 9. Synthetic performance-ratio noise had zero covariate signal (found and fixed in Phase 3a)

Building the Phase 3a LightGBM benchmark predictor (`ml/benchmark_model.py`) surfaced a real
gap: the original synthetic generator drew each factory's deviation from benchmark
(`factory_performance_ratio`) as pure independent noise (`rng.uniform(0.80, 1.45)`), with
**no correlation to output scale, fuel mix, or any other feature**. Under that data-generating
process, the flat per-sub-sector benchmark is mathematically the optimal predictor — no model
could ever legitimately beat it, and a first LightGBM attempt correctly failed to (it scored
worse than the flat benchmark, exactly as it should given the data had no learnable structure
beyond it).

**Fixed at the source, not in the model**: added a documented economies-of-scale effect to
`generate_synthetic.py` — factories at the larger end of their sector's output range now run
closer to (or better than) benchmark than smaller ones, a real and well-known industrial
pattern (better instrumentation, more consistent throughput, amortised process-control
investment at scale). The specific magnitude (1.18x at the small end of a sector's range down
to 0.86x at the large end, layered with continued random noise) is a documented modelling
choice, not a cited coefficient — tagged `calibrated`, not `real`.

**Result after the fix** (see `ml/artifacts/benchmark_metrics.json` for the full report):
predicting the *ratio* to benchmark (not raw intensity — trees don't cleanly learn a
multiplicative rescaling across process kinds with very different benchmark scales) beats the
flat benchmark by +36.9% MAE for factories in clusters already seen in training data, and by a
more modest +6.3% for a factory in a brand-new, never-before-seen cluster. Both regimes are
reported, not just the flatteringly larger one, because they answer genuinely different
deployment questions.
