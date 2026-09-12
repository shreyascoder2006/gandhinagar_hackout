# Induscope — Circular Carbon Intelligence

**A diagnostic-and-decision platform for Gujarat's industrial SMEs.** It reads a
factory's energy, material, and waste data; flags where its emissions concentrate and
why; recommends costed circular-economy interventions; simulates their combined
impact; and rolls all of that up into an anonymised regulator-facing view across
Gujarat's industrial clusters.

Built for **HackOut'26**, source spec: *Circular Carbon Ecosystem* (Jeevesh Bodhani,
DJSCE).

---

## The problem

Gujarat's industrial clusters — ceramics in Morbi, chemicals in Vapi and Ankleshwar,
textiles in Surat, engineering in Rajkot — run thousands of small manufacturers with
**no per-process emissions visibility** and no systematic way to find a nearby factory
that could use their waste as input. A plant operator can't see *where* their carbon
footprint concentrates, *why* it deviates from what's normal for their sub-sector, or
*what* to actually do about it. Regulators, in turn, have no evidence base for
targeting efficiency schemes.

## Our approach

Rather than build a slick demo on invented numbers, we split the work into two
disciplines that get built and verified independently, then wired together:

1. **A real calculation core** — every emissions figure traces back to a sourced
   emission factor (CEA grid factor, IPCC 2006 fuel factors) and a documented
   formula, not a guess. Every benchmark is labelled with exactly how confident it
   is and why (a real government scheme, or a documented estimate — never blurred
   together).
2. **A synthetic-but-calibrated dataset**, because real Gujarat SME-level emissions
   data isn't publicly obtainable (we tried — see [Limitations](#honesty-about-what-isnt-real)
   below). 120 factories across 9 real Gujarat industrial clusters, generated with a
   seeded, reproducible script, calibrated to real sourced ratios wherever a real
   ratio exists.

Every number in the product is tagged `real`, `calibrated`, or `is_placeholder`
somewhere in its lineage — nothing is asserted without a way to check where it came
from. That discipline is documented in [`data-pipeline/`](data-pipeline/) and
[`backend/`](backend/) and is the main thing that separates this from a hackathon
demo running on hardcoded numbers.

---

## What's built and working right now

```
data-pipeline/  →  backend (FastAPI + SQLite/Postgres)  →  frontend (React + 3D twin)
   real sources        real engine + rule-based    ↑         live dashboard, simulator,
   + synthetic          intelligence, seeded from   |         action plan, regulator
   120-factory          the pipeline output        ml/        rollup, symbiosis network —
   dataset                                  benchmark model,   all real data
                                             symbiosis matcher,
                                             tool-calling explainer
```

- **Data pipeline** — sources real CEA/IPCC emission factors and CPCB waste figures,
  documents exactly where the "9 real Gujarat clusters" and sector benchmarks come
  from, and generates a reproducible 120-factory synthetic dataset (raw monthly
  activity data only — no pre-computed answers baked in).
- **Backend (FastAPI + SQLAlchemy, 14-table schema)** — every factory's CO₂e,
  benchmark deviation, anomaly flags, root-cause diagnosis, and sized interventions
  are computed by real Python functions reading the pipeline's raw data, not
  hand-typed. A working onboarding endpoint (`POST /api/factories`) runs a real SME's
  own submitted numbers through the exact same engine used for the 120 seeded
  factories, including the real sourced-benchmark diagnosis.
- **ML layer** (`ml/`) — a LightGBM benchmark predictor, a MiniLM+FAISS symbiosis
  matcher, and a tool-calling Ollama explainer that can run a real optimizer to
  answer "which strategy is best" or "which factory needs the most help" — plus a
  PyTorch anomaly model that was built, evaluated, and honestly rejected. See
  `ml/README.md`.
- **Live chat assistant** — the floating widget calls the real explainer above
  (`POST /api/ask`), not a keyword-matching script. It answers cross-factory
  questions ("which factory is worst", "what's wrong with X") as well as
  per-factory optimization ones, and always shows the raw database result behind
  its answer.
- **Scale-impact panel** (Regulator page) — an animated, slider-driven "if this
  scaled to N Gujarat factories" projection backed by `GET /api/scale-projection`,
  including an illustrative carbon-credit valuation (see below).
- **One-click decarbonization report** (`/report/:factoryId`) — diagnosis + action
  plan + ROI as a single printable/shareable page, the artifact an SME owner can
  actually take to a bank or board.
- **Frontend (React + Three.js)** — a 3D digital-twin dashboard per factory, a
  what-if simulator (toggle interventions, watch CO₂/cost/payback recompute live), a
  costed 30/90/365-day action plan, a consultant portfolio view, a regulator rollup
  map across all 9 clusters, and a live industrial-symbiosis network — all rendering
  live data from the backend above, not mock JSON.

Full endpoint list and how to run the backend: [`backend/README.md`](backend/README.md).
Full data-sourcing detail: [`data-pipeline/README.md`](data-pipeline/README.md),
[`data-pipeline/sources.md`](data-pipeline/sources.md). ML component detail:
[`ml/README.md`](ml/README.md).

