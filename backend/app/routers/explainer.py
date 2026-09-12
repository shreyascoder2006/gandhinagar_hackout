"""Wires ml/explainer.py (Phase 3d — tool-calling Ollama explainer) into the
API. Kept as a thin adapter: all the actual logic (tool-calling loop,
deterministic fallback, the verified_data guardrail) lives in ml/explainer.py
so it stays testable standalone without a running server.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import models as db
from ..db.base import SessionLocal
from ..deps import get_db

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.explainer import ask as explainer_ask, ask_stream as explainer_ask_stream  # noqa: E402

router = APIRouter(prefix="/api/factories", tags=["explainer"])
global_router = APIRouter(prefix="/api", tags=["explainer"])


class AskIn(BaseModel):
    question: str


class GlobalAskIn(BaseModel):
    question: str
    factory_id: str | None = None  # optional "currently in view" context; the
    # explainer can also answer cross-factory questions (rank_factories,
    # search_factory, get_cluster_summary) that don't need one at all.


class AskOut(BaseModel):
    answer: str
    verified_data: dict | None
    source: str  # "ollama:llama3.1:8b" | "deterministic_fallback" | "... (empty-result guard)"


@router.post("/{factory_id}/ask", response_model=AskOut)
def ask_factory(factory_id: str, payload: AskIn, session: Session = Depends(get_db)):
    """Ask a free-text question about a factory. Compound questions ("which
    strategy is best under a budget") are answered by the LLM actually
    calling the real simulator/optimizer (backend/app/intelligence/
    simulator.py) — not by template-matching keywords. `verified_data` is
    the tool's raw return value, always trustworthy even if the LLM's prose
    misstates a number (a real failure mode found and guarded against — see
    ml/explainer.py docstring on `ask()`)."""
    factory = session.get(db.Factory, factory_id)
    if factory is None:
        raise HTTPException(404, f"factory '{factory_id}' not found")

    result = explainer_ask(payload.question, factory_id)

    session.add(db.Explanation(
        subject_type="factory_question", subject_id=factory_id,
        text=result["answer"], generated_by=result["source"],
    ))
    session.commit()

    return AskOut(answer=result["answer"], verified_data=result.get("verified_data"), source=result["source"])


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@global_router.post("/ask/stream")
def ask_global_stream(payload: GlobalAskIn):
    """Server-Sent Events version of POST /api/ask, for the chat widget.
    Streams {"type": "token", "text": ...} events as the LLM generates its
    final answer, then one {"type": "final", ...} event with the same shape
    AskOut returns — see ml/explainer.py's ask_stream() docstring for why
    this never risks streaming a fabricated answer (the empty-result safety
    check runs before generation starts, using the previous tool call's
    already-known result).

    Opens its own DB session (not the request-scoped one from Depends(get_db))
    because the generator outlives the normal request/response cycle that
    FastAPI's dependency teardown assumes."""
    def event_stream():
        session = SessionLocal()
        try:
            for event in explainer_ask_stream(payload.question, payload.factory_id):
                yield _sse_event(event)
                if event["type"] == "final":
                    session.add(db.Explanation(
                        subject_type="global_question", subject_id=payload.factory_id or "none",
                        text=event["answer"], generated_by=event["source"],
                    ))
                    session.commit()
        finally:
            session.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@global_router.post("/ask", response_model=AskOut)
def ask_global(payload: GlobalAskIn, session: Session = Depends(get_db)):
    """Chat-widget endpoint — no specific factory required. Handles
    cross-factory questions ("which factory is performing best", "what's
    wrong with X") via ml/explainer.py's rank_factories/search_factory/
    get_cluster_summary tools, as well as per-factory ones if `factory_id`
    (the page currently in view, if any) is supplied as context."""
    result = explainer_ask(payload.question, payload.factory_id)

    session.add(db.Explanation(
        subject_type="global_question", subject_id=payload.factory_id or "none",
        text=result["answer"], generated_by=result["source"],
    ))
    session.commit()

    return AskOut(answer=result["answer"], verified_data=result.get("verified_data"), source=result["source"])
