"""Pydantic domain models shared by app/engine and app/intelligence.

These were referenced by every engine/intelligence module (`from ..models import ...`)
but never actually existed in the repo — the modules could not be imported at all
before this file was added. Field names here are load-bearing: they match exactly
what engine/intelligence code already reads/writes (co2eT, z, anomaly, shareOfTotal,
actualIntensity, benchmarkIntensity, etc.) so no existing logic needed to change.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

Severity = Literal["ok", "warn", "crit"]


class Issue(BaseModel):
    row: int
    level: Literal["error", "warning"]
    message: str


class Activity(BaseModel):
    fuel: str
    unit: str
    quantity: Optional[float] = None


class MonthlyPoint(BaseModel):
    month: str
    co2eT: float
    z: float = 0.0
    anomaly: bool = False


class ProcessNode(BaseModel):
    id: str
    label: str
    kind: str
    co2eTpy: float
    shareOfTotal: float
    actualIntensity: float
    benchmarkIntensity: float
    severity: Severity
    monthly: list[MonthlyPoint] = []


class Factory(BaseModel):
    id: str
    name: str
    sector: str
    cluster: str
    nodes: list[ProcessNode] = []


class Intervention(BaseModel):
    id: str
    title: str
    category: str
    capexInr: float
    annualSavingInr: float
    co2ReductionTpy: float
    paybackMonths: int
    confidence: Literal["high", "medium", "low"]
    description: str
    circularityGainPct: Optional[float] = None


class RuleHit(BaseModel):
    rule: str
    title: str
    evidence: dict
