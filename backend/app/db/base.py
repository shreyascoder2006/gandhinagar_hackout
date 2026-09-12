"""DB engine/session setup.

Default is a local SQLite file — no Postgres server is available in this
environment (verified: no pg_config/psql on PATH). This mirrors the original
IMPLEMENTATION_PLAN.md's own explicit fallback ("if Docker fights us, the same
code runs on SQLite ... with zero engine changes") and the Induscope roadmap's
"free-tier managed Postgres" plan — set DATABASE_URL to a Postgres DSN
(e.g. `postgresql+psycopg2://user:pass@host/db`) for that, unchanged code.
"""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_SQLITE_URL = f"sqlite:///{BACKEND_DIR / 'induscope.db'}"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_SQLITE_URL)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_session() -> Session:
    return SessionLocal()
