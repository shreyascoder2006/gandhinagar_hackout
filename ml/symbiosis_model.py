"""Symbiosis matcher — Phase 3c.

Matches one factory's tagged waste stream to another factory's accepted
input, scored 50% semantic similarity (MiniLM embeddings, compared via FAISS)
/ 25% quantity fit / 25% proximity — the weighting the Induscope vision doc
specifies. Writes results into the SymbiosisMatch table built (empty, by
design) in Phase 2.

This was blocked until now because Phase 1/2 only tracked aggregate
hazardous/general waste tonnage, not typed streams — see the waste-stream
schema added this phase (backend/app/db/models.py WasteStream/AcceptedInput,
data-pipeline/clean/waste_stream_profiles.csv).

Every CO2/value figure this produces is marked is_placeholder=True in the
database: no sourced embodied-carbon or material-value dataset exists for
these waste categories (see data-pipeline/LIMITATIONS.md #1 and the
SymbiosisMatch model's own docstring) — the semantic/quantity/proximity
scoring is real, the CO2-avoided/₹-value numbers attached to a match are
illustrative until a real dataset replaces them.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import SessionLocal  # noqa: E402
from app.db import models as db  # noqa: E402

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

MAX_DISTANCE_KM = 60.0  # matches the pre-existing frontend symbiosis radius (src/lib/symbiosis.ts)
MIN_SEMANTIC_SIMILARITY = 0.65
# Chosen from the actual score distribution on this dataset, not guessed:
# exact-tag matches (spent_solvent<->spent_solvent, cotton_waste<->cotton_waste)
# scored 0.84-0.86, while the one cross-tag match MiniLM proposed —
# textile_sludge (ETP dye/fibre sludge) matched against "cotton_waste:
# Recycled fibre feed" — scored only 0.459: textually related (both
# textile-sector waste) but NOT physically interchangeable (sludge cannot
# substitute for cutting-room fibre in a blend). 0.65 sits cleanly in the gap
# between the two clusters, keeping every legitimate exact-tag match while
# excluding that specific false positive. Re-check this value if the waste
# tag vocabulary changes (data-pipeline/clean/waste_stream_profiles.csv).
# Illustrative only — no sourced embodied-carbon dataset exists for these
# waste categories yet (see data-pipeline/LIMITATIONS.md #1). Every match
# this produces is written with is_placeholder=True because of this figure.
ILLUSTRATIVE_CO2_AVOIDED_T_PER_T = 0.30


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_candidates(session):
    streams = session.query(db.WasteStream).filter(db.WasteStream.tpy > 0).all()
    inputs = session.query(db.AcceptedInput).filter(db.AcceptedInput.max_tpy > 0).all()
    factories = {f.id: f for f in session.query(db.Factory).all()}
    return streams, inputs, factories


def embed_texts(model: SentenceTransformer, texts: list[str]) -> np.ndarray:
    vecs = model.encode(texts, normalize_embeddings=True)
    return np.asarray(vecs, dtype="float32")


def build_matches(streams, inputs, factories, model: SentenceTransformer) -> list[dict]:
    if not streams or not inputs:
        return []

    input_texts = [f"{i.tag.replace('_', ' ')}: {i.label}" for i in inputs]
    input_vecs = embed_texts(model, input_texts)

    index = faiss.IndexFlatIP(input_vecs.shape[1])  # inner product on normalised vectors = cosine similarity
    index.add(input_vecs)

    stream_texts = [f"{s.tag.replace('_', ' ')}: {s.label}" for s in streams]
    stream_vecs = embed_texts(model, stream_texts)

    k = min(5, len(inputs))
    similarities, neighbour_idx = index.search(stream_vecs, k)

    matches = []
    for s_idx, stream in enumerate(streams):
        provider = factories[stream.factory_id]
        for rank in range(k):
            i_idx = int(neighbour_idx[s_idx, rank])
            sim = float(similarities[s_idx, rank])
            accept = inputs[i_idx]
            recipient = factories[accept.factory_id]

            if recipient.id == provider.id:
                continue
            if sim < MIN_SEMANTIC_SIMILARITY:
                continue

            distance_km = haversine_km(provider.lat, provider.lon, recipient.lat, recipient.lon)
            if distance_km > MAX_DISTANCE_KM:
                continue

            quantity_fit = min(stream.tpy, accept.max_tpy) / max(stream.tpy, accept.max_tpy)
            proximity_score = max(0.0, 1.0 - distance_km / MAX_DISTANCE_KM)
            semantic_score = max(0.0, sim)
            overall_score = 0.5 * semantic_score + 0.25 * quantity_fit + 0.25 * proximity_score

            tonnage_matched = round(min(stream.tpy, accept.max_tpy), 1)
            # Real tonnage x each side's own real cost rate. The 60% capture
            # assumption on the recipient's side is a documented modelling
            # choice (same one the pre-existing frontend used), not sourced.
            provider_saving_inr = round(tonnage_matched * stream.disposal_cost_inr_per_t, 0)
            recipient_saving_inr = round(tonnage_matched * accept.virgin_cost_inr_per_t * 0.6, 0)
            matches.append({
                "provider_factory_id": provider.id,
                "recipient_factory_id": recipient.id,
                "waste_tag": stream.tag,
                "provider_label": stream.label,
                "recipient_label": accept.label,
                "quantity_tpy": tonnage_matched,
                "distance_km": round(distance_km, 1),
                "semantic_score": round(semantic_score, 3),
                "quantity_fit": round(quantity_fit, 3),
                "proximity_score": round(proximity_score, 3),
                "overall_score": round(overall_score, 3),
                "co2_avoided_tpy": round(tonnage_matched * ILLUSTRATIVE_CO2_AVOIDED_T_PER_T, 1),
                "provider_saving_inr": provider_saving_inr,
                "recipient_saving_inr": recipient_saving_inr,
            })

    matches.sort(key=lambda m: -m["overall_score"])
    return matches


def populate_db(matches: list[dict]) -> None:
    session = SessionLocal()
    try:
        session.query(db.SymbiosisMatch).delete()
        for m in matches:
            session.add(db.SymbiosisMatch(
                provider_factory_id=m["provider_factory_id"],
                recipient_factory_id=m["recipient_factory_id"],
                waste_tag=m["waste_tag"],
                quantity_tpy=m["quantity_tpy"],
                distance_km=m["distance_km"],
                semantic_score=m["semantic_score"],
                quantity_fit_score=m["quantity_fit"],
                proximity_score=m["proximity_score"],
                overall_score=m["overall_score"],
                co2_avoided_tpy=m["co2_avoided_tpy"],
                provider_saving_inr=m["provider_saving_inr"],
                recipient_saving_inr=m["recipient_saving_inr"],
                is_placeholder=True,  # co2_avoided_tpy is illustrative — see module docstring; costs are real
            ))
        session.commit()
    finally:
        session.close()


def main():
    print("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    session = SessionLocal()
    try:
        streams, inputs, factories = load_candidates(session)
    finally:
        session.close()

    print(f"{len(streams)} waste streams, {len(inputs)} accepted inputs, {len(factories)} factories.")

    matches = build_matches(streams, inputs, factories, model)
    print(f"Found {len(matches)} candidate matches "
          f"(semantic >= {MIN_SEMANTIC_SIMILARITY}, distance <= {MAX_DISTANCE_KM} km).")

    by_tag: dict[str, int] = {}
    for m in matches:
        by_tag[m["waste_tag"]] = by_tag.get(m["waste_tag"], 0) + 1
    print("By waste tag:", by_tag)

    populate_db(matches)
    print(f"Wrote {len(matches)} rows to the symbiosis_matches table.")

    ARTIFACTS_DIR.mkdir(exist_ok=True)
    with open(ARTIFACTS_DIR / "symbiosis_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "n_waste_streams": len(streams),
            "n_accepted_inputs": len(inputs),
            "n_matches": len(matches),
            "matches_by_tag": by_tag,
            "config": {
                "max_distance_km": MAX_DISTANCE_KM,
                "min_semantic_similarity": MIN_SEMANTIC_SIMILARITY,
                "score_weights": {"semantic": 0.5, "quantity_fit": 0.25, "proximity": 0.25},
                "embedding_model": "all-MiniLM-L6-v2",
            },
            "note": "co2_avoided_tpy uses an illustrative factor "
                    f"({ILLUSTRATIVE_CO2_AVOIDED_T_PER_T} tCO2e per tonne matched) — no sourced "
                    "embodied-carbon dataset exists for these waste categories yet. Every match "
                    "is written with is_placeholder=True for this reason. Semantic/quantity/"
                    "proximity scoring itself is real, computed from real factory data (tagged "
                    "waste streams sized off actual computed waste tonnage, real haversine "
                    "distance between real factory coordinates).",
            "sample_matches": matches[:10],
        }, f, indent=2)

    print(f"Saved report to {ARTIFACTS_DIR / 'symbiosis_report.json'}")


if __name__ == "__main__":
    main()
