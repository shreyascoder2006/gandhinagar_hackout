# backend

Phase 2 (database) + Phase 4 basics (API) of the Induscope build plan. FastAPI +
SQLAlchemy over a 12-table schema, seeded from `data-pipeline/`'s Phase-1 output by
actually running it through the engine/intelligence code below — nothing in the
database is hand-typed.

## What's real here

- `app/models.py`, `app/seed.py` — these were referenced everywhere (`from ..models
  import ...`, `from ..seed import ...`) but **did not exist** before this phase; the
  pre-existing `app/engine/*` and `app/intelligence/*` modules could not even be
  imported. They exist now, and `app/seed.py` reads from `data-pipeline/clean/*.csv`
  (the corrected, sourced Phase-1 output) rather than the older, partially-mis-cited
  `backend/data/*.json`.
- `app/db/` — the 12-table schema (SQLAlchemy models), Alembic migrations, and
  `seed_loader.py`, which loads `data-pipeline/synth/factories_synthetic.json` and
  computes every derived value (CO2e, benchmark deviation, severity, anomalies,
  root-cause text, sized recommendations) by calling the real functions in
  `app/engine` and `app/intelligence` — see `data-pipeline/LIMITATIONS.md` #5 for why
  this matters.
- `app/routers/` — FastAPI endpoints backed by the database, described below.

## A real bug this phase found and fixed

Seeding the actual 120-factory dataset through `app/intelligence/anomaly.py` for the
first time (it had never been run against real-scale data before) surfaced a genuine
methodological problem: its original defaults (`z_limit=2.0, rel_guard=0.08`) flagged
**~8% of all equipment-months** as anomalies (575 false positives vs. 26 real
injected ones — precision 0.04, recall 1.00). A threshold sweep against the labelled
ground truth found `z_limit=2.5, rel_guard=0.15` gives precision 0.57 / recall 0.92 —
now the default. Full writeup: `data-pipeline/LIMITATIONS.md` #7. This is exactly the
"false positives from normal behaviour" failure mode this whole project exists to
avoid (see repo-root `CLAUDE.md`) — worth fixing for real, not papering over.

## Running it

```bash
cd backend
pip install -r requirements.txt

# apply the schema (SQLite by default — see app/db/base.py for Postgres via DATABASE_URL)
python -m alembic upgrade head

# load data-pipeline output through the real engine/intelligence code
python -m app.db.seed_loader

# serve the API
python -m uvicorn app.main:app --port 8811
```

Then e.g.:
```bash
curl http://127.0.0.1:8811/api/clusters
curl http://127.0.0.1:8811/api/factories/morbi-ceramics-01
curl http://127.0.0.1:8811/api/factories/morbi-ceramics-01/benchmark
```

## Endpoints implemented (Phase 4, no ML dependency)

| Endpoint | Notes |
|---|---|
| `GET /api/clusters` | live factory + open-anomaly counts, not hardcoded |
| `GET /api/clusters/{id}/factories` | |
| `GET /api/factories/{id}` | totals + all equipment |
| `GET /api/factories/{id}/equipment` | |
| `GET /api/factories/{id}/emissions` | every record shows the formula's inputs (factor, source) |
| `GET /api/factories/{id}/benchmark` | global/India levels honestly reported `available: false` — no sourced dataset exists for them, not fabricated |
| `GET /api/factories/{id}/anomalies` | |
| `GET /api/factories/{id}/diagnosis/{anomaly_id}` | evidence chain from the real rule engine; `explanation_source: "deterministic_fallback"` until Phase 3's LLM lands |
| `GET /api/factories/{id}/recommendations` | sized per-equipment, not a flat catalog lookup |
| `GET /api/interventions`, `GET /api/emission-factors` | static catalogs |
| `GET /api/scale-projection` | methodology string is in the response itself, not separate docs |
| `POST /api/factories` | real onboarding — same engine, `anomaly_check_status: "not_available"` (honest, not faked) |
| `GET /api/factories/{id}/symbiosis-matches`, `GET /api/symbiosis/network` | **empty on purpose** — Phase 3, not built |

## What's NOT here yet (Phase 3 — ML layer)

LightGBM benchmark predictor, PyTorch autoencoder anomaly detector, MiniLM+FAISS
symbiosis matcher, Ollama LLM explainer, `ModelRegistry`. The current anomaly
detector and recommender are the deterministic rule-based code from the original
`IMPLEMENTATION_PLAN.md` (z-score, rule-tree, library lookup) — real and working, but
not the ML upgrade the Induscope vision doc describes. See `[[induscope_build_plan]]`
memory for the phase sequence and `[[induscope_chatbot_requirement]]` for the
explainer's added tool-calling requirement when that phase starts.
