"""Pydantic contracts for Hermes Research OS."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, HttpUrl


class ResearchSource(str, Enum):
    github = "github"
    youtube = "youtube"
    reddit = "reddit"
    x = "x"
    linkedin = "linkedin"
    web = "web"
    rss = "rss"


class ResearchIntent(str, Enum):
    technical = "technical"
    lead_generation = "lead_generation"
    competitive_intel = "competitive_intel"
    market_sentiment = "market_sentiment"
    content_research = "content_research"
    general = "general"


class ResearchQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=4_000)
    objective: str | None = Field(default=None, max_length=1_000)
    sources: list[ResearchSource] | None = None
    max_results_per_source: int = Field(default=5, ge=1, le=25)
    enrich_leads: bool = False
    save_to_dkos: bool = True
    tenant_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceRoute(BaseModel):
    source: ResearchSource
    reason: str
    priority: int = Field(ge=1, le=10)


class ResearchPlan(BaseModel):
    intent: ResearchIntent
    routes: list[SourceRoute]
    token_strategy: str
    lead_enrichment_recommended: bool = False


class EvidenceItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    source: ResearchSource
    title: str
    url: str | None = None
    snippet: str = ""
    author: str | None = None
    published_at: datetime | None = None
    raw: dict[str, Any] = Field(default_factory=dict)
    score: float = 0.0
    score_reasons: list[str] = Field(default_factory=list)


class LeadCandidate(BaseModel):
    company: str | None = None
    person: str | None = None
    role: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class LeadEnrichmentResult(BaseModel):
    status: Literal["queued", "skipped", "failed"]
    clay_webhook_configured: bool
    submitted: int = 0
    message: str | None = None
    records: list[LeadCandidate] = Field(default_factory=list)


class DKOSWriteResult(BaseModel):
    status: Literal["saved", "skipped", "failed"]
    records: int = 0
    message: str | None = None


class ResearchQueryResponse(BaseModel):
    job_id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    query: str
    plan: ResearchPlan
    evidence: list[EvidenceItem]
    leads: list[LeadCandidate] = Field(default_factory=list)
    enrichment: LeadEnrichmentResult | None = None
    dkos: DKOSWriteResult | None = None
    summary: str


class SourceHealth(BaseModel):
    source: str
    status: Literal["configured", "degraded", "missing", "optional"]
    detail: str
