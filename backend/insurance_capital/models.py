"""Domain schemas for the research-only Insurance Capital Intelligence vertical."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CapitalBucket(str, Enum):
    INSURER = "insurer"
    OPERATING_CLAIMS = "operating_claims"
    TRUST_FAMILY_OFFICE = "trust_family_office"


class Evidence(BaseModel):
    source: str
    source_url: Optional[str] = None
    retrieved_at: datetime
    observed_at: Optional[datetime] = None


class SecurityRecord(BaseModel):
    identifier: str = Field(min_length=1, max_length=64)
    identifier_type: str = "CUSIP"
    issuer_name: str
    security_name: str
    coupon_rate: Optional[float] = Field(default=None, ge=0)
    maturity_date: Optional[date] = None
    clean_price: Optional[float] = Field(default=None, gt=0)
    rating: Optional[str] = None
    evidence: list[Evidence] = Field(default_factory=list)


class Position(BaseModel):
    security: SecurityRecord
    market_value: float = Field(ge=0)
    bucket: CapitalBucket


class PortfolioRequest(BaseModel):
    portfolio_id: str
    positions: list[Position]


class SecurityAnalysis(BaseModel):
    identifier: str
    current_yield: Optional[float] = None
    approximate_ytm: Optional[float] = None
    years_to_maturity: Optional[float] = None
    evidence: list[Evidence] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
