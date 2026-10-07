"""Deterministic fixed-income analytics for Insurance Capital Intelligence.

Research/decision-support only. This module does not execute trades or move funds.
Missing inputs return None rather than fabricated values.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite
from typing import Iterable, Optional


@dataclass(frozen=True)
class BondInputs:
    face_value: float
    coupon_rate: float  # decimal annual rate, e.g. .05
    clean_price: float  # price per 100 par
    maturity_date: date
    settlement_date: date
    payments_per_year: int = 2


def current_yield(face_value: float, coupon_rate: float, clean_price: float) -> Optional[float]:
    if face_value <= 0 or clean_price <= 0 or coupon_rate < 0:
        return None
    market_value = face_value * clean_price / 100.0
    return (face_value * coupon_rate) / market_value


def years_to_maturity(maturity_date: date, settlement_date: date) -> Optional[float]:
    days = (maturity_date - settlement_date).days
    return days / 365.25 if days > 0 else None


def approximate_ytm(bond: BondInputs) -> Optional[float]:
    """Conservative approximation; production UI must label this as approximate."""
    years = years_to_maturity(bond.maturity_date, bond.settlement_date)
    if years is None or bond.face_value <= 0 or bond.clean_price <= 0:
        return None
    price = bond.face_value * bond.clean_price / 100.0
    annual_coupon = bond.face_value * bond.coupon_rate
    denominator = (bond.face_value + price) / 2.0
    if denominator <= 0:
        return None
    result = (annual_coupon + (bond.face_value - price) / years) / denominator
    return result if isfinite(result) else None


def weighted_average_maturity(positions: Iterable[tuple[float, float]]) -> Optional[float]:
    """positions contains (market_value, years_to_maturity)."""
    valid = [(v, y) for v, y in positions if v >= 0 and y >= 0]
    total = sum(v for v, _ in valid)
    if total <= 0:
        return None
    return sum(v * y for v, y in valid) / total


def concentration(shares: Iterable[tuple[str, float]]) -> dict[str, float]:
    values = [(key, value) for key, value in shares if key and value >= 0]
    total = sum(value for _, value in values)
    if total <= 0:
        return {}
    result: dict[str, float] = {}
    for key, value in values:
        result[key] = result.get(key, 0.0) + value / total
    return result