### Running it locally

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python -m alembic upgrade head          # create the schema
python -m app.db.seed_loader            # load + compute the 120-factory dataset

# 2. ML layer (same terminal, repo root) — populates symbiosis matches + model artifacts
cd .. && pip install -r ml/requirements.txt
python -m ml.benchmark_model
python -m ml.symbiosis_model            # needs internet on first run (downloads MiniLM)
# python -m ml.anomaly_model is optional — its model isn't used in production, see ml/README.md
# the explainer (ml/explainer.py) needs a local Ollama server with llama3.1:8b pulled;
# it falls back to a deterministic (but still real) answer if Ollama isn't running

# 3. Start the API (from backend/)
cd backend && python -m uvicorn app.main:app --port 8811

# 4. Frontend (separate terminal, repo root)
npm install
npm run dev                             # opens on http://localhost:5173 (or similar)
# then open http://localhost:<port>/app.html
```

The frontend expects the API at `http://localhost:8811` by default (override with
`VITE_API_BASE_URL`).

---

## Honesty about what isn't real

- **No live Gujarat SME dataset exists.** The Annual Survey of Industries (ASI)
  micro-data that would let us calibrate against real individual factories is not
  publicly downloadable — `data.gov.in` blocks automated access and publishes no
  Gujarat-specific extract. We documented this rather than pretend otherwise; see
  [`data-pipeline/LIMITATIONS.md`](data-pipeline/LIMITATIONS.md).
- **Circularity ratio currently reads 0%** for every factory — there's no
  recovered-material ledger yet, so this is the honest value, not a placeholder
  guess.
- **Carbon-credit values are illustrative.** India's CCTS (compliance carbon market)
  had not published an official floor/forbearance price as of this writing — the
  ₹900/tCO2e used is the midpoint of commonly-cited analyst estimates (₹600-1,200),
  not a mandated price. Every figure derived from it is flagged accordingly; see
  `backend/app/carbon_credit.py`.
- **The chat widget can occasionally need a retry on empty lookups.** Testing found
  the underlying LLM will fabricate a nonexistent factory if a tool call happens to
  return no data (e.g., a misspelled cluster filter) — guarded against structurally
  so this now fails as an honest "I don't have that" instead, but is worth knowing
  the failure mode existed. See `ml/LIMITATIONS.md`.
- **Symbiosis CO₂-avoided figures are illustrative.** Matching itself is real (see
  below), but no sourced embodied-carbon dataset exists for these waste categories,
  so `co2_avoided_tpy` is always flagged `is_placeholder` — the ₹-savings figures
  and the match scores themselves are real.
