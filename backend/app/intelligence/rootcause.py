"""Root-cause decision tree R1–R6 — ordered, explainable rules over known variables.

Each rule = predicate + evidence + template. First two matching rules are returned.
All output is tagged as inference (never fact).
"""
from __future__ import annotations

from ..models import ProcessNode, RuleHit


def _series(n: ProcessNode) -> list[float]:
    return [p.co2eT for p in (n.monthly or [])]


def _trend_pct_per_year(vals: list[float]) -> float | None:
    if len(vals) < 4:
        return None
    n = len(vals)
    xs = list(range(n))
    xm, ym = sum(xs) / n, sum(vals) / n
    num = sum((x - xm) * (y - ym) for x, y in zip(xs, vals))
    den = sum((x - xm) ** 2 for x in xs) or 1e-9
    slope = num / den  # per month
    return (slope * 12) / ym * 100 if ym else None


def diagnose(n: ProcessNode, sector_hint: str | None, output_tpm: float, fuel_mix: dict[str, float] | None) -> list[RuleHit]:
    hits: list[RuleHit] = []
    ratio = n.actualIntensity / n.benchmarkIntensity if n.benchmarkIntensity else 1.0
    vals = _series(n)

    # R6 — anomaly-linked step change (checked first: it explains the others)
    flagged = [p for p in (n.monthly or []) if p.anomaly]
    if flagged:
        hits.append(RuleHit(rule="R6", title="Step change in a recent month", evidence={"months": [f"{p.month} (z={p.z:+})" for p in flagged]}))

    # R2 — fuel mix skewed to a high-EF fuel
    if fuel_mix:
        worst = max(fuel_mix.items(), key=lambda kv: kv[1])
        if worst[0] in ("coal", "pet_coke", "furnace_oil") and worst[1] >= 0.5:
            hits.append(RuleHit(rule="R2", title=f"Fuel mix skewed to {worst[0].replace('_', ' ')}", evidence={"sharePct": round(worst[1] * 100)}))

    # R3 — specific consumption elevated with normal output
    if ratio >= 1.15:
        hits.append(RuleHit(rule="R3", title="Specific consumption elevated — thermal/combustion efficiency", evidence={"actual": n.actualIntensity, "benchmark": n.benchmarkIntensity, "ratio": round(ratio, 2), "hint": sector_hint or ""}))

    # R5 — deteriorating trend
    tr = _trend_pct_per_year(vals)
    if tr is not None and tr > 5:
        hits.append(RuleHit(rule="R5", title="Intensity drifting upward — maintenance / fouling signature", evidence={"trendPctPerYear": round(tr, 1)}))

    # R4 — waste leakage (effluent / waste nodes)
    if n.kind == "effluent" and ratio >= 1.1:
        hits.append(RuleHit(rule="R4", title="Material lost to waste stream, not recovered", evidence={"ratio": round(ratio, 2)}))

    # R1 — low utilisation (fixed overhead over low output) — only if nothing else explains it
    if not hits and output_tpm > 0 and ratio >= 1.1:
        hits.append(RuleHit(rule="R1", title="Fixed energy overhead spread over low output", evidence={"outputTpm": output_tpm, "ratio": round(ratio, 2)}))

    return hits[:2]


def narrative(hits: list[RuleHit], fallback: str) -> str:
    if not hits:
        return fallback
    parts = []
    for h in hits:
        ev = ", ".join(f"{k}={v}" for k, v in h.evidence.items() if k != "hint" and v not in ("", None))
        parts.append(f"[{h.rule}] {h.title} ({ev}).")
    return " ".join(parts) + " Rule-based inference, not a measurement."
