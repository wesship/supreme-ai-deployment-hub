"""Marketing Command Center API routes.

These routes provide a safe first integration surface for Hermes-backed marketing
workflows. They intentionally prepare internal results only; external channel
movement remains a separate human-approved workflow.
"""

from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/marketing", tags=["marketing"])


class MarketingChannel(str, Enum):
    x_twitter = "x-twitter"
    linkedin = "linkedin"
    tiktok = "tiktok"
    threads = "threads"
    youtube_shorts = "youtube-shorts"
    instagram = "instagram"
    email = "email"
    github = "github"


class MarketingGenerateRequest(BaseModel):
    campaign_name: str = Field(..., min_length=1)
    audience: str = Field(..., min_length=1)
    channel: MarketingChannel
    cta: str = Field(..., min_length=1)
    product_update: str = Field(..., min_length=1)
    constraints: list[str] = Field(default_factory=list)


class MarketingAsset(BaseModel):
    id: str
    campaign_id: str | None = None
    channel: MarketingChannel
    label: str
    subject: str | None = None
    body: str
    status: str = "DRAFT"


class MarketingReviewResult(BaseModel):
    decision: Literal["APPROVE", "REVISE", "BLOCK"]
    score: float | None = None
    issues: list[str] = Field(default_factory=list)
    suggested_revision: str | None = None
    required_sources: list[str] = Field(default_factory=list)


class MarketingGenerateResponse(BaseModel):
    asset: MarketingAsset
    brand_review: MarketingReviewResult | None = None
    claim_review: MarketingReviewResult | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MarketingAssetInput(BaseModel):
    body: str = Field(..., min_length=1)
    channel: MarketingChannel


class ApproveRequest(BaseModel):
    asset_id: str


class AnalyzeRequest(BaseModel):
    campaign_id: str


@router.post("/generate", response_model=MarketingGenerateResponse)
def generate_marketing_asset(payload: MarketingGenerateRequest) -> MarketingGenerateResponse:
    """Generate a draft marketing asset.

    TODO: Replace deterministic draft with Hermes route `generate_social_post`,
    `generate_email`, or `generate_launch_campaign` based on channel/context.
    """

    body = (
        f"Campaign: {payload.campaign_name}\n\n"
        f"Audience: {payload.audience}\n\n"
        f"Update: {payload.product_update}\n\n"
        f"CTA: {payload.cta}"
    )

    return MarketingGenerateResponse(
        asset=MarketingAsset(
            id=str(uuid4()),
            channel=payload.channel,
            label=f"{payload.campaign_name} Draft",
            body=body,
            status="DRAFT",
        ),
        brand_review=MarketingReviewResult(
            decision="REVISE",
            score=7.5,
            issues=["Hermes generation is not yet wired; this is a deterministic draft stub."],
            suggested_revision="Connect this endpoint to Hermes marketing-agent for full generation.",
        ),
        claim_review=MarketingReviewResult(
            decision="APPROVE",
            issues=[],
        ),
        metadata={"source": "marketing-router-stub"},
    )


@router.post("/rewrite", response_model=MarketingGenerateResponse)
def rewrite_marketing_asset(payload: MarketingAssetInput) -> MarketingGenerateResponse:
    return MarketingGenerateResponse(
        asset=MarketingAsset(
            id=str(uuid4()),
            channel=payload.channel,
            label="Rewrite Draft",
            body=payload.body,
            status="DRAFT",
        ),
        brand_review=MarketingReviewResult(
            decision="REVISE",
            issues=["Hermes rewrite route is not yet wired."],
        ),
    )


@router.post("/brand-check", response_model=MarketingReviewResult)
def brand_check(payload: MarketingAssetInput) -> MarketingReviewResult:
    issues: list[str] = []
    if "guaranteed" in payload.body.lower():
        issues.append("Avoid guaranteed outcome language unless verified.")
    if "military-grade" in payload.body.lower():
        issues.append("Avoid military-grade language unless formally documented.")

    return MarketingReviewResult(
        decision="REVISE" if issues else "APPROVE",
        score=8.0 if not issues else 6.5,
        issues=issues,
    )


@router.post("/claim-check", response_model=MarketingReviewResult)
def claim_check(payload: MarketingAssetInput) -> MarketingReviewResult:
    sensitive_terms = ["soc 2", "hipaa", "guaranteed", "agi", "revenue", "customers"]
    issues = [f"Requires verification: {term}" for term in sensitive_terms if term in payload.body.lower()]

    return MarketingReviewResult(
        decision="REVISE" if issues else "APPROVE",
        issues=issues,
        required_sources=["marketing/data/approved-claims.md", "marketing/data/metrics-source-of-truth.md"] if issues else [],
    )


@router.post("/approve")
def approve_asset(payload: ApproveRequest) -> dict[str, Any]:
    return {"ok": True, "asset_id": payload.asset_id, "status": "APPROVED"}


@router.post("/prepare")
def prepare_channel_asset(payload: MarketingAssetInput) -> dict[str, Any]:
    return {
        "ok": True,
        "channel": payload.channel,
        "prepared": payload.body,
        "requires_human_approval": True,
    }


@router.post("/analyze")
def analyze_campaign(payload: AnalyzeRequest) -> dict[str, Any]:
    return {
        "ok": True,
        "campaign_id": payload.campaign_id,
        "summary": "Analytics connector pending. Add channel metrics to marketing_metrics for full analysis.",
    }