- **The anomaly detector is a tuned rule, not a model.** A PyTorch autoencoder was
  built and rigorously evaluated but did not beat the existing z-score rule on this
  dataset (see `ml/LIMITATIONS.md`) — kept out of production rather than shipped
  anyway. The z-score rule itself was empirically retuned after we found its
  original defaults gave an 8% false-positive rate (`data-pipeline/LIMITATIONS.md` #7).
- **The LLM explainer can misstate its own tool results.** Testing found llama3.1:8b
  occasionally confuses Indian lakh/crore units when restating a correct number in
  prose. Guarded structurally, not just by prompt-tuning — see `ml/LIMITATIONS.md`.
- **Onboarding a new factory doesn't yet capture waste data** — the intake form
  collects it but the API payload doesn't carry it through, so a freshly onboarded
  factory always shows 0 t/yr waste. See `backend/README.md`.

---

## Roadmap — what's left, and how to approach it

### Phase 3 — ML layer — **done**
All four planned components exist, are validated against real ground truth (or
honestly rejected), and are reachable through the API:
- **LightGBM benchmark predictor** (`ml/benchmark_model.py`) — beats the flat
  benchmark by roughly +36.9% MAE for factories in already-seen clusters, +6.3% for a
  brand-new cluster (exact figures drift slightly on dataset regeneration; live,
  regression-tested numbers are in `validation/baseline_metrics.json`, checked by
  `scripts/validate_all.py` / `make validate`). Building it surfaced and fixed a real
  bug in the Phase 1 synthetic generator (deviation-from-benchmark noise had zero
  correlation to any feature, making the flat benchmark unbeatable by construction) — see
  `data-pipeline/LIMITATIONS.md` #9.
- **PyTorch anomaly autoencoder** (`ml/anomaly_model.py`) — built and evaluated,
  does **not** beat the z-score rule on this dataset. Documented and kept out of
  production rather than deployed anyway — see `ml/LIMITATIONS.md`.
- **Symbiosis matcher** (`ml/symbiosis_model.py`) — MiniLM + FAISS, 50% semantic /
  25% quantity-fit / 25% proximity, 140 real matches live via
  `/api/symbiosis/network`. A real false-positive match was found and fixed by
  raising the similarity threshold to the actual gap in the data.
- **Tool-calling explainer** (`ml/explainer.py`, Ollama `llama3.1:8b`) — answers
  compound questions like *"which intervention combination gives the best result
  under a budget"* by actually calling a real optimizer
  (`backend/app/intelligence/simulator.py`, a new brute-force-optimal search over
  intervention combinations), not by guessing. Live via
  `POST /api/factories/{id}/ask`.
- **`ModelRegistry`** (`ml/registry.py`) — lazy-loads and caches all of the above,
  reports what's actually active per component via `GET /api/ml/status`.

See `ml/README.md` for how each was built, validated, and — for the autoencoder —
why it was rejected.

### Phase 5 tail — mostly done
- ~~Wire the Intake page to `POST /api/factories`~~ **done** — creating a new
  factory now runs through the real backend engine, including a fix so onboarded
  factories get the same real sourced-benchmark severity/root-cause diagnosis as
  seeded ones (previously hardcoded to a fake "on benchmark" state).
  *Editing* an already-onboarded factory still runs locally only — no
  `PATCH /api/factories/{id}` endpoint exists yet.
- ~~Populate `wasteStreams`/`acceptedInputs` from real backend data~~ **done** as
  part of Phase 3c.
- Remaining: onboarding doesn't capture waste data (see Known Limitations above).

### Phase 6 — deployment (not started)
Everything below runs on a free tier or infrastructure already in hand — no paid
infra needed:
- **Database:** migrate SQLite → Neon or Supabase (free-tier Postgres), using the
  existing Alembic migration history unchanged.
- **API:** Render or Fly.io free tier, CPU-only (matches how it already runs).
- **Frontend:** Vercel free tier.
- **LLM:** keep the deterministic fallback as the production default; local Ollama
  stays a dev-time nicety, not a deploy dependency.

### Longer-term (contingent on real adoption)
Per-organisation auth, an admin/ops triage view for cluster managers, email/SMS
alerting on new high-confidence anomalies, and a sourced replacement for every
figure currently marked `is_placeholder` (especially symbiosis CO₂/value estimates).

---

## Project structure

```
data-pipeline/     # Phase 1 — sourced data, 120-factory synthetic generator, disclosure docs
backend/           # Phase 2 & 4 — FastAPI + SQLAlchemy + Alembic, engine + intelligence code
  app/engine/        deterministic unit/CO2e/intensity calculations
  app/intelligence/  hotspot ranking, anomaly detection, root-cause rules, recommender, simulator/optimizer
  app/db/            ORM models, migrations, seed loader
  app/routers/       API endpoints
ml/                # Phase 3 — benchmark predictor, anomaly model (rejected), symbiosis matcher, explainer, registry
  benchmark_model.py   LightGBM, beats flat benchmark for known clusters
  anomaly_model.py     PyTorch autoencoder — built, evaluated, does NOT beat the z-score rule (see LIMITATIONS.md)
  symbiosis_model.py   MiniLM + FAISS + real proximity, writes symbiosis_matches
  explainer.py         tool-calling Ollama agent + deterministic fallback
  registry.py          lazy-loading access point + honest status reporting for all of the above
src/               # Frontend — React 19 + Vite + Three.js (digital twin) + Zustand
  lib/api.ts             typed fetch client to the backend
  lib/apiAdapter.ts      maps backend responses onto the frontend's data model
  lib/onboardingAdapter.ts  maps the Intake page's local form state onto the real onboarding payload
  pages/                 dashboard, simulator, action plan, portfolio, regulator, intake
```

## Regression gate

Three evaluation harnesses got built ad-hoc during development (anomaly-detector
ground-truth precision/recall, benchmark-model cluster-holdout, symbiosis threshold
sweep) — `scripts/validate_all.py` formalizes them into one command that regenerates
the dataset, reseeds the database, re-runs all three, smoke-tests the live API via
`TestClient`, and compares every number against a recorded, tolerance-banded baseline
in `validation/baseline_metrics.json`. It exits non-zero — and should block a merge —
if anything regresses past its floor.

```bash
make validate          # full gate, matches what CI runs
make validate-fast     # skips the MiniLM load + PyTorch retrain sanity check
make update-baseline   # after a deliberate, reviewed change, accept new numbers
```

Wired into GitHub Actions on every PR and push to `main`/`master`
(`.github/workflows/validate.yml`). Never hand-edit `validation/baseline_metrics.json`
to make a failing check pass — use `--update-baseline` and review the diff.

## Tech stack

Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Three Fiber, Zustand,
Recharts, Leaflet.
Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic.
ML: LightGBM, PyTorch (CPU), sentence-transformers (MiniLM), FAISS, Ollama (`llama3.1:8b`).
Data: pandas-free CSV/JSON pipeline, sourced from CEA / IPCC 2006 / CPCB / BEE.

---

*Every status claim in this README reflects the codebase as it actually runs, not as
intended — see the linked docs under `data-pipeline/`, `backend/`, and `ml/` for full
citations and the unabridged limitations lists.*
