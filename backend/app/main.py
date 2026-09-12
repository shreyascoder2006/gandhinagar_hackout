from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import catalog, clusters, factories, onboarding

app = FastAPI(
    title="Induscope API",
    description="Circular Carbon Intelligence backend — Phase 2/4 of the build plan. "
                "Every computed field traces to a real function call in app/engine or "
                "app/intelligence over real-or-calibrated data (data-pipeline/). "
                "Symbiosis matching and LLM explanations are Phase 3 (not yet built) — "
                "endpoints for them return empty/fallback rather than fabricated output.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only — tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "internal error", "type": type(exc).__name__})


app.include_router(clusters.router)
app.include_router(factories.router)
app.include_router(catalog.router)
app.include_router(onboarding.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
