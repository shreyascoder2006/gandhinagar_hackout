"""Indicative Carbon Credit Trading Scheme (CCTS) valuation.

India's CCTS (under the Energy Conservation Act 2022 amendment) had not set
official floor/forbearance prices as of this session (research: September
2026) — CERC's 2026 trading regulations were announced but compliance-market
Carbon Credit Certificate (CCC) prices remain analyst estimates, not a
mandated number. The figure used here (Rs 900/tCO2e) is the midpoint of the
commonly-cited early-phase analyst range (Rs 600-1,200/tCO2e), NOT an official
price — every value computed from it is returned tagged `is_placeholder`,
matching this project's discipline for anything without a hard source.

If/when CERC publishes an official floor price, replace INDICATIVE_PRICE_INR_PER_TCO2E
and update the source note — do not silently change the number without updating
the citation.
"""
from __future__ import annotations

INDICATIVE_PRICE_INR_PER_TCO2E = 900.0
SOURCE_NOTE = (
    "Illustrative only — India's CCTS had not published an official floor/forbearance "
    "price as of Sept 2026. Rs 900/tCO2e is the midpoint of commonly-cited analyst "
    "estimates for early-phase compliance-market pricing (range ~Rs 600-1,200/tCO2e), "
    "not a mandated or verified price. First official compliance trades were expected "
    "around October 2026 per government indications at the time of writing."
)


def credit_value_inr(avoidable_co2e_tpy: float) -> float:
    return round(avoidable_co2e_tpy * INDICATIVE_PRICE_INR_PER_TCO2E, 0)
