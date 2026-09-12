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
   real sources        real engine + rule-based             live dashboard, simulator,
   + synthetic          intelligence, seeded from            action plan, regulator
   120-factory          the pipeline output                  rollup — all real data
   dataset
```

- **Data pipeline** — sources real CEA/IPCC emission factors and CPCB waste figures,
  documents exactly where the "9 real Gujarat clusters" and sector benchmarks come
  from, and generates a reproducible 120-factory synthetic dataset (raw monthly
  activity data only — no pre-computed answers baked in).
- **Backend (FastAPI + SQLAlchemy, 12-table schema)** — every factory's CO₂e,
  benchmark deviation, anomaly flags, root-cause diagnosis, and sized interventions
  are computed by real Python functions reading the pipeline's raw data, not
  hand-typed. A working onboarding endpoint (`POST /api/factories`) runs a real SME's
  own submitted numbers through the exact same engine used for the 120 seeded
  factories.
- **Frontend (React + Three.js)** — a 3D digital-twin dashboard per factory, a
  what-if simulator (toggle interventions, watch CO₂/cost/payback recompute live), a
  costed 30/90/365-day action plan, a consultant portfolio view, and a regulator
  rollup map across all 9 clusters — all rendering live data from the backend above,
  not mock JSON.

Full endpoint list and how to run the backend: [`backend/README.md`](backend/README.md).
Full data-sourcing detail: [`data-pipeline/README.md`](data-pipeline/README.md),
[`data-pipeline/sources.md`](data-pipeline/sources.md).

### Running it locally

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
python -m alembic upgrade head          # create the schema
python -m app.db.seed_loader            # load + compute the 120-factory dataset
python -m uvicorn app.main:app --port 8811

# 2. Frontend (separate terminal, repo root)
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
- **Symbiosis matching (waste → another factory's input) isn't built yet.** The
  backend has no waste-stream tagging or matching logic, so the Symbiosis panel and
  CO₂ Exchange page honestly show empty/no-matches rather than fabricated pairings.
- **Circularity ratio currently reads 0%** for every factory — there's no
  recovered-material ledger yet, so this is the honest value, not a placeholder
  guess.
- **No ML yet.** Anomaly detection is a tuned z-score rule (empirically retuned
  against labelled ground truth after we found its original defaults gave an 8%
  false-positive rate — see `data-pipeline/LIMITATIONS.md` #7), and recommendations
  come from a curated intervention library, not a trained model. The heavier ML
  layer (below) is the next major phase.

---

## Roadmap — what's left, and how to approach it

### Phase 3 — ML layer (not started, the largest remaining phase)
This is where the product goes from "rule-based but honest" to the full vision:
1. **LightGBM benchmark predictor** — learn expected energy/waste intensity from a
   factory's profile instead of a single fixed benchmark number per sub-sector.
2. **PyTorch anomaly autoencoder** — replace the z-score rule with a model that
   learns each factory's own seasonal shape, addressing the false-positive issue
   documented in Phase 2 more fundamentally than a threshold tweak can.
3. **Symbiosis matcher (sentence-transformers + FAISS)** — semantic matching of
   waste-stream descriptions to unmet material needs across the cluster network.
   This needs waste-stream tagging data added to the schema first (currently only
   aggregate hazardous/general tonnage is tracked).
4. **LLM explainer (local Ollama + deterministic fallback)** — turn a diagnosis into
   plain language. **Important scope note carried over from planning:** this should
   be built as a tool-calling explainer that can *invoke* the simulator/optimizer
   functions to answer compound questions like *"which intervention combination
   gives the best result here?"* — not just template-fill a canned explanation.
5. Wrap all of the above in a versioned `ModelRegistry` so the API loads models
   lazily and consistently.

**Approach:** build and validate each model standalone against the 120-factory
dataset (with held-out ground truth, the way Phase 1 already set up the anomaly
labels) before wiring it into the API — don't skip straight to integration.

### Phase 5 tail — finish the frontend wiring
- Wire the **Intake page** (onboarding a new factory) to the real
  `POST /api/factories` endpoint. It currently still runs its original,
  fully-client-side calculation — functional, just not yet backed by the database.
- Once Phase 3's symbiosis matcher exists, populate `wasteStreams` /
  `acceptedInputs` from real backend data instead of leaving them empty.

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
  app/intelligence/  hotspot ranking, anomaly detection, root-cause rules, recommender
  app/db/            ORM models, migrations, seed loader
  app/routers/       API endpoints
src/               # Frontend — React 19 + Vite + Three.js (digital twin) + Zustand
  lib/api.ts           typed fetch client to the backend
  lib/apiAdapter.ts    maps backend responses onto the frontend's data model
  pages/               dashboard, simulator, action plan, portfolio, regulator, intake
```

## Tech stack

Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Three Fiber, Zustand,
Recharts, Leaflet.
Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic.
Data: pandas-free CSV/JSON pipeline, sourced from CEA / IPCC 2006 / CPCB / BEE.

---

*Every status claim in this README reflects the codebase as it actually runs, not as
intended — see the linked docs under `data-pipeline/` and `backend/` for full
citations and the unabridged limitations list.*
